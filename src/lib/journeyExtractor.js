/**
 * journeyExtractor.js
 * EXTRACTION LAYER — Deterministic parsing only.
 *
 * CRITICAL RULE: Extract ONLY explicitly stated fields.
 * Do NOT invent values. Do NOT fill missing fields with defaults.
 * Null fields must have confidence "low".
 */

import { base44 } from "@/api/client";

// ── Extraction schema ────────────────────────────────────────────────────────
export const EMPTY_EXTRACTION = {
  origin:           null,
  destination:      null,
  anchors:          [],
  duration_days:    null,
  duration_type:    null,       // "hours" | "days" | "flexible" | null
  duration_hours:   null,
  transport_mode:   null,       // "car" | "motorbike" | "walk" | "bike" | "train" | "mixed" | null
  trip_type:        null,       // "loop" | "point_to_point" | "exploration" | null
  preferences:      [],
  corrections:      null,       // { field: string, value: string } | null
  planning_intent:  null,       // "FULL_PLANNING_REQUIRED" | null
  driving_rhythm:   null,       // "short_legs" | "balanced" | "long_legs" | null
  overnight_ok:     null,       // boolean | null
  confidence: {
    origin:      "low",
    destination: "low",
    anchors:     "low",
    duration:    "low",
    mode:        "low",
  },
};

const EXTRACTION_PROMPT = `You are a deterministic travel intent parser for TukaPath.

GOLDEN RULE: Extract ONLY what is explicitly stated in the user input.
Do NOT infer. Do NOT assume. Do NOT fill missing fields with defaults or guesses.

If a field is not mentioned in the input → set to null with confidence "low".
If a field IS mentioned → extract it and set confidence to "high" or "medium".

════════════════════════════════════════════════════════════════════════════

TRANSPORT MODE (CRITICAL):
- "I'm driving from X to Y" → mode: "car", confidence: "high"
- "by motorbike" / "motorcycle" → mode: "motorbike", confidence: "high"
- "walking" / "on foot" → mode: "walk", confidence: "high"
- "I wanna go from X to Y" (no mode mentioned) → mode: null, confidence: "low"
- RULE: No mode signal? Set to null. Never invent.

LOCATION EXTRACTION:
- origin: "from X" / "starting in X" / "out of X" / "leaving X" → extract, confidence "high"
- destination: "to Y" / "heading to Y" / "arriving at Y" → extract, confidence "high"
- anchors: "via Z" / "through Z" / "stopping at Z" → extract as array, confidence "high"
- NOT mentioned? → null, confidence "low"

DURATION EXTRACTION:
- "3 days" / "2 weeks" / "a month" → extract number and type, confidence "high"
- "a week" / "a couple of days" → extract normalized number, confidence "high"
- "flexible" / "open-ended" → duration_type: "flexible", confidence "high"
- DATES: "Tuesday 28 April to Sunday 3 May" → calculate duration_days as difference, confidence "high"
- DATES PER CITY: "2 days in Amsterdam, 4 days in London" → total duration_days = sum, also extract city_durations
- ARRIVAL/DEPARTURE DATES: extract arrival_date and departure_date if mentioned (ISO format YYYY-MM-DD)
- NOT mentioned? → duration_days: null, duration_type: null, confidence "low"

TRIP TYPE:
- origin AND destination both present → trip_type: "point_to_point"
- User said "loop" / "round trip" / "circular" → trip_type: "loop"
- Otherwise → null

CORRECTIONS:
- "am not flying" / "not driving" → corrections: {field: "transport_mode", value: null}
- "not X, I said Y" / "actually Y" → corrections: {field: "<field>", value: "<value>"}
- Otherwise → null

PREFERENCES: Extract ONLY if user explicitly mentioned.
Examples: scenic, cultural, food, nature, countryside, coastal, history
If NOT mentioned → empty array

OVERNIGHT_OK:
- "don't want to overnight" / "day trip" / "back same day" → false
- "happy to overnight" / "sleep somewhere" → true
- NOT mentioned → null

PLANNING INTENT:
- origin + destination both present → "FULL_PLANNING_REQUIRED"
- Otherwise → null

════════════════════════════════════════════════════════════════════════════

CONFIDENCE LEVELS:
- "high": user explicitly stated this field
- "medium": clearly implied from explicit statement
- "low": field not mentioned or ambiguous

IMPORTANT: All null fields MUST have confidence "low".
All extracted fields MUST have confidence "high" or "medium".

════════════════════════════════════════════════════════════════════════════

EXAMPLES:

Input: "I wanna go from Milan to Amsterdam"
Output: {
  "origin": "Milan",
  "destination": "Amsterdam",
  "transport_mode": null,
  "confidence": {"mode": "low"},
  ...
}
REASON: No mode mentioned. Do NOT invent "flying" or any default.

Input: "Am not flying"
Output: {
  "corrections": {"field": "transport_mode", "value": null},
  ...
}

Input: "3 days, car, scenic"
Output: {
  "duration_days": 3,
  "duration_type": "days",
  "transport_mode": "car",
  "preferences": ["scenic"],
  "confidence": {"duration": "high", "mode": "high"},
  ...
}`;

