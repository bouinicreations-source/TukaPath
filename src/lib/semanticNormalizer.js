/**
 * semanticNormalizer.js
 * SEMANTIC NORMALIZATION LAYER — Step 0 of the extraction pipeline.
 *
 * Maps fuzzy natural language phrases into structured signal objects
 * BEFORE they reach the LLM extractor. This layer is deterministic and
 * fully reusable — no AI involved.
 *
 * Usage:
 *   const signals = normalizeSemantics(userText);
 *   // signals.duration_days, signals.planning_intent, etc.
 */

// ── Duration normalization ────────────────────────────────────────────────────
// NORMALISATION TABLE (Part 21) — ordered most-specific first
const DURATION_PATTERNS = [
  // Multi-week named
  { re: /\btwo\s+weeks?\b|\ba?\s*fortnight\b|\b14\s+days?\b/i,        fn: () => ({ duration_days: 14, duration_type: "days", overnight_ok: true }) },
  { re: /\bthree\s+weeks?\b|\b21\s+days?\b/i,                          fn: () => ({ duration_days: 21, duration_type: "days", overnight_ok: true }) },
  { re: /\bcouple\s+of\s+weeks?\b/i,                                   fn: () => ({ duration_days: 14, duration_type: "days", overnight_ok: true }) },
  { re: /\ba?\s+month\b|\bone\s+month\b/i,                             fn: () => ({ duration_days: 28, duration_type: "days", overnight_ok: true }) },
  { re: /\b(\d+)\s+months?\b/i,                                        fn: m => ({ duration_days: parseInt(m[1]) * 30, duration_type: "days", overnight_ok: true }) },
  // Week named
  { re: /\b(?:a|one)\s+week\b|\bfor\s+a\s+week\b|\bweek\s+long\b/i,  fn: () => ({ duration_days: 7,  duration_type: "days", overnight_ok: true }) },
  { re: /\b(\d+)\s+weeks?\b/i,                                         fn: m => ({ duration_days: parseInt(m[1]) * 7, duration_type: "days", overnight_ok: true }) },
  // Weekend named
  { re: /\blong\s+weekend\b/i,                                         fn: () => ({ duration_days: 3,  duration_type: "days", overnight_ok: true }) },
  { re: /\bfor\s+the\s+weekend\b|\bweekend\s+trip\b|\bweekend\b/i,    fn: () => ({ duration_days: 2,  duration_type: "days", overnight_ok: true }) },
  // Approximate fuzzy
  { re: /\ba\s+couple\s+of\s+days?\b|\bcouple\s+of\s+days?\b/i,       fn: () => ({ duration_days: 2,  duration_type: "days" }) },
  { re: /\ba\s+few\s+days?\b|\bfew\s+days?\b/i,                        fn: () => ({ duration_days: 3,  duration_type: "days" }) },
  // Day named
  { re: /\bfull\s+day\b|\ba\s+day\b/i,                                 fn: () => ({ duration_hours: 8, duration_type: "hours" }) },
  { re: /\bday\s+trip\b/i,                                             fn: () => ({ duration_hours: 8, duration_type: "hours", overnight_ok: false }) },
  { re: /\bhalf\s+(?:a\s+)?day\b/i,                                    fn: () => ({ duration_hours: 4, duration_type: "hours" }) },
  // Overnight keyword alone
  { re: /\bovernight\b/i,                                               fn: () => ({ duration_days: 2,  duration_type: "days", overnight_ok: true }) },
  // Hours — fuzzy first, then numeric
  { re: /\ba\s+couple\s+of\s+hours?\b/i,                               fn: () => ({ duration_hours: 2, duration_type: "hours" }) },
  { re: /\ba\s+few\s+hours?\b/i,                                        fn: () => ({ duration_hours: 3, duration_type: "hours" }) },
  // Exact numeric — nights, days, hours
  { re: /\b(\d+)\s*nights?\b/i,                                        fn: m => ({ duration_days: parseInt(m[1]) + 1, duration_type: "days", overnight_ok: true }) },
  { re: /\b(\d+)\s*days?\b/i,                                          fn: m => ({ duration_days: parseInt(m[1]),     duration_type: "days" }) },
  { re: /\b(\d+)\s*hours?\b/i,                                         fn: m => ({ duration_hours: parseInt(m[1]),    duration_type: "hours" }) },
  { re: /\b(\d+(?:\.\d+)?)\s*hrs?\b/i,                                fn: m => ({ duration_hours: parseFloat(m[1]),  duration_type: "hours" }) },
  // Flexible
  { re: /\bflexible\b|\bnot\s+sure\b|\bopen.?ended\b/i,               fn: () => ({ duration_type: "flexible" }) },
];

