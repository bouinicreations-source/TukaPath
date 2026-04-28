/**
 * journeyStateMachine.js
 * STATE MERGE ENGINE + STATE VALIDATION — Steps 2 & 3 of the pipeline.
 *
 * structured_state is the single source of truth for the concierge.
 * No response is ever generated from raw user text — only from this state.
 */

// ── Confidence levels ────────────────────────────────────────────────────────
const CONF_RANK = { high: 3, medium: 2, low: 1, unknown: 0 };

function rank(conf) {
  return CONF_RANK[conf] ?? 0;
}

// ── Initial empty state ──────────────────────────────────────────────────────
export function createEmptyState() {
  return {
    origin:               null,   // string | null
    origin_conf:          "low",
    destination:          null,   // string | null
    destination_conf:     "low",
    anchors:              [],     // string[] — ordered, deduped
    anchors_conf:         "low",
    duration_days:        null,   // number | null
    duration_hours:       null,   // number | null
    duration_type:        null,   // "hours" | "days" | "flexible" | null
    duration_conf:        "low",
    transport_mode:       null,   // "car" | "motorbike" | "walk" | "bike" | "train" | "mixed" | null
    mode_conf:            "low",
    trip_type:            null,   // "loop" | "point_to_point" | "exploration" | null
    preferences:          [],     // string[] — cumulative
    planning_intent:      null,   // "FULL_PLANNING_REQUIRED" | "SUGGESTIONS_ONLY" | "ROUTE_ONLY" | null
    driving_rhythm:       null,   // "short_legs" | "balanced" | "long_legs" | "unknown" | null
    overnight_ok:         null,   // boolean | null
    overnight_conf:       "low",
    // ── Flight mode fields ──────────────────────────────────────────────────
    flight_detected:      false,  // true when route signals a flight scenario
    transport_primary:    null,   // "flight" | "drive" | null — how they get there
    flight_intent:        null,   // "find_flights" | "plan_after" | "both" | null
    transport_secondary:  null,   // "car" | "motorbike" | "walk" | "public" | null — on arrival
    car_rental_intent:    null,   // boolean | null — true if renting a car on arrival
    scenic_drive_offer:   null,   // boolean | null — true if user wants a scenic drive designed
    // ── CQE enrichment fields (set by Contextual Question Engine) ───────────
    time_preference:          null,   // "day_only" | "flexible"
    compactness:              null,   // "compact" | "spread_out"
    day_pace:                 null,   // "relaxed" | "ambitious"
    transfer_tolerance:       null,   // "low_transfers" | "flexible"
    distance_tolerance:       null,   // "easy" | "moderate" | "hard"
    stop_density:             null,   // "packed" | "relaxed" | "balanced"
    style:                    null,   // "scenic" | "cultural" | "food" | "mixed"
    drive_duration_preference: null, // "short" | "medium" | "long"
    cqe_questions_asked:      [],    // string[] — ids of CQE questions already presented
    // ── Live trip + human context ────────────────────────────────────────────
    is_currently_traveling:   false,
    current_time_hint:        null,
    arrival_time_hint:        null,
    city_durations:           [],    // [{city, days, arrival_time}]
    companions:               [],    // [{name, relation, location, emotional_weight}]
    group_energy:             null,
    split_after:              null,
    split_details:            null,
  };
}

/**
 * mergeExtraction(currentState, extraction)
 *
 * Applies extraction to currentState following the strict merge rules.
 * Returns a NEW state object (immutable).
 */
