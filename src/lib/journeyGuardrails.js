// ─────────────────────────────────────────────────────────────────────────────
// TukaPath — Phase 9: Journey Output Guardrails
// Pure normalization layer. Never throws. Never mutates source directly.
// Called after buildJourneyV2 + evaluateJourney, before any UI renders.
// ─────────────────────────────────────────────────────────────────────────────

// ── SAFE FALLBACK COPY ────────────────────────────────────────────────────────
const EMPTY_ROUTE_TITLE    = "This one is about the drive.";
const EMPTY_ROUTE_SUMMARY  = "No stops worth making on this stretch. Enjoy the road.";
const DEFAULT_TITLE        = "Your Journey";
const DEFAULT_SUMMARY      = "A route picked for you.";

const FILLER_PATTERNS = [
  /this journey offers a unique experience/i,
  /unique and memorable experience/i,
  /offers a blend of/i,
  /a perfect blend of/i,
  /experience the best of/i,
  /embark on a journey/i,
  /discover the beauty of/i,
  /this route will take you through/i,
];

const ROLE_MICRO_COPY = {
  main_highlight:      "Worth the stop",
  sunset_anchor:       "Catch it here",
  secondary_highlight: "Worth a look",
  scenic_pass:         "Quick stop",
  quick_stop:          "If you want to break the drive",
  coffee_stop:         "Good for a break",
  meal_stop:           "Time to eat",
  rest_stop:           "Rest up",
  fuel_stop:           "Fuel stop",
  connector:           "Along the way",
};

const ROLE_LABELS = {
  main_highlight:      "MAIN STOP",
  sunset_anchor:       "SUNSET SPOT",
  secondary_highlight: "HIGHLIGHT",
  scenic_pass:         "SCENIC PASS",
  quick_stop:          "QUICK STOP",
  coffee_stop:         "COFFEE BREAK",
  meal_stop:           "FOOD STOP",
  rest_stop:           "REST AREA",
  fuel_stop:           "FUEL",
  connector:           "STOP",
};

// ── HELPERS ───────────────────────────────────────────────────────────────────

function isFillerText(text) {
  if (!text) return false;
  return FILLER_PATTERNS.some(p => p.test(text));
}

function cleanText(text) {
  if (!text || typeof text !== "string") return null;
  // Remove trailing filler phrases, excess whitespace, repeated sentences
  let out = text.trim();
  // Remove sentences that match filler patterns
  const sentences = out.split(/(?<=[.!?])\s+/);
  const filtered  = sentences.filter(s => !isFillerText(s));
  out = filtered.join(" ").trim();
  // Collapse multiple spaces
  out = out.replace(/\s{2,}/g, " ");
  return out || null;
}

function deduplicateStops(mainStops, quickStops) {
  const seenIds   = new Set();
  const seenNames = new Set();

  const filterUnique = (stops) => stops.filter(s => {
    const id   = s.location?.id;
    const name = s.location?.name?.toLowerCase()?.trim();
    if (id   && seenIds.has(id))     return false;
    if (name && seenNames.has(name)) return false;
    if (id)   seenIds.add(id);
    if (name) seenNames.add(name);
    return true;
  });

  // Main stops have priority — deduplicate quick_stops against them
  const cleanMain  = filterUnique(mainStops);
  const cleanQuick = filterUnique(quickStops);
  return { cleanMain, cleanQuick };
}

function normalizeStopRole(stop) {
  const raw  = (stop.stop_role || "connector").toLowerCase().replace(/\s+/g, "_");
  const label     = ROLE_LABELS[raw]     || "STOP";
  const microCopy = ROLE_MICRO_COPY[raw] || "Along the way";
  return { ...stop, stop_role: raw, _role_label: label, _micro_copy: microCopy };
}

// ── MAIN GUARDRAIL FUNCTION ───────────────────────────────────────────────────

