/**
 * journeyExtractor.js
 * EXTRACTION LAYER — Deterministic parsing with rich context awareness.
 */

import { base44 } from "@/api/client";

export const EMPTY_EXTRACTION = {
  origin:           null,
  destination:      null,
  anchors:          [],
  city_durations:   [],       // [{city, days, arrival_time, departure_time}]
  duration_days:    null,
  duration_type:    null,
  duration_hours:   null,
  transport_mode:   null,
  trip_type:        null,
  preferences:      [],
  corrections:      null,
  planning_intent:  null,
  driving_rhythm:   null,
  overnight_ok:     null,
  // Live trip signals
  is_currently_traveling: false,  // user is on plane/train right now
  current_time_hint:      null,   // "10 AM Doha time"
  arrival_time_hint:      null,   // "will land in 5h" / "afternoon"
  // Human context
  companions:       [],           // [{name, relation, location, emotional_weight}]
  group_energy:     null,         // "wife asleep on plane" etc
  // Split plans
  split_after:      null,         // city where group splits
  split_details:    null,         // "wife goes to Peterborough alone"
  confidence: {
    origin:      "low",
    destination: "low",
    anchors:     "low",
    duration:    "low",
    mode:        "low",
  },
};

const EXTRACTION_PROMPT = `You are a deterministic travel intent parser for TukaPath.

GOLDEN RULE: Extract ONLY what is explicitly stated. Do NOT infer. Do NOT assume defaults.

════════════════════════════════════════════════════════════════

TRANSPORT MODE:
- "I'm driving" / "by car" → mode: "car", confidence: "high"
- "by motorbike" → mode: "motorbike", confidence: "high"  
- "walking" / "on foot" → mode: "walk", confidence: "high"
- "in the plane" / "flying" / "flight" → mode: "flight", confidence: "high"
- "train" / "Eurostar" / "rail" → mode: "train", confidence: "high"
- No mode mentioned → mode: null, confidence: "low"

LOCATION EXTRACTION:
- origin: "from X" / "leaving X" / "in X heading to" → extract, confidence "high"
- destination: "to Y" / "heading to Y" / "then to Y" → extract, confidence "high"
- anchors: ALL intermediate cities mentioned in order → array, confidence "high"
- "Amsterdam then London" → anchors: ["Amsterdam", "London"] or destination chain

CITY DURATIONS — CRITICAL:
- "2 days in Amsterdam" → city_durations: [{city:"Amsterdam", days:2}]
- "4 days in London" → city_durations: [{city:"London", days:4}]
- "two days Amsterdam then London" → city_durations: [{city:"Amsterdam",days:2}]
- "staying for two nights" → duration_days: 2, duration_type: "days"
- "land in afternoon" → arrival_time_hint: "afternoon"
- "time now is 10 AM Doha time" → current_time_hint: "10:00 Doha"
- "will land in 5h" → arrival_time_hint: "5 hours from now"
- "train at 10 AM for around 5 hours" → extract as departure constraint

DURATION EXTRACTION:
- Explicit days per city → sum for duration_days total, confidence "high"
- "3 days" / "2 weeks" → extract, confidence "high"
- Date ranges → calculate days difference, confidence "high"
- "two days Amsterdam then London" and "train day after at 10 AM" = minimum 2 days Amsterdam
- NOT mentioned → null, confidence "low"

LIVE TRIP SIGNALS — CRITICAL:
- "I am currently in the plane" / "on the plane" / "mid-flight" → is_currently_traveling: true
- "will land in 5h" / "landing soon" → is_currently_traveling: true
- "time now is X" → current_time_hint: extract time and timezone
- "think we will land in afternoon" → arrival_time_hint: "afternoon"

HUMAN CONTEXT — CRITICAL:
- Named people: "my friend Thierry in Birmingham, I miss him" →
  companions: [{name:"Thierry", relation:"friend", location:"Birmingham", emotional_weight:"miss_them"}]
- "my wife is currently [asleep/awake/tired/full of life]" →
  group_energy: extract state description
- "my wife will go alone to Peterborough" →
  split_after: "London", split_details: "wife goes to Peterborough alone"
- Relationship signals: "miss him" / "I owe them a visit" / "haven't seen in a while" →
  emotional_weight: "miss_them" / "obligation" / "long_time_no_see"

TRIP TYPE:
- Multiple cities with durations → trip_type: "multi_leg"
- Loop → trip_type: "loop"
- Simple A to B → trip_type: "point_to_point"

CORRECTIONS:
- "am not flying" → corrections: {field: "transport_mode", value: null}
- Otherwise → null

PREFERENCES: Extract ONLY if explicitly mentioned.

════════════════════════════════════════════════════════════════

EXAMPLES:

Input: "I am currently in the plane and will land in 5h in Amsterdam, time now is 10 AM Doha time, my wife is currently asleep so she will be awake by then and full of life. help me plan today and tomorrow, we will take a train from Amsterdam to London the day after at 10 AM"
Output: {
  "origin": "Doha",
  "destination": "London",
  "anchors": ["Amsterdam", "London"],
  "city_durations": [{"city": "Amsterdam", "days": 2}],
  "duration_days": 2,
  "duration_type": "days",
  "transport_mode": "flight",
  "is_currently_traveling": true,
  "current_time_hint": "10:00 Doha",
  "arrival_time_hint": "5 hours from now, afternoon",
  "group_energy": "wife asleep on plane, will be energetic on arrival",
  "trip_type": "multi_leg",
  "planning_intent": "FULL_PLANNING_REQUIRED",
  "confidence": {"origin":"high","destination":"high","anchors":"high","duration":"high","mode":"high"}
}

Input: "traveling from Doha to Amsterdam for two days and then to the UK, mainly London but I need to see my friend Thierry in Birmingham, I miss him"
Output: {
  "origin": "Doha",
  "destination": "London",
  "anchors": ["Amsterdam", "London", "Birmingham"],
  "city_durations": [{"city": "Amsterdam", "days": 2}],
  "duration_days": 2,
  "duration_type": "days",
  "transport_mode": "flight",
  "companions": [{"name": "Thierry", "relation": "friend", "location": "Birmingham", "emotional_weight": "miss_them"}],
  "trip_type": "multi_leg",
  "planning_intent": "FULL_PLANNING_REQUIRED",
  "confidence": {"origin":"high","destination":"high","anchors":"high","duration":"high","mode":"medium"}
}`;