// ── Planning intent signals ───────────────────────────────────────────────────
const FULL_PLANNING_PATTERNS = [
  /\bhelp\s+me\s+plan\b/i,
  /\bplan\s+it\s+for\s+me\b/i,
  /\bbuild\s+me\s+(a\s+)?(route|trip|journey)\b/i,
  /\bdesign\s+(the\s+)?(route|trip|journey)\b/i,
  /\bplan\s+my\s+(trip|journey|route)\b/i,
  /\bcreate\s+(a\s+)?(route|itinerary|trip)\b/i,
  /\bput\s+(it\s+)?together\b/i,
  /\borganize\s+(the\s+)?trip\b/i,
  /\bset\s+it\s+up\b/i,
];

const SUGGESTIONS_ONLY_PATTERNS = [
  /\bgive\s+me\s+(some\s+)?ideas?\b/i,
  /\bsuggest\s+(some\s+)?places?\b/i,
  /\bwhat\s+(are|would\s+be)\s+good\s+stops?\b/i,
  /\bany\s+recommendations?\b/i,
];

// ── Efficiency signals ────────────────────────────────────────────────────────
const EFFICIENCY_PATTERNS = [
  /\bjust\s+get\s+me\s+there\b/i,
  /\bkeep\s+it\s+simple\b/i,
  /\bminimal\s+stops?\b/i,
  /\bstraight\s+through\b/i,
  /\bno\s+detours?\b/i,
  /\bquickest\s+route\b/i,
  /\bfastest\s+way\b/i,
];

// ── Experience / scenic signals ───────────────────────────────────────────────
const EXPERIENCE_PATTERNS = [
  /\bscenic\b/i,
  /\bworth\s+it\b/i,
  /\bthe\s+journey\s+matters\b/i,
  /\bi\s+don'?t\s+mind\s+detours?\b/i,
  /\bhappy\s+to\s+detour\b/i,
  /\btake\s+the\s+scenic\b/i,
  /\bcoastal\s+route\b/i,
  /\bthrough\s+the\s+countryside\b/i,
  /\bsightseeing\b/i,
];

// ── Comfort / short legs signals ──────────────────────────────────────────────
const COMFORT_SHORT_LEG_PATTERNS = [
  /\bnot\s+too\s+much\s+driving\b/i,
  /\beasy\s+day\b/i,
  /\bkeep\s+it\s+chill\b/i,
  /\bfrequent\s+stops?\b/i,
  /\bstop\s+(every|often|frequently)\b/i,
  /\bdon'?t\s+want\s+to\s+drive\s+too\s+(long|far)\b/i,
  /\bshort\s+(legs?|drives?|stretches?)\b/i,
  /\bevery\s+(hour|45|60\s*min)\b/i,
  /\bbreaks?\s+every\b/i,
];

// ── Long leg / comfort with driving signals ───────────────────────────────────
const COMFORT_LONG_LEG_PATTERNS = [
  /\bhappy\s+(?:to\s+)?(?:drive|with)\s+long\s+stretches?\b/i,
  /\bi\s+don'?t\s+mind\s+driving\b/i,
  /\bcomfortable\s+driving\s+long\b/i,
  /\bfew\s+stops?\b/i,
  /\blong\s+stretches?\b/i,
  /\bdriving\s+is\s+fine\b/i,
];

// ── Anchor signals ────────────────────────────────────────────────────────────
// (These are handled by the LLM extractor already, but we detect them here
//  as signals to bump planning_intent)
const ANCHOR_PATTERNS = [
  /\bvia\b/i,
  /\bstop\s+by\b/i,
  /\bon\s+the\s+way\b/i,
  /\bthrough\b/i,
  /\bpass\s+through\b/i,
  /\bstopping\s+(in|at)\b/i,
  /\bincluding\b/i,
];

