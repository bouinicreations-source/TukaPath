import { base44 } from "@/api/client";

const GPT_PROMPT = `You are a route-intent parser. Your only job is to extract structured travel intent from natural language input.

The user may write in ANY language (Arabic, Spanish, French, Italian, English, mixed). Normalize meaning to English first, then extract.

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "normalized_text_english": "<English paraphrase of the full intent>",
  "origin_text": "<place name or null>",
  "destination_text": "<place name or null>",
  "trip_type": "point_to_point" | "loop_journey" | "multi_day_roadtrip" | "city_circuit" | null,
  "mode": "drive" | "walk" | null,
  "route_style": "scenic" | "standard" | null,
  "time_mode": "fixed" | "full_day" | "flexible" | null,
  "time_value_minutes": <number or null>,
  "themes": [<strings from: coffee, food, sunset, scenic, coastal, countryside, history, art, hidden_gems, cultural, city_stop>]
}

EXTRACTION RULES:

Origin / Destination:
- "from X to Y", "X to Y", "starting in X ending in Y", "leaving X heading to Y" → origin=X, destination=Y
- "heading to Y from X", "I want to go to Y from X" → origin=X, destination=Y
- "from X" alone → origin=X, destination=null
- "to Y" alone → origin=null, destination=Y
- If clearly stated, NEVER leave those fields null.

Mode → "drive":
- drive, driving, road trip, car, by car, bike, biking, motorbike, motorcycle, riding, ride, on a bike, on my bike, by bike

Mode → "walk":
- walk, walking, stroll, on foot, hike, hiking, pedestrian, пешком, a piedi, à pied, a pie, caminando, equivalent in any language

Route style → "scenic":
- scenic, beautiful, nice views, pretty, countryside, coastal, ocean, sea, waterfront, nature, winding roads, avoid highways, smaller roads, back roads, pretty drive, mountain roads, not the highway, scenic route, more beautiful than fast

Route style → "standard":
- fastest, efficient, direct, quickest, shortest, no detour, straight there, quick way

Time mode → "fixed" (with time_value_minutes):
- "30 min" → 30, "45 min" → 45, "1 hour" → 60, "1.5 hours" → 90, "2 hours" → 120, "3 hours" → 180, "4 hours" → 240

Time mode → "full_day":
- full day, all day, day trip, whole day, the whole day

Time mode → "flexible":
- no rush, flexible, all the time needed, no time limit, I don't mind detours, I can take my time, open timing, road trip no rush, as long as needed, take my time, no hurry, happy to take longer

Themes:
- coffee/cafe/cappuccino → coffee
- food/lunch/dinner/breakfast/eat/restaurant → food
- sunset/golden hour/evening light → sunset
- coastal/coast/sea/beach/ocean/waterfront → coastal
- countryside/rural/village/fields → countryside
- history/heritage/ancient/historic/old town → history
- art/gallery/museum/culture → art
- hidden/secret/local spots/off the beaten → hidden_gems
- cultural/local culture/traditional → cultural

Trip type rules:
- "drive around", "loop", "get back to where I start", "leave destination blank", "circular route", "round trip back to start" → trip_type = "loop_journey", destination_text = null
- "hotel", "stay overnight", "1 night", "multiple nights", "max X km per leg", "easy drive with overnight", "multi-day", "road trip over several days" → trip_type = "multi_day_roadtrip"
- "walk around the city", "explore the city", "city tour", "wander around" → trip_type = "city_circuit"
- default (from A to B) → trip_type = "point_to_point"

If the user's confidence level is low (vague input), still extract what you can and leave uncertain fields as null.`;

export async function parseJourneyInput(text) {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `${GPT_PROMPT}\n\nUser input: "${text}"`,
    response_json_schema: {
      type: "object",
      properties: {
        normalized_text_english: { type: "string" },
        origin_text: { type: "string" },
        destination_text: { type: "string" },
        mode: { type: "string" },
        route_style: { type: "string" },
        time_mode: { type: "string" },
        time_value_minutes: { type: "number" },
        themes: { type: "array", items: { type: "string" } },
        trip_type: { type: "string" },
      },
    },
  });
  return result;
}

// Geocode a place name string.
// Returns one of:
//   CanonicalPlace object                        — clear auto-selected match
//   { needs_confirmation: true, candidates, raw_query } — ambiguous, user must choose
//   null                                         — not found
//
// A CanonicalPlace has: { display_name, canonical_name, name, lat, lng,
//   city, region_state, country, source_place_id, source_name, place_kind,
//   resolution_confidence, user_confirmed }
//
// fromVoice=true applies stricter ambiguity rules (voice is less certain than typed)
// partnerText = the OTHER location in a "from X to Y" pair, for pair coherence scoring
// isTravelMode = true when the full input sentence is travel-like
export async function geocodeText(text, userLat, userLng, fromVoice = false, partnerText = null, isTravelMode = false, partnerLat = null, partnerLng = null) {
  if (!text?.trim()) return null;
  try {
    const res = await base44.functions.invoke("resolveLocation", {
      query: text.trim(),
      userLat: userLat || null,
      userLng: userLng || null,
      fromVoice,
      partnerQuery: partnerText || null,
      isTravelMode,
      partnerLat: partnerLat || null,
      partnerLng: partnerLng || null,
    });
    const data = res?.data;
    if (!data) return null;

    // Ambiguous — return candidates for the UI to handle
    if (data.needs_confirmation && data.candidates?.length > 0) {
      return {
        needs_confirmation: true,
        candidates: data.candidates,
        raw_query: data.raw_query || text.trim(),
      };
    }

    const result = data.result;
    if (!result?.lat || !result?.lng) return null;

    // Build canonical place object — preserves full resolution context
    return buildCanonicalPlace(result, false);
  } catch {
    return null;
  }
}

