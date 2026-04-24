/**
 * contextualQuestionEngine.js — TukaPath Question Library V1
 *
 * 3-tier question system that fires AFTER required fields are collected,
 * BEFORE the recap card. Max 3 questions per session.
 *
 * TIER 1 (blocking) — origin, destination, duration, trip_type: handled by journeyStateMachine.
 * CQE covers Tier 2 gaps + all of Tier 3.
 *
 * Priority: high → medium → low
 * Rules:
 *   - Ask only ONE question per turn
 *   - Max 3 before recap (rest handled in refinement)
 *   - Skip if already answered or clearly implied
 *   - Never ask if not impactful
 */

import { base44 } from "@/api/client";

// ── QUESTION LIBRARY (Part 19 — full spec) ───────────────────────────────────
// Maps directly to Q-* identifiers in the system prompt.

const CQE_LIBRARY = [

  // ══════════════════════════════════════════════════════════════════════════
  // DRIVING RHYTHM — Q-RHY-01 / Q-RHY-02 (high priority, blocks quality)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "Q-RHY-01",
    tier: 3,
    priority: "high",
    modes: ["car"],
    question: "How do you like to pace your driving?",
    chips: [
      { label: "Short bursts — stop often",       value: "short_legs" },
      { label: "2–3 hours then a good break",     value: "balanced"   },
      { label: "Longer stretches, fewer stops",   value: "long_legs"  },
    ],
    state_field: "driving_rhythm",
    skip_if: (state, signals) =>
      !!state.driving_rhythm || signals.impliedRelaxed || signals.impliedAmbitious,
  },

  {
    id: "Q-RHY-02",
    tier: 3,
    priority: "high",
    modes: ["motorbike"],
    question: "How long do you like to ride before a proper stop?",
    chips: [
      { label: "1 hour max",     value: "short_legs" },
      { label: "1.5–2 hours",    value: "balanced"   },
      { label: "2–3 hours",      value: "long_legs"  },
    ],
    state_field: "driving_rhythm",
    skip_if: (state, signals) =>
      !!state.driving_rhythm || signals.impliedRelaxed || signals.impliedAmbitious,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // WALK COMPACTNESS — high priority for walk mode
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "Q-WALK-01",
    tier: 3,
    priority: "high",
    modes: ["walk"],
    question: "Do you want stops close together or are you happy exploring wider areas on foot?",
    chips: [
      { label: "Keep things close together",   value: "compact"    },
      { label: "Happy to explore wider areas", value: "spread_out" },
    ],
    state_field: "compactness",
    skip_if: (state, signals) => !!state.compactness || signals.impliedCompact,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TIME OF DAY — Q-TIME-01 (medium, multi-day only)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "Q-TIME-01",
    tier: 3,
    priority: "medium",
    modes: ["car", "motorbike", "walk"],
    min_days: 2,
    question: "Are you heading out now or at a specific time?",
    chips: [
      { label: "Leaving now",       value: "now"       },
      { label: "This morning",      value: "morning"   },
      { label: "This afternoon",    value: "afternoon" },
      { label: "Tomorrow",          value: "tomorrow"  },
    ],
    state_field: "time_preference",
    skip_if: (state) => !!state.time_preference || state.duration_type === "hours",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // STOP DENSITY (medium priority)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "Q-DEN-01",
    tier: 3,
    priority: "medium",
    question: "Do you want a packed route with lots of stops or something more relaxed?",
    chips: [
      { label: "Packed — lots of stops",         value: "packed"   },
      { label: "Relaxed — fewer, longer stops",  value: "relaxed"  },
      { label: "A mix of both",                  value: "balanced" },
    ],
    state_field: "stop_density",
    skip_if: (state, signals) =>
      !!state.stop_density || signals.impliedRelaxed || signals.impliedAmbitious,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TRIP STYLE (medium, skip if preferences already supplied)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "Q-STY-01",
    tier: 3,
    priority: "medium",
    question: "What kind of trip are you in the mood for?",
    chips: [
      { label: "Scenic & nature",       value: "scenic"   },
      { label: "Cultural & historic",   value: "cultural" },
      { label: "Food & local life",     value: "food"     },
      { label: "Mix of everything",     value: "mixed"    },
    ],
    state_field: "style",
    skip_if: (state) =>
      !!state.style ||
      (state.preferences || []).some(p =>
        /scenic|cultural|food|nature|history|historic|mix|pubs|bakeries|castles/i.test(p)
      ),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // MULTI-DAY PACE (low, car/motorbike, 3+ days)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "Q-PAC-01",
    tier: 3,
    priority: "low",
    modes: ["car", "motorbike"],
    min_days: 3,
    question: "Relaxed days covering less ground, or push further each day?",
    chips: [
      { label: "Relaxed — fewer km per day",    value: "relaxed"   },
      { label: "Cover more ground each day",    value: "ambitious" },
    ],
    state_field: "day_pace",
    skip_if: (state, signals) =>
      !!state.day_pace || !!state.driving_rhythm || signals.impliedRelaxed || signals.impliedAmbitious,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TRANSIT / PUBLIC TRANSPORT (medium)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "Q-TRN-01",
    tier: 3,
    priority: "medium",
    modes: ["train", "public"],
    question: "Do you want to keep transfers minimal, or okay with a few changes to reach better places?",
    chips: [
      { label: "Minimal transfers please",             value: "low_transfers" },
      { label: "Fine with changes for better spots",   value: "flexible"      },
    ],
    state_field: "transfer_tolerance",
    skip_if: (state) => !!state.transfer_tolerance,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CYCLING DISTANCE (medium)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "Q-CYC-01",
    tier: 3,
    priority: "medium",
    modes: ["bike"],
    question: "How far are you comfortable cycling per day?",
    chips: [
      { label: "Easy — 30–50 km/day",       value: "easy"     },
      { label: "Moderate — 60–100 km/day",  value: "moderate" },
      { label: "Challenging — 100+ km/day", value: "hard"     },
    ],
    state_field: "distance_tolerance",
    skip_if: (state) => !!state.distance_tolerance,
  },

];

