/**
 * userBehaviorProfile.js
 * USER BEHAVIOR MEMORY — persistent per-user travel preference profile.
 *
 * Uses the existing UserProfile entity.
 * Profile is loaded once at session start and updated after journey interactions.
 *
 * Preference update rules (Part 6):
 * - Each update nudges values by a small delta (not a hard flip)
 * - Confidence increases with repetition
 * - A single action never fully overrides a stable preference
 */

import { base44 } from "@/api/client";

// ── Defaults ──────────────────────────────────────────────────────────────────
export const EMPTY_PROFILE = {
  preferred_mode:           null,   // "car"|"motorbike"|"walk"|"bike"|"train"
  preferred_trip_length:    null,   // number (days) or null
  preferred_trip_type:      null,   // "loop"|"point_to_point"|"exploration"
  route_style_preference:   null,   // "scenic"|"efficient"|"balanced"
  stop_density_preference:  null,   // "low"|"medium"|"high"
  driving_rhythm_preference:null,   // "short_legs"|"balanced"|"long_legs"
  overnight_preference:     null,   // true|false|null
  avoid_highways_preference:false,
  avoid_tolls_preference:   false,
  favored_tags:             [],     // string[]
  disliked_tags:            [],     // string[]
  day_start_preference:     null,   // "early"|"flexible"|"later"
  night_driving_tolerance:  false,
  family_friendly_tendency: false,
  // Internal confidence map (field -> 0.0–1.0)
  _confidence: {},
};