export function applyJourneyGuardrails(rawJourney) {
  if (!rawJourney || typeof rawJourney !== "object") {
    return {
      journey: buildMinimalFallback(),
      debug_guardrails: {
        defaults_applied: ["full_fallback"],
        fixes_applied: [],
        missing_fields_filled: ["everything"],
      },
    };
  }

  // Work on a shallow copy — never mutate source
  let j = { ...rawJourney };

  const defaults_applied  = [];
  const fixes_applied     = [];
  const missing_fields_filled = [];

  // ── PART 1: Safe output contract ─────────────────────────────────────────

  // result_status
  if (!j.result_status) {
    const hasStops = (j.main_stops?.length || 0) + (j.quick_stops?.length || 0) > 0;
    j.result_status = hasStops ? "partial" : "arrival_only";
    missing_fields_filled.push("result_status");
  }

  // stops arrays — always exist
  if (!Array.isArray(j.main_stops))  { j.main_stops  = []; missing_fields_filled.push("main_stops"); }
  if (!Array.isArray(j.quick_stops)) { j.quick_stops = []; missing_fields_filled.push("quick_stops"); }

  // arrival / departure suggestions — always arrays
  if (!Array.isArray(j.arrival_suggestions))   { j.arrival_suggestions   = []; missing_fields_filled.push("arrival_suggestions"); }
  if (!Array.isArray(j.departure_suggestions)) { j.departure_suggestions = []; missing_fields_filled.push("departure_suggestions"); }

  // support layer
  if (!j.db_service_support || typeof j.db_service_support !== "object") {
    j.db_service_support = { fuel: [], coffee: [], food: [], total: 0 };
    missing_fields_filled.push("db_service_support");
  } else {
    // Ensure all sub-arrays exist
    if (!Array.isArray(j.db_service_support.fuel))   j.db_service_support.fuel   = [];
    if (!Array.isArray(j.db_service_support.coffee)) j.db_service_support.coffee = [];
    if (!Array.isArray(j.db_service_support.food))   j.db_service_support.food   = [];
  }

  // route_metadata
  if (!j.route_metadata || typeof j.route_metadata !== "object") {
    j.route_metadata = { distance_km: 0, duration_minutes: 0, provider: "none" };
    missing_fields_filled.push("route_metadata");
  }

  // route_character — safe defaults
  if (!j.route_character || typeof j.route_character !== "object") {
    j.route_character = {};
    missing_fields_filled.push("route_character");
  }

  // ── PART 2: Empty/sparse UX rules ─────────────────────────────────────────

  const totalStops = j.main_stops.length + j.quick_stops.length;

  if (totalStops === 0) {
    // Force result_status to arrival_only if not already
    if (j.result_status === "complete") {
      j.result_status = "arrival_only";
      fixes_applied.push("corrected_result_status_to_arrival_only");
    }
    // Apply empty route copy
    if (!j.journey_title || isFillerText(j.journey_title)) {
      j.journey_title = EMPTY_ROUTE_TITLE;
      defaults_applied.push("empty_route_title");
    }
    if (!j.summary || isFillerText(j.summary)) {
      j.summary = EMPTY_ROUTE_SUMMARY;
      defaults_applied.push("empty_route_summary");
    }
  }

  // ── PART 3: Copy standardization ─────────────────────────────────────────

  // Journey title
  if (!j.journey_title || j.journey_title.trim() === "" || isFillerText(j.journey_title)) {
    j.journey_title = totalStops > 0 ? DEFAULT_TITLE : EMPTY_ROUTE_TITLE;
    defaults_applied.push("journey_title");
  }

  // Journey summary — clean filler, compress
  if (j.summary) {
    const cleaned = cleanText(j.summary);
    if (!cleaned || isFillerText(cleaned)) {
      j.summary = totalStops > 0 ? DEFAULT_SUMMARY : EMPTY_ROUTE_SUMMARY;
      defaults_applied.push("summary_replaced_filler");
    } else {
      j.summary = cleaned;
    }
  } else {
    j.summary = totalStops > 0 ? DEFAULT_SUMMARY : EMPTY_ROUTE_SUMMARY;
    missing_fields_filled.push("summary");
  }

  // Mood
  if (!j.mood) {
    j.mood = "exploratory";
    missing_fields_filled.push("mood");
  }

  // partial_match_note — clean if filler
  if (j.partial_match_note && isFillerText(j.partial_match_note)) {
    j.partial_match_note = null;
    fixes_applied.push("cleared_filler_partial_note");
  }

  // ── PART 4: Stop label control ────────────────────────────────────────────

  const normalizeStopList = (stops) =>
    stops
      .filter(s => s && s.location)
      .map(s => normalizeStopRole(s));

  j.main_stops  = normalizeStopList(j.main_stops);
  j.quick_stops = normalizeStopList(j.quick_stops);

  // ── PART 5: Deduplication ─────────────────────────────────────────────────

  const beforeCount = j.main_stops.length + j.quick_stops.length;
  const { cleanMain, cleanQuick } = deduplicateStops(j.main_stops, j.quick_stops);
  j.main_stops  = cleanMain;
  j.quick_stops = cleanQuick;
  const afterCount = j.main_stops.length + j.quick_stops.length;
  if (afterCount < beforeCount) {
    fixes_applied.push(`deduplication:removed_${beforeCount - afterCount}`);
  }

  // ── PART 4b: Venue class enforcement — MAIN stops must be journey-class ───
  // Prevent restaurants/hotels/petrol from ever appearing as main_highlight
  const SERVICE_CATEGORIES  = new Set(["restaurant", "cafe", "petrol_station"]);
  const HOSPITALITY_CATEGORIES = new Set(["hotel"]);
  const demotedToQuick = [];
  j.main_stops = j.main_stops.filter(s => {
    const cat = s.location?.category;
    if (SERVICE_CATEGORIES.has(cat) || HOSPITALITY_CATEGORIES.has(cat)) {
      // Demote to quick_stop rather than drop entirely
      demotedToQuick.push({ ...s, stop_role: "connector", _role_label: "STOP", _micro_copy: "Along the way" });
      return false;
    }
    return true;
  });
  if (demotedToQuick.length > 0) {
    j.quick_stops = [...j.quick_stops, ...demotedToQuick];
    fixes_applied.push(`venue_class_demoted_${demotedToQuick.length}`);
  }

  // ── PART 6: Time + mode consistency ──────────────────────────────────────

  // Lock mode to valid values — never let it drift
  const VALID_MODES = new Set(["drive", "walk", "motorcycle"]);
  if (j.mode && !VALID_MODES.has(j.mode)) {
    j.mode = "drive";
    fixes_applied.push("mode_normalized_to_drive");
  }
  // Propagate mode from caller context if journey doesn't carry it
  // (mode is passed by RoutePlanner via the guardedJourney wrapper)

  // ── PART 7: Support strip safety ─────────────────────────────────────────

  // If total service support count is 0 but total field says > 0, fix it
  const actualTotal =
    (j.db_service_support.fuel?.length   || 0) +
    (j.db_service_support.coffee?.length || 0) +
    (j.db_service_support.food?.length   || 0);
  if (j.db_service_support.total !== actualTotal) {
    j.db_service_support.total = actualTotal;
    fixes_applied.push("service_total_reconciled");
  }

  // ── PART 8: Final refinement pass ────────────────────────────────────────

  // hooks — clean each hook text
  if (Array.isArray(j.themes_extracted) && j.themes_extracted.length === 0) {
    // Fine — just an empty array
  }

  // Ensure themes_extracted exists
  if (!Array.isArray(j.themes_extracted)) {
    j.themes_extracted = [];
    missing_fields_filled.push("themes_extracted");
  }

  // ── PART 9: Debug flag ────────────────────────────────────────────────────

  j.debug_guardrails = {
    defaults_applied,
    fixes_applied,
    missing_fields_filled,
    total_changes: defaults_applied.length + fixes_applied.length + missing_fields_filled.length,
  };

  return { journey: j, debug_guardrails: j.debug_guardrails };
}

// ── MINIMAL FALLBACK — absolute worst case ────────────────────────────────────
function buildMinimalFallback() {
  return {
    result_status: "arrival_only",
    journey_title: EMPTY_ROUTE_TITLE,
    summary: EMPTY_ROUTE_SUMMARY,
    mood: "exploratory",
    main_stops: [],
    quick_stops: [],
    arrival_suggestions: [],
    departure_suggestions: [],
    db_service_support: { fuel: [], coffee: [], food: [], total: 0 },
    route_metadata: { distance_km: 0, duration_minutes: 0, provider: "none" },
    route_character: {},
    themes_extracted: [],
    debug_guardrails: {
      defaults_applied: ["minimal_fallback"],
      fixes_applied: [],
      missing_fields_filled: ["all"],
      total_changes: 1,
    },
  };
}