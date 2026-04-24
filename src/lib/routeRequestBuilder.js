/**
 * routeRequestBuilder.js
 *
 * PURPOSE
 * -------
 * Normalize Journey form input into a deterministic, route-aware intent object.
 * This file does NOT ask GPT to choose stops.
 *
 * Correct architecture:
 *   1) Deterministic engine selects stops from structured dataset
 *   2) This file prepares a minimal payload for GPT enrichment only
 *      (route title, summary, short stop hooks)
 *
 * GPT must never:
 * - discover new locations
 * - choose stops
 * - override order
 * - override route logic
 */

const AIRPORT_KEYWORDS = ["airport", "terminal", "airfield", "runway", "aviation"];

const SCENIC_STYLE_TAGS = new Set([
  "scenic",
  "coastal",
  "countryside",
  "waterfront",
  "nature",
  "sunset",
]);

const FOOD_STYLE_TAGS = new Set([
  "coffee",
  "food",
  "restaurant",
  "breakfast",
  "lunch",
  "dinner",
]);

const CULTURAL_STYLE_TAGS = new Set([
  "cultural",
  "history",
  "art",
  "museum",
  "heritage",
]);

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

function toNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasCoords(point) {
  return (
    point &&
    Number.isFinite(Number(point.latitude)) &&
    Number.isFinite(Number(point.longitude))
  );
}

function normalizePoint(point) {
  if (!point) return null;

  if (typeof point === "string") {
    const label = normalizeString(point);
    return label ? { label, latitude: null, longitude: null } : null;
  }

  const label =
    normalizeString(point.label) ||
    normalizeString(point.name) ||
    normalizeString(point.address) ||
    normalizeString(point.city);

  const latitude = toNumber(point.latitude, null);
  const longitude = toNumber(point.longitude, null);

  if (!label && (latitude === null || longitude === null)) return null;

  return {
    label: label || null,
    latitude,
    longitude,
  };
}

function isAirportLocation(loc) {
  const name = normalizeString(loc?.name).toLowerCase();
  const description = normalizeString(loc?.description).toLowerCase();
  const category = normalizeString(loc?.category).toLowerCase();

  return (
    category === "airport" ||
    AIRPORT_KEYWORDS.some((kw) => name.includes(kw)) ||
    AIRPORT_KEYWORDS.some((kw) => description.includes(kw))
  );
}

function normalizeTags(loc) {
  const raw = [
    ...(Array.isArray(loc?.tags) ? loc.tags : []),
    loc?.category,
    ...(Array.isArray(loc?.themes) ? loc.themes : []),
  ];

  return raw
    .map((x) => normalizeString(x).toLowerCase())
    .filter(Boolean);
}

function inferJourneyType(origin, destination, totalTimeMinutes) {
  if (destination) return "point_to_point";
  if (totalTimeMinutes !== null && totalTimeMinutes <= 240) return "loop";
  return "loop";
}

function inferRouteGoal(routeStyle, notes, destinationType) {
  const styles = new Set(routeStyle);
  const notesText = normalizeString(notes).toLowerCase();

  if (destinationType === "point_to_point") {
    if (styles.has("scenic") || styles.has("coastal") || styles.has("countryside")) {
      return "scenic_transfer";
    }
    return "point_to_point_exploration";
  }

  if (styles.has("coffee") || styles.has("food")) return "food_and_breaks";
  if (styles.has("history") || styles.has("art") || styles.has("cultural")) return "culture";
  if (styles.has("coastal") || styles.has("countryside") || styles.has("sunset")) return "nature";
  if (notesText.includes("food") || notesText.includes("coffee")) return "food_and_breaks";
  return "scenic_enjoyment";
}

function inferInterestPriority(routeStyle, notes) {
  const styles = routeStyle.map((s) => s.toLowerCase());
  const notesText = normalizeString(notes).toLowerCase();

  if (styles.includes("food") || styles.includes("coffee")) return "food";
  if (styles.includes("sunset")) return "sunset";
  if (styles.includes("coastal")) return "coastal";
  if (styles.includes("countryside")) return "countryside";
  if (styles.includes("history")) return "history";
  if (styles.includes("art")) return "art";
  if (styles.includes("cultural")) return "cultural";
  if (styles.includes("scenic")) return "scenic";

  if (notesText.includes("food")) return "food";
  if (notesText.includes("coffee")) return "coffee";
  if (notesText.includes("sunset")) return "sunset";

  return "scenic";
}