// ── Load profile for current user ─────────────────────────────────────────────
export async function loadUserProfile(userId) {
  if (!userId) return { ...EMPTY_PROFILE };
  try {
    const rows = await base44.entities.UserProfile.filter({ user_id: userId });
    if (!rows?.length) return { ...EMPTY_PROFILE, user_id: userId };
    const row = rows[0];

    // Parse stored JSON fields
    const favored_tags   = tryParseJson(row.favored_tags,   []);
    const disliked_tags  = tryParseJson(row.disliked_tags,  []);
    const _confidence    = tryParseJson(row._confidence,    {});

    return {
      ...EMPTY_PROFILE,
      ...row,
      favored_tags,
      disliked_tags,
      _confidence,
      _record_id: row.id,
    };
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

// ── Save / update profile ─────────────────────────────────────────────────────
export async function saveUserProfile(userId, profile) {
  if (!userId) return;
  try {
    const payload = {
      user_id: userId,
      preferred_mode:            profile.preferred_mode,
      preferred_trip_length:     profile.preferred_trip_length,
      preferred_trip_type:       profile.preferred_trip_type,
      route_style_preference:    profile.route_style_preference,
      stop_density_preference:   profile.stop_density_preference,
      driving_rhythm_preference: profile.driving_rhythm_preference,
      overnight_preference:      profile.overnight_preference,
      avoid_highways_preference: profile.avoid_highways_preference,
      avoid_tolls_preference:    profile.avoid_tolls_preference,
      favored_tags:              JSON.stringify(profile.favored_tags || []),
      disliked_tags:             JSON.stringify(profile.disliked_tags || []),
      day_start_preference:      profile.day_start_preference,
      night_driving_tolerance:   profile.night_driving_tolerance,
      family_friendly_tendency:  profile.family_friendly_tendency,
      _confidence:               JSON.stringify(profile._confidence || {}),
      last_updated:              new Date().toISOString(),
    };

    if (profile._record_id) {
      await base44.entities.UserProfile.update(profile._record_id, payload);
    } else {
      await base44.entities.UserProfile.create(payload);
    }
  } catch {}
}

// ── Update profile from a completed journey state ─────────────────────────────
/**
 * updateProfileFromJourney(profile, journeyState)
 *
 * Applies deterministic accumulation rules after a journey is confirmed.
 * Nudge size = 0.2 per interaction (5 consistent interactions = full confidence).
 * Returns a NEW profile object.
 */
export function updateProfileFromJourney(profile, journeyState) {
  const next = deepClone(profile);
  const conf = { ...(next._confidence || {}) };

  const nudge = (field, value, weight = 0.2) => {
    // For string fields: if value matches current, raise confidence; if different, shift toward new
    const currentConf = conf[field] || 0;
    if (next[field] === value) {
      conf[field] = Math.min(1, currentConf + weight);
    } else if (currentConf < 0.4) {
      // Only switch if confidence is low
      next[field] = value;
      conf[field] = weight;
    } else {
      // High confidence in old value — just nudge confidence down slightly
      conf[field] = Math.max(0, currentConf - weight * 0.5);
    }
  };

  const appendTag = (arr, tag) => {
    if (!arr.includes(tag)) arr.push(tag);
    return arr;
  };

  // Transport mode
  if (journeyState.transport_mode) {
    nudge("preferred_mode", journeyState.transport_mode);
  }

  // Trip duration
  if (journeyState.duration_type === "days" && journeyState.duration_days) {
    next.preferred_trip_length = journeyState.duration_days;
    conf.preferred_trip_length = Math.min(1, (conf.preferred_trip_length || 0) + 0.15);
  }

  // Trip type
  if (journeyState.trip_type) {
    const mapped = journeyState.trip_type === "loop" ? "loop"
      : journeyState.trip_type === "exploration" ? "exploration"
      : "point_to_point";
    nudge("preferred_trip_type", mapped);
  }

  // Driving rhythm
  if (journeyState.driving_rhythm) {
    nudge("driving_rhythm_preference", journeyState.driving_rhythm);
  }

  // Overnight
  if (journeyState.overnight_ok !== null) {
    nudge("overnight_preference", journeyState.overnight_ok, 0.25);
  }

  // Route style from preferences
  const prefs = journeyState.preferences || [];
  if (prefs.includes("scenic") || prefs.includes("coastal") || prefs.includes("countryside")) {
    nudge("route_style_preference", "scenic");
  } else if (prefs.includes("efficient") || prefs.includes("fastest")) {
    nudge("route_style_preference", "efficient");
  }

  // Favored tags from preferences
  const TAGGABLE = ["pubs", "bakeries", "coffee", "history", "culture", "coastal", "countryside", "museums", "food", "hidden_gems", "nature", "art"];
  prefs.forEach(p => {
    if (TAGGABLE.includes(p)) {
      next.favored_tags = appendTag(next.favored_tags || [], p);
    }
  });

  next._confidence = conf;
  return next;
}

// ── Build a profile hint string for the AI ────────────────────────────────────
/**
 * buildProfileHint(profile)
 *
 * Returns a short natural language summary of known preferences for use
 * in the generateAck prompt. Only includes high-confidence fields.
 * Returns null if profile is too sparse.
 */
export function buildProfileHint(profile) {
  if (!profile) return null;
  const conf = profile._confidence || {};
  const parts = [];

  if (profile.preferred_mode && (conf.preferred_mode || 0) > 0.4) {
    parts.push(`usually travels by ${profile.preferred_mode}`);
  }
  if (profile.preferred_trip_length && (conf.preferred_trip_length || 0) > 0.3) {
    parts.push(`tends to prefer ${profile.preferred_trip_length}-day trips`);
  }
  if (profile.driving_rhythm_preference && (conf.driving_rhythm_preference || 0) > 0.4) {
    const labels = { short_legs: "frequent stops", balanced: "balanced rhythm", long_legs: "long stretches" };
    parts.push(`prefers ${labels[profile.driving_rhythm_preference] || profile.driving_rhythm_preference}`);
  }
  if (profile.route_style_preference && (conf.route_style_preference || 0) > 0.4) {
    parts.push(`favours ${profile.route_style_preference} routes`);
  }
  if (profile.overnight_preference === true && (conf.overnight_preference || 0) > 0.4) {
    parts.push("comfortable with overnight stops");
  }
  if (profile.overnight_preference === false && (conf.overnight_preference || 0) > 0.4) {
    parts.push("prefers day trips");
  }
  if (profile.favored_tags?.length > 0) {
    parts.push(`enjoys ${profile.favored_tags.slice(0, 3).join(", ")}`);
  }

  if (parts.length === 0) return null;
  return `Based on previous trips, this user ${parts.join(", ")}.`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function tryParseJson(val, fallback) {
  if (!val) return fallback;
  if (typeof val !== "string") return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}