// ── IMPLIED PREFERENCE SIGNALS ────────────────────────────────────────────────

const IMPLIED_RELAXED   = /\b(relaxed?|easy|slow|leisure|chill|no rush|take it easy)\b/i;
const IMPLIED_AMBITIOUS = /\b(quick|fast|efficient|cover|long drive|push|ambitious)\b/i;
const IMPLIED_COMPACT   = /\b(close|compact|walking distance|nearby|small area)\b/i;

function getImpliedSignals(rawInputHistory = []) {
  const joined = rawInputHistory.join(" ");
  return {
    impliedRelaxed:   IMPLIED_RELAXED.test(joined),
    impliedAmbitious: IMPLIED_AMBITIOUS.test(joined),
    impliedCompact:   IMPLIED_COMPACT.test(joined),
  };
}

// ── ELIGIBILITY CHECK ─────────────────────────────────────────────────────────

function isQuestionEligible(q, state, signals) {
  // Skip if state field already set (custom skip_if predicate)
  if (q.skip_if && q.skip_if(state, signals)) return false;

  // Mode filter — null means "any mode"
  if (q.modes) {
    const activeMode = state.transport_primary === "flight"
      ? (state.transport_secondary || null)
      : (state.transport_mode || null);
    if (!q.modes.includes(activeMode)) return false;
  }

  // Min days filter
  if (q.min_days) {
    if (!(state.duration_type === "days" && state.duration_days >= q.min_days)) return false;
  }

  return true;
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────

/**
 * getNextCQEQuestion(state, alreadyAsked, rawInputHistory)
 *
 * Returns the next CQE question or null.
 * Max 3 questions per session.
 *
 * Returns: { id, question, chips, state_field } | null
 */
export async function getNextCQEQuestion(state, alreadyAsked = [], rawInputHistory = []) {
  const MAX_QUESTIONS = 3;
  if (alreadyAsked.length >= MAX_QUESTIONS) return null;

  const signals = getImpliedSignals(rawInputHistory);

  // Scan library in priority order: high → medium → low
  const priorityOrder = ["high", "medium", "low"];
  for (const priority of priorityOrder) {
    for (const q of CQE_LIBRARY) {
      if (q.priority !== priority) continue;
      if (alreadyAsked.includes(q.id)) continue;
      if (isQuestionEligible(q, state, signals)) {
        return { id: q.id, question: q.question, chips: q.chips, state_field: q.state_field };
      }
    }
  }

  // GPT fallback — only when library has nothing useful and budget remains
  try {
    const fallback = await generateFallbackQuestion(state, alreadyAsked);
    if (fallback) {
      return {
        id: "gpt_fallback_" + Date.now(),
        question: fallback,
        chips: null,
        state_field: "preferences",
        is_fallback: true,
      };
    }
  } catch {}

  return null;
}

// ── GPT FALLBACK ──────────────────────────────────────────────────────────────

async function generateFallbackQuestion(state, alreadyAsked) {
  const lines = [];
  if (state.origin)           lines.push(`from: ${state.origin}`);
  if (state.destination)      lines.push(`to: ${state.destination}`);
  if (state.duration_days)    lines.push(`days: ${state.duration_days}`);
  if (state.transport_mode)   lines.push(`mode: ${state.transport_mode}`);
  if (state.preferences?.length) lines.push(`preferences: ${state.preferences.join(", ")}`);

  const prompt = `You are TukaPath, a travel planning assistant.

Current trip state:
${lines.join("\n") || "(minimal info)"}

Questions already asked: ${alreadyAsked.length > 0 ? alreadyAsked.join(", ") : "none"}

Task: Decide if there is ONE genuinely useful clarifying question that would meaningfully improve journey planning.

Rules:
- If you cannot think of a question that would CHANGE the plan, respond with exactly: NULL
- Ask only about things that affect stop density, pacing, or route character
- Do NOT ask about budget, accommodation stars, food preferences, or things already known
- Do NOT recap the trip, do NOT ask multiple questions
- 1 sentence, conversational
- NEVER start with "I see", "Got it", "Sure!", "Of course!"

Response: Either a single natural question sentence, or exactly: NULL`;

  const res = await base44.integrations.Core.InvokeLLM({ prompt });
  const text = (typeof res === "string" ? res : String(res)).trim();
  if (!text || /^null$/i.test(text)) return null;
  if (text.split("?").filter(Boolean).length > 1) return null;
  return text;
}

// ── APPLY CQE ANSWER ──────────────────────────────────────────────────────────

/**
 * applyCQEAnswer(state, stateField, chipValue)
 * Merges a CQE answer back into journey state.
 */
export function applyCQEAnswer(state, stateField, chipValue) {
  const next = { ...state };
  if (stateField === "preferences") {
    next.preferences = [...(state.preferences || []), chipValue];
  } else {
    next[stateField] = chipValue;
  }
  return next;
}