export function mergeExtraction(currentState, extraction) {
  const next = { ...currentState };

  // ── RULE 2: correction takes precedence ────────────────────────────────────
  if (extraction.corrections?.field && extraction.corrections?.value) {
    const { field, value } = extraction.corrections;
    switch (field) {
      case "origin":
        next.origin      = value;
        next.origin_conf = "high";
        break;
      case "destination":
        next.destination      = value;
        next.destination_conf = "high";
        break;
      case "transport_mode":
      case "mode":
        next.transport_mode = normalizeMode(value);
        next.mode_conf      = "high";
        break;
      case "duration":
        applyDurationString(next, value);
        next.duration_conf = "high";
        break;
      case "anchors":
        next.anchors      = [value];
        next.anchors_conf = "high";
        break;
      default:
        break;
    }
    if (extraction.preferences?.length) {
      next.preferences = dedupeArr([...currentState.preferences, ...extraction.preferences]);
    }
    return next;
  }

  // ── RULE 1 + 3: field-by-field merge ────────────────────────────────────────

  // origin
  if (extraction.origin) {
    const newConf = extraction.confidence?.origin || "low";
    if (rank(newConf) > rank(currentState.origin_conf) || !currentState.origin) {
      next.origin      = extraction.origin;
      next.origin_conf = newConf;
    }
  }

  // destination — only null if trip_type is loop/exploration
  if (extraction.destination) {
    const newConf = extraction.confidence?.destination || "low";
    if (rank(newConf) > rank(currentState.destination_conf) || !currentState.destination) {
      next.destination      = extraction.destination;
      next.destination_conf = newConf;
    }
  }

  // trip_type — loop/exploration clears destination
  if (extraction.trip_type && extraction.trip_type !== currentState.trip_type) {
    next.trip_type = extraction.trip_type;
    if (extraction.trip_type === "loop" || extraction.trip_type === "exploration") {
      next.destination      = null;
      next.destination_conf = "high"; // "known to be null"
    }
  }

  // ── RULE 4: anchors — append new, preserve order, dedupe ────────────────────
  if (extraction.anchors?.length) {
    const newConf   = extraction.confidence?.anchors || "low";
    const existing  = currentState.anchors || [];
    const incoming  = extraction.anchors.filter(
      a => !existing.some(e => e.toLowerCase() === a.toLowerCase())
    );
    if (incoming.length > 0) {
      next.anchors      = [...existing, ...incoming];
      next.anchors_conf = newConf;
    }
  }

  // duration
  if (extraction.duration_type) {
    const newConf = extraction.confidence?.duration || "low";
    if (rank(newConf) >= rank(currentState.duration_conf) || !currentState.duration_type) {
      next.duration_type  = extraction.duration_type;
      next.duration_days  = extraction.duration_days  || null;
      next.duration_hours = extraction.duration_hours || null;
      next.duration_conf  = newConf;
    }
  }

  // transport_mode — NEVER accept low-confidence mode inference, NEVER invent
  // Part 3: Mode must be explicitly stated. "I wanna go from X to Y" has NO mode signal → skip.
  if (extraction.transport_mode) {
    const newConf = extraction.confidence?.mode || "low";
    // Only apply if HIGH confidence — strictly reject anything below
    if (newConf === "high" && (rank(newConf) > rank(currentState.mode_conf) || !currentState.transport_mode)) {
      next.transport_mode = normalizeMode(extraction.transport_mode);
      next.mode_conf      = newConf;
    }
  }

  // planning_intent — only upgrade, never downgrade
  if (extraction.planning_intent && !currentState.planning_intent) {
    next.planning_intent = extraction.planning_intent;
  }

  // driving_rhythm
  if (extraction.driving_rhythm && !currentState.driving_rhythm) {
    next.driving_rhythm = extraction.driving_rhythm;
  }

  // overnight_ok
  if (extraction.overnight_ok !== null && extraction.overnight_ok !== undefined && currentState.overnight_ok === null) {
    next.overnight_ok   = extraction.overnight_ok;
    next.overnight_conf = "high";
  }

  // preferences — always cumulative
  if (extraction.preferences?.length) {
    next.preferences = dedupeArr([...currentState.preferences, ...extraction.preferences]);
  }

  // ── Live trip and human context fields ───────────────────────────────────
  if (extraction.is_currently_traveling) {
    next.is_currently_traveling = true;
  }
  if (extraction.current_time_hint && !currentState.current_time_hint) {
    next.current_time_hint = extraction.current_time_hint;
  }
  if (extraction.arrival_time_hint && !currentState.arrival_time_hint) {
    next.arrival_time_hint = extraction.arrival_time_hint;
  }
  if (extraction.city_durations?.length) {
    // Merge city durations — add new cities, don't overwrite existing
    const existing = new Set((currentState.city_durations || []).map(c => c.city?.toLowerCase()));
    const newCities = extraction.city_durations.filter(c => !existing.has(c.city?.toLowerCase()));
    next.city_durations = [...(currentState.city_durations || []), ...newCities];
    // Auto-calculate total duration_days from city_durations if not set
    if (!next.duration_days && next.city_durations.length > 0) {
      const total = next.city_durations.reduce((sum, c) => sum + (c.days || 0), 0);
      if (total > 0) {
        next.duration_days = total;
        next.duration_type = "days";
        next.duration_conf = "high";
      }
    }
  }
  if (extraction.companions?.length) {
    const existingNames = new Set((currentState.companions || []).map(c => c.name?.toLowerCase()));
    const newCompanions = extraction.companions.filter(c => !existingNames.has(c.name?.toLowerCase()));
    next.companions = [...(currentState.companions || []), ...newCompanions];
  }
  if (extraction.group_energy && !currentState.group_energy) {
    next.group_energy = extraction.group_energy;
  }
  if (extraction.split_after && !currentState.split_after) {
    next.split_after  = extraction.split_after;
    next.split_details = extraction.split_details || null;
  }
  // Auto-set trip_type to multi_leg if we have multiple anchors
  if (!next.trip_type && next.anchors?.length >= 2) {
    next.trip_type = "multi_leg";
  }

  // ── POST-MERGE: auto-promote trip_type to MULTI_DAY ──────────────────────
  // If duration implies multi-day but trip_type is still point_to_point, promote it.
  // This must happen AFTER all field merges so the final duration value is used.
  if (
    next.duration_type === "days" &&
    next.duration_days >= 2 &&
    (next.trip_type === "point_to_point" || !next.trip_type)
  ) {
    next.trip_type = "MULTI_DAY";
  }

  // flight mode fields — only set, never unset
  if (extraction.flight_detected && !next.flight_detected) {
    next.flight_detected = true;
  }
  if (extraction.transport_primary && !next.transport_primary) {
    next.transport_primary = extraction.transport_primary;
  }
  if (extraction.transport_secondary && !next.transport_secondary) {
    next.transport_secondary = extraction.transport_secondary;
  }
  if (extraction.car_rental_intent !== undefined && extraction.car_rental_intent !== null && next.car_rental_intent === null) {
    next.car_rental_intent = extraction.car_rental_intent;
  }
  if (extraction.scenic_drive_offer !== undefined && extraction.scenic_drive_offer !== null && next.scenic_drive_offer === null) {
    next.scenic_drive_offer = extraction.scenic_drive_offer;
  }

  return next;
}