// Build a canonical resolved place object from a resolveLocation result.
// user_confirmed=true when the user explicitly selected from disambiguation UI.
export function buildCanonicalPlace(result, userConfirmed = false) {
  if (!result?.lat || !result?.lng) return null;

  // Parse city/region/country from the name string if not explicit fields
  // e.g. "Greater London, England, United Kingdom" → city=London, region=England, country=United Kingdom
  const nameParts = (result.name || '').split(',').map(s => s.trim());
  const inferredCity    = nameParts[0] || null;
  const inferredRegion  = nameParts.length >= 3 ? nameParts[nameParts.length - 2] : null;
  const inferredCountry = result.country || (nameParts.length >= 2 ? nameParts[nameParts.length - 1] : null);

  // Map place_type_label to a place_kind enum
  const placeKindMap = {
    'City': 'city', 'Region': 'region', 'Landmark': 'landmark',
    'Neighbourhood': 'district', 'Street': 'street', 'Building': 'building',
  };
  const place_kind = placeKindMap[result.place_type_label] || 'place';

  return {
    // Display / canonical names
    display_name:          result.name,
    canonical_name:        result.name,
    name:                  result.name,   // kept for backward compat
    // Coordinates
    lat:                   result.lat,
    lng:                   result.lng,
    // Geographic context
    city:                  result.city || inferredCity,
    region_state:          inferredRegion,
    country:               inferredCountry,
    // Source metadata
    source_place_id:       result.source_place_id || null,
    source_name:           result.source || 'resolveLocation',
    place_kind,
    // Resolution quality
    resolution_confidence: result.confidence || 0,
    user_confirmed:        userConfirmed,
  };
}

// Map parsed GPT result to UI state values.
// currentTimeMinutes = existing time value in form (prevents overwriting a user-locked time).
export function mapParsedToState(parsed, currentTimeMinutes = null) {
  const state = {};

  if (parsed.mode === "drive" || parsed.mode === "walk" || parsed.mode === "motorcycle")
    state.mode = parsed.mode;

  if (parsed.route_style === "scenic" || parsed.route_style === "standard")
    state.routeStyle = parsed.route_style;

  // ── TIME LOGIC: never overwrite a time the user has already locked ──────────
  // Only apply parsed time when:
  //   (a) no existing time is set, OR
  //   (b) existing time is "flexible" and parsed is also flexible (no-op), OR
  //   (c) this is a fresh parse (caller passes null for currentTimeMinutes)
  const timeAlreadyLocked = currentTimeMinutes !== null && currentTimeMinutes !== undefined;

  if (!timeAlreadyLocked) {
    if (parsed.time_mode === "flexible") {
      state.timeMinutes = "flexible";
    } else if (parsed.time_mode === "full_day") {
      state.timeMinutes = 480;
    } else if (parsed.time_mode === "fixed" && parsed.time_value_minutes) {
      const OPTIONS = [30, 45, 60, 90, 120, 180, 240, 480];
      const val = parsed.time_value_minutes;
      const nearest = OPTIONS.reduce((a, b) => Math.abs(b - val) < Math.abs(a - val) ? b : a);
      state.timeMinutes = nearest;
    }
    // If time_mode is null and no current time, do NOT default to anything — leave null
  }
  // If timeAlreadyLocked: silently keep current value, do not touch it

  if (Array.isArray(parsed.themes)) {
    const THEME_KEY_MAP = {
      coffee: "coffee", food: "coffee", sunset: "sunset",
      coastal: "coastal", countryside: "countryside",
      history: "history", art: "art",
      hidden_gems: "history", cultural: "history", city_stop: "art",
      scenic: "scenic",
    };
    const mapped = parsed.themes.map(t => THEME_KEY_MAP[t]).filter(Boolean);
    if (mapped.length) state.themes = [...new Set(mapped)];
  }

  return state;
}

// ── Voice input normalization ────────────────────────────────────────────────
// Cleans transcribed voice text before passing to the parser.
// Removes filler words, fixes common OCR/STT artifacts.
export function normalizeVoiceInput(text) {
  if (!text) return "";
  return text
    .trim()
    // Remove common STT noise words at start
    .replace(/^(um+|uh+|er+|ah+|okay|ok|so|like|well|yeah|yes|no),?\s*/i, "")
    // Normalize "abraj bay three" → "abraj bay 3"
    .replace(/\bthree\b/gi, "3").replace(/\btwo\b/gi, "2").replace(/\bone\b/gi, "1")
    .replace(/\bfour\b/gi, "4").replace(/\bfive\b/gi, "5")
    // Fix common place misspellings that STT produces
    .replace(/\babraj\s*bay\b/gi, "Abraj Bay")
    .replace(/\bburj\s*khalifa\b/gi, "Burj Khalifa")
    .replace(/\bdubai\b/gi, "Dubai")
    .replace(/\bdoha\b/gi, "Doha")
    .replace(/\bmalaga\b/gi, "Malaga")
    .trim();
}