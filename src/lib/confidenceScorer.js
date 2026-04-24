/**
 * confidenceScorer.js — Part 4 of TukaPath AI Concierge System
 *
 * Computes a combined parsing completeness score after extraction.
 * Used to determine how many questions to ask before recap.
 *
 * TIER 1 (weight 0.7): origin, destination, duration
 * TIER 2 (weight 0.3): mode, overnight, trip_type
 *
 * THRESHOLDS:
 *   >= 0.70 AND duration HIGH → skip all questions → recap
 *   >= 0.50, one Tier 1 missing → ask that one question
 *   >= 0.30, two Tier 1 missing → ask highest priority
 *   < 0.30 → full adaptive interview
 */

/**
 * scoreState(state)
 *
 * Returns:
 * {
 *   combined_score: 0–1,
 *   tier1_score: 0–1,
 *   tier2_score: 0–1,
 *   duration_high: boolean,
 *   ready_for_recap: boolean,
 *   missing_tier1: string[],
 *   missing_tier2: string[],
 * }
 */
export function scoreState(state) {
  const CONF_MET = (conf) => conf === "high" || conf === "medium";

  // ── TIER 1 — HARD fields ──────────────────────────────────────────────────
  const tier1Fields = [
    { key: "origin",      met: !!(state.origin && CONF_MET(state.origin_conf)) },
    { key: "destination", met: !!(
        state.destination && CONF_MET(state.destination_conf)
      ) || state.trip_type === "loop" || state.trip_type === "exploration"
    },
    { key: "duration",    met: !!(state.duration_type && CONF_MET(state.duration_conf)) },
  ];

  const tier1Met    = tier1Fields.filter(f => f.met).length;
  const tier1Score  = tier1Met / tier1Fields.length;
  const missingTier1 = tier1Fields.filter(f => !f.met).map(f => f.key);

  // ── TIER 2 — STRUCTURAL fields ────────────────────────────────────────────
  // Only count fields relevant to current context
  const tier2Fields = [];

  // mode: relevant if ground trip is road-oriented
  const isGroundRoad = state.transport_primary !== "flight";
  if (isGroundRoad) {
    tier2Fields.push({
      key: "transport_mode",
      met: !!(state.transport_mode && CONF_MET(state.mode_conf)),
    });
  }

  // overnight: relevant if duration >= 2 days
  const daysKnown = state.duration_type === "days" && state.duration_days >= 2;
  if (daysKnown) {
    tier2Fields.push({
      key: "overnight_ok",
      met: state.overnight_ok !== null,
    });
  }

  // trip_type
  if (state.origin && state.destination) {
    tier2Fields.push({
      key: "trip_type",
      met: !!(state.trip_type),
    });
  }

  const tier2Met    = tier2Fields.length > 0 ? tier2Fields.filter(f => f.met).length : 1;
  const tier2Denom  = tier2Fields.length || 1;
  const tier2Score  = tier2Met / tier2Denom;
  const missingTier2 = tier2Fields.filter(f => !f.met).map(f => f.key);

  // ── COMBINED SCORE ─────────────────────────────────────────────────────────
  const combinedScore = (tier1Score * 0.7) + (tier2Score * 0.3);

  // Duration HIGH check (Clause 1 — never build on MEDIUM/LOW)
  const durationHigh = state.duration_conf === "high";

  // Ready for recap: >= 0.70 AND duration HIGH
  const readyForRecap = combinedScore >= 0.70 && durationHigh;

  return {
    combined_score: combinedScore,
    tier1_score: tier1Score,
    tier2_score: tier2Score,
    duration_high: durationHigh,
    ready_for_recap: readyForRecap,
    missing_tier1: missingTier1,
    missing_tier2: missingTier2,
  };
}

/**
 * getInterviewDepth(score)
 * Returns interview strategy based on combined score.
 */
export function getInterviewDepth(score) {
  const s = score.combined_score;
  if (score.ready_for_recap)   return "recap";
  if (s >= 0.70)                return "one_question";   // duration not HIGH yet
  if (s >= 0.50)                return "one_question";   // one Tier 1 missing
  if (s >= 0.30)                return "priority_question";
  return "full_interview";
}