// ── Is this a long-distance route? ──────────────────────────────────────────
export function isLongDistanceRoute(state) {
  if (state.duration_type === "days" && state.duration_days >= 2) return true;
  if (state.duration_type === "days") return true;
  const LONG_DISTANCE_PAIRS = [
    ["amsterdam", "edinburgh"], ["amsterdam", "london"], ["amsterdam", "paris"],
    ["london", "edinburgh"], ["london", "glasgow"], ["london", "scotland"],
    ["paris", "madrid"], ["paris", "barcelona"], ["berlin", "london"],
    ["doha", "riyadh"], ["dubai", "abu dhabi"],
  ];
  const o = (state.origin || "").toLowerCase();
  const d = (state.destination || "").toLowerCase();
  return LONG_DISTANCE_PAIRS.some(([a, b]) =>
    (o.includes(a) && d.includes(b)) || (o.includes(b) && d.includes(a))
  );
}

// ── Is a flight scenario likely? ─────────────────────────────────────────────
// Heuristic: cross-continental or explicitly incompatible with driving.
// Does NOT auto-assign transport_primary — only signals that we should ask.
export function isFlightScenario(state) {
  // Already resolved — don't re-trigger
  if (state.transport_primary) return false;
  // User explicitly said drive → never flight mode
  if (state.transport_mode === "car" || state.transport_mode === "motorbike") return false;

  const o = (state.origin || "").toLowerCase();
  const d = (state.destination || "").toLowerCase();
  if (!o || !d) return false;

  // Known intercontinental or cross-sea pairs
  const FLIGHT_PAIRS = [
    // Europe → UK (or reverse) — not easily drivable
    ["doha", "london"], ["doha", "edinburgh"], ["doha", "paris"], ["doha", "rome"],
    ["doha", "berlin"], ["doha", "barcelona"], ["doha", "madrid"], ["doha", "amsterdam"],
    ["dubai", "london"], ["dubai", "edinburgh"], ["dubai", "paris"],
    ["riyadh", "london"], ["riyadh", "paris"], ["riyadh", "amsterdam"],
    ["new york", "london"], ["new york", "paris"], ["new york", "tokyo"],
    ["los angeles", "london"], ["los angeles", "paris"],
    ["sydney", "london"], ["sydney", "dubai"],
    ["toronto", "london"], ["toronto", "paris"],
    // UK → Europe (cross-sea, user may fly or drive — ask)
    ["london", "rome"], ["london", "lisbon"], ["london", "athens"],
    ["edinburgh", "barcelona"], ["edinburgh", "rome"], ["edinburgh", "paris"],
    // Middle East internal — some fly-worthy
    ["doha", "cairo"], ["doha", "istanbul"], ["doha", "beirut"],
  ];

  const matchesPair = FLIGHT_PAIRS.some(([a, b]) =>
    (o.includes(a) && d.includes(b)) || (o.includes(b) && d.includes(a))
  );

  // Also check if flight was signalled by the semantic layer
  const flightFlagged = state.flight_detected === true;

  return matchesPair || flightFlagged;
}

