/**
 * archetypeEngine.js — Part 5 of TukaPath AI Concierge System
 *
 * Classifies trip archetype IMMEDIATELY after parsing.
 * Evaluated in strict rule order. Re-evaluated silently on state change.
 *
 * ARCHETYPES:
 *   MICRO_ESCAPE      → quick escape, hours-only, high stop density
 *   DAY_EXPLORER      → full day, no overnight, time blocks
 *   JOURNEY_BUILDER   → multi-day, overnights required, skeleton-first
 *   TRANSIT_OPTIMIZER → getting there efficiently, minimal stops
 *   EXPLORER_MODE     → open adventure, no fixed destination
 *   FLIGHT_LED        → flight as primary transit
 *   UNRESOLVED        → duration unknown — must ask before proceeding
 */

// ── ARCHETYPE CONSTANTS ───────────────────────────────────────────────────────
export const ARCHETYPES = {
  MICRO_ESCAPE:       "MICRO_ESCAPE",
  DAY_EXPLORER:       "DAY_EXPLORER",
  JOURNEY_BUILDER:    "JOURNEY_BUILDER",
  TRANSIT_OPTIMIZER:  "TRANSIT_OPTIMIZER",
  EXPLORER_MODE:      "EXPLORER_MODE",
  FLIGHT_LED:         "FLIGHT_LED",
  UNRESOLVED:         "UNRESOLVED",
};

export const ARCHETYPE_LABELS = {
  MICRO_ESCAPE:       "Quick escape",
  DAY_EXPLORER:       "Day out",
  JOURNEY_BUILDER:    "Multi-day journey",
  TRANSIT_OPTIMIZER:  "Getting there",
  EXPLORER_MODE:      "Open adventure",
  FLIGHT_LED:         "Fly & explore",
  UNRESOLVED:         "Planning your trip",
};

// ── DETECTION ENGINE ─────────────────────────────────────────────────────────
/**
 * detectArchetype(state)
 *
 * Evaluates rules in priority order (Part 5 spec).
 * Returns { archetype, confidence, label }
 */
export function detectArchetype(state) {
  const {
    trip_type, duration_type, duration_days, duration_hours,
    transport_mode, transport_primary, destination,
    preferences = [], planning_intent,
  } = state;

  const durationDays  = duration_days  || null;
  const durationHours = duration_hours || null;
  const hasDuration   = !!duration_type;

  const isEfficient   = preferences.some(p => /fastest|quickest|direct|efficient/i.test(p))
    || /efficient|direct|fastest/i.test(planning_intent || "");
  const hasScenicIntent = preferences.some(p => /scenic|wander|discover|coastal|countryside/i.test(p));

  // RULE 1 — EXPLORATION OVERRIDE
  if (
    trip_type === "exploration" ||
    (destination == null && trip_type !== "loop" && !state.origin && !hasDuration)
  ) {
    return { archetype: ARCHETYPES.EXPLORER_MODE, confidence: "high", label: ARCHETYPE_LABELS.EXPLORER_MODE };
  }

  // RULE — FLIGHT_LED (transport_primary = flight)
  if (transport_primary === "flight") {
    return { archetype: ARCHETYPES.FLIGHT_LED, confidence: "high", label: ARCHETYPE_LABELS.FLIGHT_LED };
  }

  // RULE 2 — TRANSIT SIGNAL
  if (destination && isEfficient && !hasScenicIntent) {
    return { archetype: ARCHETYPES.TRANSIT_OPTIMIZER, confidence: "high", label: ARCHETYPE_LABELS.TRANSIT_OPTIMIZER };
  }

  // RULE 3 — IMMEDIATE HIGH CONFIDENCE (all Tier 1 present including overnight)
  const hasOvernight = state.overnight_ok === true || (durationDays != null && durationDays >= 2);
  if (state.origin && destination && hasOvernight) {
    return { archetype: ARCHETYPES.JOURNEY_BUILDER, confidence: "high", label: ARCHETYPE_LABELS.JOURNEY_BUILDER };
  }

  // RULE 7 — DURATION UNKNOWN → UNRESOLVED (blocking)
  if (!hasDuration) {
    return { archetype: ARCHETYPES.UNRESOLVED, confidence: "low", label: ARCHETYPE_LABELS.UNRESOLVED };
  }

  // RULE 4 — DURATION PRIMARY
  if (duration_type === "hours") {
    if (durationHours != null && durationHours <= 4) {
      return { archetype: ARCHETYPES.MICRO_ESCAPE, confidence: "high", label: ARCHETYPE_LABELS.MICRO_ESCAPE };
    }
    return { archetype: ARCHETYPES.DAY_EXPLORER, confidence: "high", label: ARCHETYPE_LABELS.DAY_EXPLORER };
  }

  if (duration_type === "days") {
    if (durationDays != null && durationDays >= 2) {
      // RULE 5 — TRIP TYPE ADJUSTMENT
      if (trip_type === "loop") {
        return { archetype: ARCHETYPES.JOURNEY_BUILDER, confidence: "high", label: ARCHETYPE_LABELS.JOURNEY_BUILDER };
      }
      return { archetype: ARCHETYPES.JOURNEY_BUILDER, confidence: "high", label: ARCHETYPE_LABELS.JOURNEY_BUILDER };
    }
    if (durationDays === 1) {
      if (trip_type === "loop") {
        return { archetype: ARCHETYPES.DAY_EXPLORER, confidence: "high", label: ARCHETYPE_LABELS.DAY_EXPLORER };
      }
      return { archetype: ARCHETYPES.DAY_EXPLORER, confidence: "high", label: ARCHETYPE_LABELS.DAY_EXPLORER };
    }
  }

  // RULE 6 — INTENT SOFT OVERRIDE
  if (hasScenicIntent && destination == null) {
    return { archetype: ARCHETYPES.EXPLORER_MODE, confidence: "medium", label: ARCHETYPE_LABELS.EXPLORER_MODE };
  }
  if (isEfficient) {
    return { archetype: ARCHETYPES.TRANSIT_OPTIMIZER, confidence: "medium", label: ARCHETYPE_LABELS.TRANSIT_OPTIMIZER };
  }

  // FLEXIBLE — default to JOURNEY_BUILDER if has origin + destination, else UNRESOLVED
  if (state.origin && destination) {
    return { archetype: ARCHETYPES.JOURNEY_BUILDER, confidence: "medium", label: ARCHETYPE_LABELS.JOURNEY_BUILDER };
  }

  return { archetype: ARCHETYPES.UNRESOLVED, confidence: "low", label: ARCHETYPE_LABELS.UNRESOLVED };
}