function inferRequestedStopPlan({ requestedStops, notes, totalTimeMinutes }) {
  const notesText = normalizeString(notes).toLowerCase();

  return {
    requested_stop_count:
      toNumber(requestedStops, null) ??
      (totalTimeMinutes && totalTimeMinutes < 45 ? 1 : null),
    wants_midpoint_food:
      notesText.includes("food") ||
      notesText.includes("lunch") ||
      notesText.includes("restaurant") ||
      notesText.includes("meal"),
    wants_coffee:
      notesText.includes("coffee") || notesText.includes("cafe"),
    wants_scenic:
      notesText.includes("scenic") ||
      notesText.includes("beautiful") ||
      notesText.includes("nice") ||
      notesText.includes("view"),
  };
}

function normalizeSelectedStops(selectedStops) {
  return toArray(selectedStops)
    .filter(Boolean)
    .map((loc, index) => {
      const tags = normalizeTags(loc);

      return {
        id: loc.id ?? loc.location_id ?? null,
        order: toNumber(loc.order, index + 1),
        name: normalizeString(loc.name || loc.stop_name),
        city: normalizeString(loc.city),
        category: normalizeString(loc.category || loc.stop_type) || "other",
        latitude: toNumber(loc.latitude, null),
        longitude: toNumber(loc.longitude, null),
        role: normalizeString(loc.role) || null,
        dwell_minutes:
          toNumber(loc.stop_duration, null) ??
          toNumber(loc.estimated_dwell_minutes, null) ??
          null,
        deviation:
          normalizeString(loc.stop_deviation || loc.deviation) || "on_route",
        tags,
        has_story: Boolean(loc.has_story || loc.location_id),
      };
    })
    .filter((loc) => loc.name);
}

function normalizeCandidateLocations(locations) {
  return toArray(locations)
    .filter(Boolean)
    .filter((loc) => !isAirportLocation(loc))
    .filter((loc) => loc.has_story || normalizeString(loc.category) !== "other")
    .map((loc) => ({
      id: loc.id ?? loc.location_id ?? null,
      name: normalizeString(loc.name),
      city: normalizeString(loc.city),
      category: normalizeString(loc.category) || "other",
      latitude: toNumber(loc.latitude, null),
      longitude: toNumber(loc.longitude, null),
      tags: normalizeTags(loc),
      has_story: Boolean(loc.has_story || loc.location_id),
      estimated_dwell_minutes:
        toNumber(loc.estimated_dwell_minutes, null) ??
        toNumber(loc.stop_duration, null) ??
        null,
    }))
    .filter((loc) => loc.name);
}

function summarizeStyle(routeStyle) {
  const styles = routeStyle.map((s) => s.toLowerCase());
  const summary = {
    scenic_bias: styles.some((s) => SCENIC_STYLE_TAGS.has(s)),
    food_bias: styles.some((s) => FOOD_STYLE_TAGS.has(s)),
    cultural_bias: styles.some((s) => CULTURAL_STYLE_TAGS.has(s)),
  };

  return summary;
}

/**
 * Main normalized object builder
 *
 * IMPORTANT:
 * - selectedStops must already be chosen by deterministic route logic
 * - candidateLocations is optional context only, not for GPT stop selection
 */
