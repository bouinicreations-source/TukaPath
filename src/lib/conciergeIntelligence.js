/**
 * conciergeIntelligence.js
 * 
 * THE INTELLIGENCE LAYER — replaces the entire extraction + state machine + generateAck pipeline.
 * 
 * Every user message goes to GPT-4o with one focused prompt.
 * Returns: structured extraction + suggested response + planning readiness.
 * 
 * Caches results in Supabase to reduce API calls and improve over time.
 */

import { base44 } from '@/api/client';
import { supabase } from '@/api/supabase';

// ── Cache helpers ─────────────────────────────────────────────────────────────

function normalizeForCache(text) {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

async function checkCache(normalizedInput, conversationHash) {
  try {
    const { data } = await supabase
      .from('concierge_response_cache')
      .select('*')
      .eq('input_hash', conversationHash)
      .gte('confidence_score', 0.85)
      .order('use_count', { ascending: false })
      .limit(1);
    return data?.[0] || null;
  } catch { return null; }
}

async function saveToCache(normalizedInput, conversationHash, result) {
  try {
    await supabase.from('concierge_response_cache').upsert({
      input_hash: conversationHash,
      normalized_input: normalizedInput,
      extraction: result.extraction,
      suggested_response: result.suggested_response,
      confidence_score: result.response_confidence === 'high' ? 0.9 : 0.7,
      use_count: 1,
      last_used: new Date().toISOString(),
    }, { onConflict: 'input_hash' });
  } catch {}
}

// ── Simple hash for cache key ─────────────────────────────────────────────────

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ── The master prompt ─────────────────────────────────────────────────────────

function buildMasterPrompt(userMessage, conversationHistory, currentState) {
  const historyText = conversationHistory.length > 0
    ? `\nCONVERSATION HISTORY:\n${conversationHistory.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n')}\n`
    : '';

  const stateText = currentState && Object.keys(currentState).length > 0
    ? `\nCURRENT UNDERSTOOD STATE:\n${JSON.stringify(currentState, null, 2)}\n`
    : '';

  return `You are the intelligence engine for TukaPath, an AI travel concierge app.
A traveler sent a message. Do TWO things: extract structured data AND suggest the ideal response.

${historyText}${stateText}
NEW MESSAGE FROM TRAVELER: "${userMessage}"

════════════════════════════════════════════════════════════════════════════════
EXTRACTION FIELDS — extract everything mentioned, null for anything not mentioned:

TRIP STRUCTURE:
- origin: {city, country} — where they are traveling FROM
- anchor_chain: ORDERED array of cities in travel sequence — CRITICAL: preserve exact order mentioned
  Example: "Doha to Amsterdam then London" → ["Doha", "Amsterdam", "London"]
- destinations: array of {city, country, days, arrival_time, departure_time, arrival_date}
  CRITICAL: first destination in anchor_chain = first destination visited
- total_days: total trip duration number
- split_points: [{city, who_splits, where_they_go}]

TRANSPORT:
- primary_transport: "flight"/"train"/"car"/"walk"/null
- flights_booked: true/false/null
- trains_booked: [{from, to, date, time, duration_hours}]
- on_arrival_transport: "car"/"public"/"walk"/null

TIMING:
- currently_traveling: true/false — is the person IN TRANSIT RIGHT NOW?
- current_location: where they physically are right now
- current_time_with_timezone: e.g. "10:00 Doha time (UTC+3)"
- hours_until_arrival: number if mentioned
- arrival_time_local: calculated arrival time at first destination
- departure_constraints: [{city, type, time, date}]

PEOPLE:
- traveling_with: [{name, relation, current_state, energy_level, split_destination}]
  current_state examples: "asleep on plane", "excited", "tired"
- people_to_visit: [{name, relation, city, emotional_weight, urgency}]
  emotional_weight: "miss_them"/"obligation"/"excited_to_see"/"long_time_no_see"

CORRECTIONS — CRITICAL:
- is_correction: true/false — did they correct something from previous messages?
- corrects_field: which field is being corrected
- corrected_value: the correct value
- previous_wrong_value: what was previously understood incorrectly
- correction_note: plain English explanation of what changed

PREFERENCES:
- pace: "fast"/"balanced"/"relaxed"/null
- style: array of ["scenic","cultural","food","nature","history","nightlife","local","tourist"]
- budget_signal: "budget"/"mid"/"comfort"/"luxury"/null
- special_requests: array of specific requests

PERSONALITY SIGNALS:
- formality: 1-5 (1=very formal, 5=very casual)
- energy: "excited"/"tired"/"stressed"/"relaxed"/"neutral"
- uses_swearing: true/false
- humor_receptive: true/false
- signature_phrases: array of notable phrases used

MISSING INFO:
- blocking_questions: array of {field, question, why_it_matters, priority}
  priority 1 = most blocking, 5 = nice to have
  ONLY include questions that would meaningfully change the plan
  NEVER ask about something already in the extraction

════════════════════════════════════════════════════════════════════════════════
RESPONSE RULES — the suggested_response field:

1. If is_correction=true: FIRST acknowledge the correction explicitly
   Example: "Amsterdam first, then London — noted, I had that backwards."

2. If currently_traveling=true: Skip all interrogation
   - Calculate arrival time from current_time + hours_until_arrival
   - Reference traveling companions by name and state
   - Move straight to planning

3. Lead with what you understood — show you read the whole message
4. Reference specific names, times, feelings from their message
5. Ask maximum ONE question — highest priority blocking question only
6. If planning_ready=true: confirm you are building the plan, no question needed
7. Maximum 3 sentences
8. Match their energy — if casual, be casual. If excited, be warm.

BANNED OPENERS: "Got it" / "Sure" / "Absolutely" / "Of course" / "I see" / "I understand" / "That sounds" / "Great" / "Perfect" / "Wonderful" / "Amazing"

GOOD OPENER PATTERNS:
- Start with a specific fact you extracted: "Amsterdam first, then London—"
- Start with their situation: "You're mid-flight right now—"
- Start with a correction acknowledgement: "Amsterdam not London — fixed."
- Start with a time calculation: "Landing around 15:00 Amsterdam time—"

════════════════════════════════════════════════════════════════════════════════
PLANNING READY RULES:
Set planning_ready=true when ALL of these are known:
- At least one destination
- Duration (days or dates that imply duration)
- Transport mode (or clearly implied)
- No critical blocking questions remain

════════════════════════════════════════════════════════════════════════════════
RETURN VALID JSON ONLY — no markdown, no preamble:
{
  "extraction": {
    "origin": {"city": null, "country": null},
    "anchor_chain": [],
    "destinations": [],
    "total_days": null,
    "split_points": [],
    "primary_transport": null,
    "flights_booked": null,
    "trains_booked": [],
    "on_arrival_transport": null,
    "currently_traveling": false,
    "current_location": null,
    "current_time_with_timezone": null,
    "hours_until_arrival": null,
    "arrival_time_local": null,
    "departure_constraints": [],
    "traveling_with": [],
    "people_to_visit": [],
    "is_correction": false,
    "corrects_field": null,
    "corrected_value": null,
    "previous_wrong_value": null,
    "correction_note": null,
    "pace": null,
    "style": [],
    "budget_signal": null,
    "special_requests": [],
    "formality": 3,
    "energy": "neutral",
    "uses_swearing": false,
    "humor_receptive": false,
    "signature_phrases": [],
    "blocking_questions": []
  },
  "suggested_response": "The response to display to the traveler",
  "response_confidence": "high",
  "planning_ready": false,
  "internal_notes": "anything system should know but not show user"
}`;
}

// ── Main intelligence call ────────────────────────────────────────────────────

export async function processMessage(userMessage, conversationHistory = [], currentState = {}) {
  const normalized = normalizeForCache(userMessage);
  const cacheKey = simpleHash(normalized + JSON.stringify(currentState).slice(0, 100));

  // Check cache first
  const cached = await checkCache(normalized, cacheKey);
  if (cached) {
    // Update use count
    supabase.from('concierge_response_cache')
      .update({ use_count: cached.use_count + 1, last_used: new Date().toISOString() })
      .eq('input_hash', cacheKey)
      .then(() => {});
    return {
      ...cached.extraction,
      suggested_response: cached.suggested_response,
      planning_ready: cached.extraction?.planning_ready || false,
      from_cache: true,
    };
  }

  // Call GPT-4o via worker
  const prompt = buildMasterPrompt(userMessage, conversationHistory, currentState);

  try {
    const result = await base44.functions.invoke('intelligenceCall', {
      prompt,
      model: 'gpt-4o',
    });

    console.log('[intelligence] raw result:', result);

    if (!result || result.error) {
      throw new Error(result?.error || 'Intelligence call failed');
    }

    // Save to cache
    await saveToCache(normalized, cacheKey, result);

    return result;
  } catch (e) {
    console.error('[conciergeIntelligence] Error:', e.message, e);
    return {
      extraction: {
        anchor_chain: [],
        destinations: [],
        is_correction: false,
        blocking_questions: [],
        currently_traveling: false,
      },
      suggested_response: null,
      planning_ready: false,
      error: e.message,
    };
  }
}

// ── State merger — merges GPT extraction into running state ──────────────────

export function mergeIntelligenceResult(currentState, result) {
  const ext = result.extraction || {};
  const next = { ...currentState };

  // Handle corrections first — they override everything
  if (ext.is_correction && ext.corrects_field) {
    next._last_correction = {
      field: ext.corrects_field,
      from: ext.previous_wrong_value,
      to: ext.corrected_value,
    };
  }

  // Anchor chain — always use the new one if it is longer or a correction
  if (ext.anchor_chain?.length > 0) {
    if (ext.is_correction || ext.anchor_chain.length >= (currentState.anchor_chain?.length || 0)) {
      next.anchor_chain = ext.anchor_chain;
    }
  }

  // Origin
  if (ext.origin?.city && !currentState.origin) {
    next.origin = ext.origin.city;
  }

  // Destinations
  if (ext.destinations?.length > 0) {
    next.destinations = ext.is_correction ? ext.destinations : (currentState.destinations?.length > 0 ? currentState.destinations : ext.destinations);
  }

  // Duration
  if (ext.total_days && !currentState.total_days) {
    next.total_days = ext.total_days;
    next.duration_days = ext.total_days;
    next.duration_type = 'days';
  }

  // Transport
  if (ext.primary_transport && !currentState.primary_transport) {
    next.primary_transport = ext.primary_transport;
    next.transport_mode = ext.primary_transport;
  }

  // Live trip signals
  if (ext.currently_traveling) {
    next.currently_traveling = true;
    next.current_time_hint = ext.current_time_with_timezone;
    next.arrival_time_hint = ext.arrival_time_local;
    next.hours_until_arrival = ext.hours_until_arrival;
  }

  // People
  if (ext.traveling_with?.length > 0) {
    next.traveling_with = ext.traveling_with;
    next.group_energy = ext.traveling_with.map(p => `${p.name}: ${p.current_state || p.energy_level || 'unknown'}`).join(', ');
  }
  if (ext.people_to_visit?.length > 0) {
    const existing = new Set((currentState.people_to_visit || []).map(p => p.name?.toLowerCase()));
    const newPeople = ext.people_to_visit.filter(p => !existing.has(p.name?.toLowerCase()));
    next.people_to_visit = [...(currentState.people_to_visit || []), ...newPeople];
    // Also merge into companions for backwards compat
    next.companions = next.people_to_visit;
  }

  // Split points
  if (ext.split_points?.length > 0) {
    next.split_points = ext.split_points;
    next.split_after = ext.split_points[0]?.city;
    next.split_details = ext.split_points[0]?.who_splits + ' goes to ' + ext.split_points[0]?.where_they_go;
  }

  // Trains
  if (ext.trains_booked?.length > 0) {
    next.trains_booked = ext.trains_booked;
    // Extract departure constraints from trains
    next.departure_constraints = ext.trains_booked.map(t => ({
      city: t.from,
      type: 'train_departure',
      time: t.time,
      destination: t.to,
      duration_hours: t.duration_hours,
    }));
  }

  // Preferences
  if (ext.style?.length > 0) {
    next.preferences = [...new Set([...(currentState.preferences || []), ...ext.style])];
  }
  if (ext.pace) next.day_pace = ext.pace;
  if (ext.budget_signal) next.budget_tier = ext.budget_signal;

  // Personality signals — accumulate
  if (ext.formality) next.formality_score = ext.formality;
  if (ext.energy) next.current_energy = ext.energy;
  if (ext.uses_swearing) next.swear_tolerance = 2;
  if (ext.humor_receptive) next.humour_score = 3;

  // Planning readiness
  next.planning_ready = result.planning_ready || false;
  next.blocking_questions = ext.blocking_questions || [];

  return next;
}