// ── PLANNING PROFILE RETRIEVAL ────────────────────────────────────────────────
/**
 * getPlanningProfile(archetype, mode)
 *
 * Returns archetype-specific planning parameters for the Journey Brain (Part 7).
 */
export function getPlanningProfile(archetype, mode) {
  const isMotorbike = mode === "motorbike";

  const profiles = {
    [ARCHETYPES.MICRO_ESCAPE]: {
      overnight: false,
      segmentation: "none",
      stop_density: "high",
      stops_total: [2, 5],
      dwell_style: "short",
      radius_km: [5, 15],
      day_structure: false,
      daily_drive_max_hours: null,
    },
    [ARCHETYPES.DAY_EXPLORER]: {
      overnight: false,
      segmentation: "time_blocks",         // morning / midday / afternoon
      stop_density: "medium",
      stops_per_day: [3, 6],
      dwell_style: "medium",
      spacing_minutes: [60, 120],
      transit_cap_pct: 0.40,
      day_structure: false,
      daily_drive_max_hours: isMotorbike ? 4.5 : 8,
    },
    [ARCHETYPES.JOURNEY_BUILDER]: {
      overnight: true,
      overnight_required: true,
      segmentation: "by_day",
      stop_density: "medium",
      stops_per_day: isMotorbike ? [2, 3] : [3, 4],
      dwell_style: isMotorbike ? "medium" : "long",
      day_structure: true,
      build_order: [
        "route_skeleton",
        "overnight_cities",
        "segment_by_days",
        "assign_anchors",
        "stop_strategy",
        "stop_selection",
      ],
      daily_drive_max_hours: isMotorbike ? 4.5 : 6,
      daily_drive_max_km: isMotorbike ? 300 : 500,
    },
    [ARCHETYPES.TRANSIT_OPTIMIZER]: {
      overnight: false,           // only if drive > 8h
      segmentation: "none",
      stop_density: "low",
      stops_total: [1, 3],
      dwell_style: "short",
      corridor_width_km: [10, 15],
      detour_tolerance_min: 10,
      day_structure: false,
      daily_drive_max_hours: 8,
    },
    [ARCHETYPES.EXPLORER_MODE]: {
      overnight: null,            // depends on duration
      segmentation: "if_multi_day",
      stop_density: "moderate",
      stops_per_day: [4, 6],
      dwell_style: "long",
      ordering: "narrative",
      day_structure: false,
      daily_drive_max_hours: isMotorbike ? 4.5 : 7,
    },
    [ARCHETYPES.FLIGHT_LED]: {
      overnight: true,
      segmentation: "by_day",
      stop_density: "medium",
      stops_per_day: [2, 4],
      dwell_style: "medium",
      day_structure: true,
      note: "Ground leg only — flight is a transition not a route leg",
    },
    [ARCHETYPES.UNRESOLVED]: null,
  };

  return profiles[archetype] || null;
}

// ── SEGMENT COUNT SCALING (Part 22) ──────────────────────────────────────────
/**
 * getRequiredSegmentCount(durationDays)
 * Returns minimum segment count for validation gate.
 */
export function getRequiredSegmentCount(durationDays) {
  if (!durationDays || durationDays < 2) return 1;
  if (durationDays <= 7)  return durationDays;
  if (durationDays <= 14) return Math.max(7, Math.ceil(durationDays * 0.85));
  if (durationDays <= 30) return Math.max(12, Math.ceil(durationDays * 0.7));
  return Math.max(20, Math.ceil(durationDays * 0.6));
}

// ── MIN STOPS PER DAY (Part 22) ───────────────────────────────────────────────
export function getMinStopsPerDay(archetype, mode) {
  if (archetype === ARCHETYPES.TRANSIT_OPTIMIZER) return 0.15; // ~1-2 total
  if (mode === "motorbike") return 2;
  if (mode === "walk")      return 3;
  return 2; // driving default
}