// ── Temporal / constraint signals ─────────────────────────────────────────────
const TEMPORAL_PATTERNS = [
  { re: /\blater\s+today\b/i,             signal: "same_day_late" },
  { re: /\bthis\s+evening\b/i,            signal: "evening_start" },
  { re: /\bsunset\b/i,                    signal: "sunset_timing" },
  { re: /\bi\s+need\s+to\s+be\s+back\s+(tonight|today)\b/i, signal: "hard_return" },
  { re: /\bback\s+(home\s+)?by\s+(tonight|this\s+evening)\b/i, signal: "hard_return" },
  { re: /\bdon'?t\s+want\s+to\s+drive\s+at\s+night\b/i, signal: "no_night_drive" },
  { re: /\bsomewhere\s+nearby\b/i,        signal: "local_radius" },
  { re: /\bi'?d\s+rather\s+stay\s+somewhere\b/i, signal: "overnight_preferred" },
];

// ── Flight intent signals ─────────────────────────────────────────────────────
const FLIGHT_INTENT_PATTERNS = [
  /\bfl(?:y|ying|ight)\b/i,
  /\bflight\b/i,
  /\bairport\b/i,
  /\bfly\s+(?:there|to|into)\b/i,
  /\btaking\s+a\s+flight\b/i,
  /\bflying\s+(?:out|in|to)\b/i,
  /\bplane\b/i,
];

// ── Post-arrival mobility signals ─────────────────────────────────────────────
const ARRIVAL_CAR_PATTERNS    = [/\brent\s+a?\s*car\b/i, /\bcar\s+rental\b/i, /\bhire\s+a?\s*car\b/i];
const ARRIVAL_MOTO_PATTERNS   = [/\brent\s+a?\s*(?:motorbike|motorcycle|scooter)\b/i];
const ARRIVAL_WALK_PATTERNS   = [/\bwalk\s+(?:around|it|the)\b/i, /\bon\s+foot\b/i, /\bexplore\s+on\s+foot\b/i];
const ARRIVAL_PUBLIC_PATTERNS = [/\bpublic\s+transport\b/i, /\bbus(?:es)?\b/i, /\bmetro\b/i, /\btrain\b/i];

// ── Overnight signals ─────────────────────────────────────────────────────────
const OVERNIGHT_OK_PATTERNS = [
  /\bi'?d\s+rather\s+stay\s+somewhere\s+than\s+drive\s+too\s+long\b/i,
  /\bhappy\s+to\s+(?:stay|overnight|stop)\s+somewhere\b/i,
  /\bstay\s+overnight\b/i,
  /\bbook\s+(a\s+)?hotel\b/i,
  /\bsleep\s+(somewhere|along)\b/i,
];

const OVERNIGHT_NO_PATTERNS = [
  /\bback\s+(the\s+same\s+day|tonight|today)\b/i,
  /\bno\s+overnight\b/i,
  /\bday\s+trip\b/i,
  /\bi\s+need\s+to\s+be\s+home\s+tonight\b/i,
  /\bdon'?t\s+want\s+to\s+stay\s+over\b/i,
];

// ── Main normalizer function ──────────────────────────────────────────────────
/**
 * normalizeSemantics(text)
 *
 * Returns a signals object with deterministically extracted structured fields.
 * These signals AUGMENT the LLM extraction — they don't replace it.
 * All fields are nullable — only set when matched.
 */
export function normalizeSemantics(text) {
  if (!text?.trim()) return {};

  const signals = {
    duration_days:      null,
    duration_hours:     null,
    duration_type:      null,
    overnight_ok:       null,
    planning_intent:    null,
    driving_rhythm:     null,
    temporal_signals:   [],
    has_anchor_intent:  false,
    route_style:        null,   // "scenic" | "efficient" | null
    flight_detected:    false,
    transport_primary:  null,   // "flight" | null (never "drive" from semantics — LLM handles that)
    transport_secondary: null,  // "car" | "motorbike" | "walk" | "public" | null
    car_rental_intent:  null,
  };

  // Duration
  for (const { re, fn } of DURATION_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const result = fn(m);
      Object.assign(signals, result);
      break; // use first match only — more specific patterns come first
    }
  }

  // Planning intent
  if (FULL_PLANNING_PATTERNS.some(re => re.test(text))) {
    signals.planning_intent = "FULL_PLANNING_REQUIRED";
  } else if (SUGGESTIONS_ONLY_PATTERNS.some(re => re.test(text))) {
    signals.planning_intent = "SUGGESTIONS_ONLY";
  }

  // Route style
  if (EFFICIENCY_PATTERNS.some(re => re.test(text))) {
    signals.route_style = "efficient";
  } else if (EXPERIENCE_PATTERNS.some(re => re.test(text))) {
    signals.route_style = "scenic";
  }

  // Driving rhythm
  if (COMFORT_SHORT_LEG_PATTERNS.some(re => re.test(text))) {
    signals.driving_rhythm = "short_legs";
  } else if (COMFORT_LONG_LEG_PATTERNS.some(re => re.test(text))) {
    signals.driving_rhythm = "long_legs";
  }

  // Overnight (explicit)
  if (OVERNIGHT_NO_PATTERNS.some(re => re.test(text))) {
    signals.overnight_ok = false;
  } else if (OVERNIGHT_OK_PATTERNS.some(re => re.test(text))) {
    signals.overnight_ok = true;
  }

  // Anchor intent
  if (ANCHOR_PATTERNS.some(re => re.test(text))) {
    signals.has_anchor_intent = true;
  }

  // Temporal signals
  for (const { re, signal } of TEMPORAL_PATTERNS) {
    if (re.test(text)) signals.temporal_signals.push(signal);
  }

  // Overnight from temporal
  if (signals.temporal_signals.includes("hard_return")) {
    signals.overnight_ok = false;
  }
  if (signals.temporal_signals.includes("overnight_preferred")) {
    signals.overnight_ok = true;
  }

  // Flight intent detection
  if (FLIGHT_INTENT_PATTERNS.some(re => re.test(text))) {
    signals.flight_detected = true;
    signals.transport_primary = "flight";
  }

  // Post-arrival mobility detection (even without flight context, set as signals)
  if (ARRIVAL_CAR_PATTERNS.some(re => re.test(text))) {
    signals.transport_secondary = "car";
    signals.car_rental_intent   = true;
  } else if (ARRIVAL_MOTO_PATTERNS.some(re => re.test(text))) {
    signals.transport_secondary = "motorbike";
  } else if (ARRIVAL_WALK_PATTERNS.some(re => re.test(text))) {
    signals.transport_secondary = "walk";
  } else if (ARRIVAL_PUBLIC_PATTERNS.some(re => re.test(text))) {
    signals.transport_secondary = "public";
  }

  return signals;
}

/**
 * applySemanticSignals(extraction, signals)
 *
 * Merges semantic signals INTO an LLM extraction result.
 * Semantic signals only fill gaps — they don't override high-confidence LLM output.
 */
export function applySemanticSignals(extraction, signals) {
  const e = { ...extraction };

  // Only apply duration from semantics if LLM didn't catch it
  if (!e.duration_type && signals.duration_type) {
    e.duration_type  = signals.duration_type;
    e.duration_days  = signals.duration_days  || null;
    e.duration_hours = signals.duration_hours || null;
    if (e.confidence) e.confidence.duration = "medium";
  }

  // planning_intent — semantic detection is often more reliable for explicit phrases
  if (!e.planning_intent && signals.planning_intent) {
    e.planning_intent = signals.planning_intent;
  }

  // driving_rhythm
  if (!e.driving_rhythm && signals.driving_rhythm) {
    e.driving_rhythm = signals.driving_rhythm;
  }

  // overnight_ok
  if (e.overnight_ok === null && signals.overnight_ok !== null) {
    e.overnight_ok = signals.overnight_ok;
  }

  // preferences from route style
  if (signals.route_style === "scenic" && !e.preferences?.includes("scenic")) {
    e.preferences = [...(e.preferences || []), "scenic"];
  }

  // flight signals — always apply if detected (user was explicit)
  if (signals.flight_detected && !e.flight_detected) {
    e.flight_detected = true;
  }
  if (signals.transport_primary && !e.transport_primary) {
    e.transport_primary = signals.transport_primary;
  }
  if (signals.transport_secondary && !e.transport_secondary) {
    e.transport_secondary = signals.transport_secondary;
  }
  if (signals.car_rental_intent !== null && e.car_rental_intent == null) {
    e.car_rental_intent = signals.car_rental_intent;
  }

  return e;
}