export function buildRoutePromptObject(
  formState,
  {
    selectedStops = [],
    candidateLocations = [],
    routeMeta = {},
  } = {}
) {
  const {
    start_point,
    destination_point,
    mode,
    total_time_available,
    route_mode = "on_the_way",
    route_style = [],
    avoid_options = [],
    stop_preference,
    stop_time_target,
    notes,
    selected_stops,
  } = formState || {};

  const origin = normalizePoint(start_point);
  const destination = normalizePoint(destination_point);

  const safeMode = normalizeString(mode) || "drive";
  const totalTimeMinutes = toNumber(total_time_available, null);
  const normalizedRouteStyle = toArray(route_style).map((s) =>
    normalizeString(s).toLowerCase()
  );
  const selected = normalizeSelectedStops(selectedStops.length ? selectedStops : selected_stops);
  const candidates = normalizeCandidateLocations(candidateLocations);

  const destinationType = inferJourneyType(origin, destination, totalTimeMinutes);
  const routeGoal = inferRouteGoal(normalizedRouteStyle, notes, destinationType);
  const interestPriority = inferInterestPriority(normalizedRouteStyle, notes);
  const requestedStopPlan = inferRequestedStopPlan({
    requestedStops: stop_preference,
    notes,
    totalTimeMinutes,
  });

  return {
    mode: safeMode,
    route_mode: normalizeString(route_mode) || "on_the_way",
    destination_type: destinationType,
    route_style: normalizedRouteStyle,
    route_goal: routeGoal,
    interest_priority: interestPriority,
    available_time_minutes: totalTimeMinutes,
    origin,
    destination,
    avoid_options: toArray(avoid_options)
      .map((a) => normalizeString(a).toLowerCase())
      .filter((a) => a && a !== "none"),
    stop_preference:
      stop_preference && stop_preference !== "none" ? stop_preference : null,
    stop_time_target: toNumber(stop_time_target, null),
    user_notes: normalizeString(notes) || null,

    // Deterministically selected by route engine elsewhere
    selected_stops: selected,

    // Optional context only; never authoritative for stop selection
    candidate_locations_context: candidates,

    requested_stop_plan: requestedStopPlan,
    style_summary: summarizeStyle(normalizedRouteStyle),

    route_meta: {
      start_resolved: hasCoords(origin),
      destination_resolved: hasCoords(destination),
      route_distance_km: toNumber(routeMeta.route_distance_km, null),
      route_duration_minutes: toNumber(routeMeta.route_duration_minutes, null),
      corridor_mode:
        normalizeString(routeMeta.corridor_mode) ||
        (destination ? "route_aligned" : "local_or_loop"),
      segment_count: toNumber(routeMeta.segment_count, null),
      engine_version: normalizeString(routeMeta.engine_version) || "deterministic-v1",
    },

    _version: "2.0",
    _built_at: new Date().toISOString(),
  };
}

/**
 * Deprecated name kept for compatibility.
 * This function no longer asks GPT to suggest stops.
 * It only asks GPT to enrich already-selected stops.
 */
export function buildStopSuggestionPrompt(promptObject) {
  return buildEnrichmentPrompt(promptObject);
}

/**
 * Deprecated name kept for compatibility.
 * This function no longer asks GPT to design routes.
 * It only asks GPT to enrich a route that has already been designed in code.
 */
export function buildRouteSystemPrompt(promptObject) {
  return buildEnrichmentPrompt(promptObject);
}

/**
 * Minimal GPT enrichment prompt
 *
 * GPT is given only:
 * - normalized route context
 * - already-selected stops
 *
 * GPT returns only:
 * - route_name
 * - route_summary
 * - route_personality
 * - route_reasoning
 * - per-stop short hook text
 *
 * GPT must not change stop order or stop identity.
 */
export function buildEnrichmentPrompt(promptObject) {
  const modeLabel = promptObject.mode === "walk" ? "walking" : "driving";

  const minimalStops = toArray(promptObject.selected_stops).map((stop) => ({
    id: stop.id,
    order: stop.order,
    name: stop.name,
    city: stop.city,
    category: stop.category,
    role: stop.role,
    tags: stop.tags,
    dwell_minutes: stop.dwell_minutes,
    deviation: stop.deviation,
  }));

  return `You are TukaPath's journey copywriter.

Your job is ONLY to enrich an already-designed journey.
You must NOT:
- add new stops
- remove stops
- reorder stops
- change route logic
- invent locations

Journey mode: ${modeLabel}
Journey type: ${promptObject.destination_type}
Route goal: ${promptObject.route_goal}
Interest priority: ${promptObject.interest_priority}
Available time: ${promptObject.available_time_minutes ?? "unknown"} minutes

Origin:
${JSON.stringify(promptObject.origin, null, 2)}

Destination:
${JSON.stringify(promptObject.destination, null, 2)}

User notes:
${JSON.stringify(promptObject.user_notes, null, 2)}

Style tags:
${JSON.stringify(promptObject.route_style, null, 2)}

Selected stops (final and fixed):
${JSON.stringify(minimalStops, null, 2)}

Return JSON in this exact structure:
{
  "route_name": string,
  "route_summary": string,
  "route_personality": string,
  "route_reasoning": string,
  "themes": [string],
  "stops": [
    {
      "id": string or null,
      "order": number,
      "stop_name": string,
      "short_hook": string,
      "why_this_stop": string
    }
  ]
}

Rules:
- Keep text concise and premium
- short_hook = max 1 sentence
- why_this_stop = max 1 sentence
- preserve stop order exactly
- preserve stop names exactly
- themes should be 2-4 words only`;
}