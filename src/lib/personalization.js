// ─────────────────────────────────────────────────────────────────────────────
// personalization.js
//
// Client-side helpers:
//   - resolvePersonalizationWeights(profile) → weights injected into journey
//   - getPersonalizationHint(profile, context) → subtle UI hint string
//   - trackJourneyEvent(event_type, payload) → fire-and-forget to backend
// ─────────────────────────────────────────────────────────────────────────────

import { base44 } from '@/api/client';

// ── Weight resolution ─────────────────────────────────────────────────────────
// Converts the stored profile into engine-injectable parameters.
// Influence is soft: 20–40% blend toward the learned preference.
// Always returns safe defaults if no profile exists.

export function resolvePersonalizationWeights(profile) {
  if (!profile || !profile.personalization_enabled) {
    return { applied: false };
  }

  const INFLUENCE = 0.30; // 30% personalization weight

  // Stop count modifiers
  const stopToleranceMap = { low: -1, medium: 0, high: +1 };
  const stopMod = stopToleranceMap[profile.stop_tolerance] || 0;

  // Detour tolerance → detour hard limit modifier (minutes)
  const detourMap = { low: -5, medium: 0, high: +8 };
  const detourMod = detourMap[profile.detour_tolerance] || 0;

  // Pacing → pace mode override suggestion
  const pacingMap = { fast: 'fast', balanced: null, exploratory: 'exploratory' };
  const suggestedPacing = pacingMap[profile.preferred_pacing] || null;

  // Scoring weight adjustments (multipliers on top of blueprint defaults)
  const scenic_weight_mult  = 1 + (profile.scenic_preference - 0.5) * INFLUENCE * 2;
  const culture_weight_mult = 1 + (profile.culture_preference - 0.5) * INFLUENCE * 2;
  const food_weight_mult    = 1 + (profile.food_preference - 0.5) * INFLUENCE * 2;

  // Missed opportunity threshold modifier
  const detourThresholdMult = profile.detour_tolerance === 'high' ? 0.85
    : profile.detour_tolerance === 'low' ? 1.20 : 1.0;

  return {
    applied: true,
    suggested_mode: profile.preferred_mode !== 'drive' ? profile.preferred_mode : null,
    suggested_pacing: suggestedPacing,
    stop_count_modifier: stopMod,
    detour_hard_limit_modifier_minutes: detourMod,
    scoring_weights: {
      scenic_weight_mult:  Math.round(scenic_weight_mult * 100) / 100,
      culture_weight_mult: Math.round(culture_weight_mult * 100) / 100,
      food_weight_mult:    Math.round(food_weight_mult * 100) / 100,
    },
    missed_opp_threshold_mult: detourThresholdMult,
    fatigue_sensitivity: profile.fatigue_sensitivity,
    journey_count: profile.journey_count || 0,
  };
}

// ── Soft hint generation ──────────────────────────────────────────────────────
// Returns a subtle hint string or null. Only shown after 3+ journeys.

export function getPersonalizationHint(profile) {
  if (!profile || !profile.personalization_enabled) return null;
  if ((profile.journey_count || 0) < 3) return null;

  const hints = [];

  if (profile.stop_tolerance === 'low') hints.push("Keeping this one lighter, like your previous trips.");
  if (profile.stop_tolerance === 'high') hints.push("Added more stops — you tend to like exploring.");
  if (profile.scenic_preference >= 0.75) hints.push("Prioritising scenic spots, based on your preferences.");
  if (profile.culture_preference >= 0.75) hints.push("Leaning cultural — that's your style.");
  if (profile.detour_tolerance === 'high') hints.push("A few off-route detours included — you've accepted them before.");
  if (profile.detour_tolerance === 'low') hints.push("Keeping to the route — minimal detours.");
  if (profile.preferred_pacing === 'fast') hints.push("Moving at your preferred pace — efficient route.");
  if (profile.preferred_pacing === 'exploratory') hints.push("Left room to wander — you like that.");

  if (hints.length === 0) return null;
  // Pick one randomly — feels natural, not algorithmic
  return hints[Math.floor(Math.random() * hints.length)];
}

// ── Event tracker ─────────────────────────────────────────────────────────────
// Fire-and-forget — never blocks the UI.

export async function trackJourneyEvent(event_type, payload = {}) {
  try {
    await base44.functions.invoke('updateUserProfile', { event_type, payload });
  } catch {
    // Silent fail — personalization is non-critical
  }
}