// ── Driving constraint for post-flight local planning ─────────────────────────
export function getLocalMobilityCharacter(state) {
  const sec = state.transport_secondary;
  if (!sec) return null;
  if (sec === "car" || sec === "motorbike") return "road_trip"; // full scenic/loop/country logic
  if (sec === "walk") return "city_walk";                       // dense stops, short radius
  if (sec === "public") return "hub_to_hub";                    // cities/towns, minimal detour
  return "road_trip";
}

// ── STATE VALIDATION ─────────────────────────────────────────────────────────
/**
 * getNextRequiredField(state)
 *
 * Returns the next field to ask about, or null if ready to build.
 *
 * Part 19 — EXACT PRIORITY ORDER:
 *   1. duration (UNKNOWN → always blocking — Clause 1)
 *   2. destination (if UNKNOWN and not EXPLORATION or LOOP)
 *   3. transport_mode (if road trip and mode unclear)
 *   4. driving_rhythm (if mode is drive or motorbike)
 *   5. trip_type (if loop vs point-to-point unclear)
 *   6. overnight_ok (if multi-day and not stated)
 *   7. flight_confirm → flight_intent → transport_secondary → scenic_drive_offer
 *
 * NEVER asks for a field already at >= MEDIUM confidence.
 */
export function getNextRequiredField(state) {
  const isLongDistance = isLongDistanceRoute(state);

  // MULTI-LEG SHORT CIRCUIT — if we have anchors with durations, we have enough
  // Never block a multi-leg trip on duration if city_durations are present
  const hasMultiLegData = (state.anchors?.length >= 1) &&
    (state.city_durations?.length > 0 || state.duration_days);
  if (hasMultiLegData && state.trip_type === "multi_leg") return null;

  // LIVE TRIP SHORT CIRCUIT — user is currently traveling, skip interrogation
  // They gave us the context we need, just plan it
  if (state.is_currently_traveling && state.anchors?.length >= 1) return null;

  // PRIORITY 1 — Duration always blocking (Clause 1)
  // EXCEPTION: if we have city_durations summing to a real number, use that
  const hasDuration = state.duration_type ||
    (Array.isArray(state.city_durations) && state.city_durations.length > 0);
  if (!hasDuration) return "duration";

  // PRIORITY 2 — Destination (unless loop/exploration/MULTI_DAY with destination known)
  const tripTypeKnown = state.trip_type === "loop" || state.trip_type === "exploration";
  const needsDest = !tripTypeKnown && !state.destination && state.destination_conf !== "high";
  if (needsDest) return "destination";

  // ── FLIGHT GATE — evaluate BEFORE ground transport_mode ───────────────────
  if (isFlightScenario(state) && !state.transport_primary) return "flight_confirm";
  if (state.transport_primary === "flight" && !state.flight_intent) return "flight_intent";
  if (state.transport_primary === "flight" && !state.transport_secondary) return "transport_secondary";
  if (state.transport_primary === "flight" && state.transport_secondary === "car" && state.scenic_drive_offer === null) {
    return "scenic_drive_offer";
  }

  // ── GROUND PATH ────────────────────────────────────────────────────────────

  // PRIORITY 3 — Transport mode (only for non-flight ground trips)
  if (state.transport_primary !== "flight" && !state.transport_mode) return "transport_mode";

  const activeMode = state.transport_primary === "flight"
    ? state.transport_secondary
    : state.transport_mode;
  const isDrivingMode = ["car", "motorbike", "bike"].includes(activeMode);
  const isRoadMode    = ["car", "motorbike"].includes(activeMode);

  // PRIORITY 4 — Driving rhythm (car/motorbike only)
  if (isRoadMode && !state.driving_rhythm) return "driving_rhythm";

  // PRIORITY 5 — Trip type (only if ambiguous — no loop/exploration/MULTI_DAY yet)
  // Skipped if trip_type is already set or clearly implied by destination
  // (destination present → POINT_TO_POINT is implied)

  // PRIORITY 6 — Overnight (multi-day driving, not yet asked)
  const isMultiDay = state.duration_type === "days" && (state.duration_days || 0) >= 2;
  if (isMultiDay && isDrivingMode && state.transport_primary !== "flight" && state.overnight_ok === null) {
    return "overnight_ok";
  }

  // Long-distance but not yet multi-day confirmed — ask overnight clarity
  if (isLongDistance && isDrivingMode && state.transport_primary !== "flight" && state.overnight_ok === null) {
    return "overnight_ok";
  }

  return null; // all required fields present — ready to show recap
}