/**
 * extractJourneyEntities(userText)
 * Sends user text through LLM extraction. Returns structured extraction object.
 * Never throws — returns EMPTY_EXTRACTION on failure.
 */
export async function extractJourneyEntities(userText) {
  if (!userText?.trim()) return { ...EMPTY_EXTRACTION };

  try {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `${EXTRACTION_PROMPT}\n\nUser input: "${userText.trim()}"`,
      response_json_schema: {
        type: "object",
        properties: {
          origin:           { type: ["string", "null"] },
          destination:      { type: ["string", "null"] },
          anchors:          { type: "array", items: { type: "string" } },
          duration_days:    { type: ["number", "null"] },
          duration_type:    { type: ["string", "null"] },
          duration_hours:   { type: ["number", "null"] },
          transport_mode:   { type: ["string", "null"] },
          trip_type:        { type: ["string", "null"] },
          preferences:      { type: "array", items: { type: "string" } },
          corrections: {
            type: ["object", "null"],
            properties: {
              field: { type: "string" },
              value: { type: ["string", "null"] },
            },
          },
          planning_intent:  { type: ["string", "null"] },
          driving_rhythm:   { type: ["string", "null"] },
          overnight_ok:     { type: ["boolean", "null"] },
          confidence: {
            type: "object",
            properties: {
              origin:      { type: "string" },
              destination: { type: "string" },
              anchors:     { type: "string" },
              duration:    { type: "string" },
              mode:        { type: "string" },
            },
          },
        },
      },
    });

    const r = result || {};
    return {
      origin:           r.origin          || null,
      destination:      r.destination     || null,
      anchors:          Array.isArray(r.anchors) ? r.anchors.filter(Boolean) : [],
      duration_days:    typeof r.duration_days  === "number" ? r.duration_days  : null,
      duration_type:    r.duration_type   || null,
      duration_hours:   typeof r.duration_hours === "number" ? r.duration_hours : null,
      transport_mode:   r.transport_mode  || null,
      trip_type:        r.trip_type       || null,
      preferences:      Array.isArray(r.preferences) ? r.preferences.filter(Boolean) : [],
      corrections:      r.corrections?.field ? r.corrections : null,
      planning_intent:  r.planning_intent || null,
      driving_rhythm:   r.driving_rhythm  || null,
      overnight_ok:     typeof r.overnight_ok === "boolean" ? r.overnight_ok : null,
      confidence: {
        origin:      r.confidence?.origin      || "low",
        destination: r.confidence?.destination || "low",
        anchors:     r.confidence?.anchors     || "low",
        duration:    r.confidence?.duration    || "low",
        mode:        r.confidence?.mode        || "low",
      },
    };
  } catch {
    return { ...EMPTY_EXTRACTION };
  }
}