export async function extractJourneyEntities(userText) {
  if (!userText?.trim()) return { ...EMPTY_EXTRACTION };

  try {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `${EXTRACTION_PROMPT}\n\nUser input: "${userText.trim()}"`,
      response_json_schema: {
        type: "object",
        properties: {
          origin:                 { type: ["string", "null"] },
          destination:            { type: ["string", "null"] },
          anchors:                { type: "array", items: { type: "string" } },
          city_durations:         { type: "array" },
          duration_days:          { type: ["number", "null"] },
          duration_type:          { type: ["string", "null"] },
          duration_hours:         { type: ["number", "null"] },
          transport_mode:         { type: ["string", "null"] },
          trip_type:              { type: ["string", "null"] },
          preferences:            { type: "array", items: { type: "string" } },
          corrections:            { type: ["object", "null"] },
          planning_intent:        { type: ["string", "null"] },
          driving_rhythm:         { type: ["string", "null"] },
          overnight_ok:           { type: ["boolean", "null"] },
          is_currently_traveling: { type: "boolean" },
          current_time_hint:      { type: ["string", "null"] },
          arrival_time_hint:      { type: ["string", "null"] },
          companions:             { type: "array" },
          group_energy:           { type: ["string", "null"] },
          split_after:            { type: ["string", "null"] },
          split_details:          { type: ["string", "null"] },
          confidence:             { type: "object" },
        },
      },
    });

    
    const r = result || {};
    return {
      origin:                 r.origin          || null,
      destination:            r.destination     || null,
      anchors:                Array.isArray(r.anchors) ? r.anchors.filter(Boolean) : [],
      city_durations:         Array.isArray(r.city_durations) ? r.city_durations : [],
      duration_days:          typeof r.duration_days  === "number" ? r.duration_days  : null,
      duration_type:          r.duration_type   || null,
      duration_hours:         typeof r.duration_hours === "number" ? r.duration_hours : null,
      transport_mode:         r.transport_mode  || null,
      trip_type:              r.trip_type       || null,
      preferences:            Array.isArray(r.preferences) ? r.preferences.filter(Boolean) : [],
      corrections:            r.corrections?.field ? r.corrections : null,
      planning_intent:        r.planning_intent || null,
      driving_rhythm:         r.driving_rhythm  || null,
      overnight_ok:           typeof r.overnight_ok === "boolean" ? r.overnight_ok : null,
      is_currently_traveling: !!r.is_currently_traveling,
      current_time_hint:      r.current_time_hint  || null,
      arrival_time_hint:      r.arrival_time_hint  || null,
      companions:             Array.isArray(r.companions) ? r.companions : [],
      group_energy:           r.group_energy    || null,
      split_after:            r.split_after     || null,
      split_details:          r.split_details   || null,
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