/**
 * isStateReadyForRecap(state) — true when all required planning fields are present
 */
export function isStateReadyForRecap(state) {
  return getNextRequiredField(state) === null;
}

/**
 * buildStateDescription(state)
 *
 * Returns a plain English summary of the current state.
 * AI reads this — NOT the raw user text.
 */
export function buildStateDescription(state) {
  const parts = [];

  if (state.origin)      parts.push(`origin: ${state.origin}`);
  if (state.anchors?.length) parts.push(`stops through: ${state.anchors.join(", ")}`);
  if (state.destination) parts.push(`destination: ${state.destination}`);
  if (!state.destination && state.trip_type === "loop") parts.push("trip type: loop back to start");
  if (!state.destination && state.trip_type === "exploration") parts.push("trip type: open exploration, no fixed destination");

  if (state.duration_type === "flexible") {
    parts.push("duration: flexible");
  } else if (state.duration_type === "days" && state.duration_days) {
    parts.push(`duration: ${state.duration_days} day${state.duration_days !== 1 ? "s" : ""}`);
  } else if (state.duration_type === "hours" && state.duration_hours) {
    parts.push(`duration: ${state.duration_hours} hour${state.duration_hours !== 1 ? "s" : ""}`);
  }

  if (state.transport_primary === "flight") {
    parts.push("getting there: flying");
    if (state.transport_secondary) parts.push(`on arrival: ${state.transport_secondary}`);
    if (state.car_rental_intent) parts.push("renting a car on arrival");
    if (state.scenic_drive_offer === true) parts.push("wants scenic drive designed");
  } else {
    if (state.transport_mode) parts.push(`mode: ${state.transport_mode}`);
  }
  if (state.driving_rhythm) parts.push(`driving rhythm: ${state.driving_rhythm.replace("_", " ")}`);
  if (state.overnight_ok !== null) parts.push(`overnight ok: ${state.overnight_ok ? "yes" : "no"}`);
  if (state.time_preference)          parts.push(`time preference: ${state.time_preference}`);
  if (state.compactness)              parts.push(`walk style: ${state.compactness}`);
  if (state.day_pace)                 parts.push(`day pace: ${state.day_pace}`);
  if (state.transfer_tolerance)       parts.push(`transfer tolerance: ${state.transfer_tolerance}`);
  if (state.distance_tolerance)       parts.push(`distance tolerance: ${state.distance_tolerance}`);
  if (state.stop_density)             parts.push(`stop density: ${state.stop_density}`);
  if (state.style)                    parts.push(`trip style: ${state.style}`);
  if (state.drive_duration_preference) parts.push(`drive leg length: ${state.drive_duration_preference}`);
  if (state.preferences?.length) parts.push(`preferences: ${state.preferences.join(", ")}`);
  if (state.planning_intent) parts.push(`intent: ${state.planning_intent}`);

  // ── Live trip and human context ──────────────────────────────────────────
  if (state.is_currently_traveling) parts.push("STATUS: user is currently in transit right now");
  if (state.current_time_hint) parts.push(`current time: ${state.current_time_hint}`);
  if (state.arrival_time_hint) parts.push(`arrival time hint: ${state.arrival_time_hint}`);
  if (state.group_energy) parts.push(`group energy: ${state.group_energy}`);
  if (state.city_durations?.length) {
    const cd = state.city_durations.map(c => `${c.city}: ${c.days} day${c.days !== 1 ? "s" : ""}`).join(", ");
    parts.push(`city durations: ${cd}`);
  }
  if (state.companions?.length) {
    const comp = state.companions.map(c =>
      `${c.name} (${c.relation}${c.location ? ` in ${c.location}` : ""}${c.emotional_weight ? `, ${c.emotional_weight}` : ""})`
    ).join(", ");
    parts.push(`people: ${comp}`);
  }
  if (state.split_after) parts.push(`group splits at: ${state.split_after} — ${state.split_details || ""}`);

  return parts.join(" | ");
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeMode(raw) {
  if (!raw) return null;
  const r = raw.toLowerCase().trim();
  if (r === "car" || r === "drive" || r === "driving") return "car";
  if (r === "motorbike" || r === "motorcycle") return "motorbike";
  if (r === "walk" || r === "walking" || r === "foot") return "walk";
  if (r === "bike" || r === "cycle" || r === "cycling") return "bike";
  if (r === "train") return "train";
  if (r === "mixed") return "mixed";
  return r;
}

function applyDurationString(state, value) {
  const v = String(value).toLowerCase().trim();

  // ── NATURAL LANGUAGE DURATION NORMALIZATION ──────────────────────────────
  // Must run BEFORE numeric regex so "a week" doesn't fall through
  const naturalDays =
    /\b(a|one)\s+fortnight\b|\bfortnight\b/i.test(v)            ? 14 :
    /\btwo\s+weeks?\b/i.test(v)                                  ? 14 :
    /\b(a|one)\s+month\b/i.test(v)                              ? 30 :
    /\b(\d+)\s+months?\b/.test(v)                               ? parseInt(v.match(/(\d+)\s+months?/)[1]) * 30 :
    /\b(a|one)\s+week\b/i.test(v)                               ? 7  :
    /\bone\s+week\b/i.test(v)                                    ? 7  :
    /\bweek\b/i.test(v) && !/\d/.test(v)                        ? 7  :
    /\bweekend\b/i.test(v)                                       ? 2  :
    /\ba\s+couple\s+(of\s+)?days?\b/i.test(v)                   ? 2  :
    /\bcouple\s+(of\s+)?days?\b/i.test(v)                       ? 2  :
    /\ba\s+few\s+days?\b/i.test(v)                              ? 3  :
    /\bfew\s+days?\b/i.test(v)                                   ? 3  :
    null;

  if (naturalDays !== null) {
    state.duration_type  = "days";
    state.duration_days  = naturalDays;
    state.duration_hours = null;
    return;
  }

  // ── NUMERIC PATTERNS ──────────────────────────────────────────────────────
  const weeksMatch = v.match(/(\d+(?:\.\d+)?)\s*weeks?/);
  const daysMatch  = v.match(/(\d+(?:\.\d+)?)\s*days?/);
  const hoursMatch = v.match(/(\d+(?:\.\d+)?)\s*hours?/);

  if (weeksMatch) {
    state.duration_type  = "days";
    state.duration_days  = Math.round(parseFloat(weeksMatch[1]) * 7);
    state.duration_hours = null;
  } else if (daysMatch) {
    state.duration_type  = "days";
    state.duration_days  = parseFloat(daysMatch[1]);
    state.duration_hours = null;
  } else if (hoursMatch) {
    state.duration_type  = "hours";
    state.duration_hours = parseFloat(hoursMatch[1]);
    state.duration_days  = null;
  } else if (/flexible|open|no rush/i.test(v)) {
    state.duration_type  = "flexible";
    state.duration_days  = null;
    state.duration_hours = null;
  }
}

function dedupeArr(arr) {
  const seen = new Set();
  return arr.filter(item => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}