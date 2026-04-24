# TukaPath — Journey Wrapper Architecture Spec
**Version:** 1.0 — Locked  
**Date:** 2026-04-16  
**Status:** Reference spec. Do not implement without referencing this document.

---

## 1. NORMALIZED INTERPRETED REQUEST (NIR)

> The single, canonical object produced by input interpretation. The Journey engine MUST accept this and ONLY this. Nothing from raw form state or GPT output should bypass this layer.

```json
{
  "origin": {
    "name": "string",
    "lat": "number",
    "lng": "number",
    "source": "user_typed | gps | voice | inferred"
  },

  "destination": {
    "name": "string | null",
    "lat": "number | null",
    "lng": "number | null",
    "source": "user_typed | voice | inferred | null",
    "confirmed": "boolean"
  },

  "trip_type": "point_to_point | loop | open_ended",

  "mode": "drive | walk | motorcycle",

  "time_mode": "fixed | paced | flexible | inferred",
  "time_value": "number | null",
  "pacing": "fast | balanced | exploratory | null",

  "route_flexibility": "direct | mild_detour | scenic | any",

  "stop_preferences": {
    "must_include_types": ["coffee", "scenic", "sunset", "cultural", "food", "hidden"],
    "avoid_types": ["highway_stop", "tourist_trap"],
    "preferred_density": "sparse | moderate | rich | null"
  },

  "scenic_priority": "low | medium | high",
  "weather_sensitivity": "none | mild | high",

  "constraints": {
    "avoid_highways": "boolean",
    "avoid_tolls": "boolean",
    "max_detour_km": "number | null",
    "must_arrive_by": "string | null",
    "departure_time": "string | null"
  },

  "themes": ["scenic", "cultural", "coffee", "sunset", "countryside", "coastal", "history", "art"],

  "raw_input": {
    "description_text": "string",
    "voice_transcript": "string | null"
  },

  "confidence": {
    "origin_confidence": "high | medium | low",
    "destination_confidence": "high | medium | low | none",
    "time_confidence": "high | medium | low | none",
    "intent_confidence": "high | medium | low"
  }
}
```

### NIR Rules
- `trip_type = loop` when destination is null or destination === origin
- `trip_type = point_to_point` when origin ≠ destination and both confirmed
- `pacing` is always set by `TimeIntelligence` — never inferred from description alone
- `time_value` in minutes. Never a string. `null` = engine infers from route
- `confidence.destination_confidence = "none"` when no destination provided
- All downstream layers (Blueprint, Scoring, Rendering) read from NIR only

---

## 2. JOURNEY BLUEPRINT SCHEMA

> The blueprint sits between the NIR and the scoring engine. It translates intent → journey character. One blueprint per trip. Produced at the start of `buildJourneyV2`.

```json
{
  "blueprint_key": "string",

  "trip_type": "point_to_point | loop | open_ended",
  "pacing": "fast | balanced | exploratory",

  "stop_density": {
    "ideal_stops": "number",
    "min_stops": "number",
    "max_stops": "number"
  },

  "detour_tolerance": {
    "hard_limit_minutes": "number",
    "soft_limit_minutes": "number",
    "tradeoff_threshold_score": "number"
  },

  "experience_goal": "efficient_journey | rich_journey | discovery | relaxed_exploration",

  "route_character_bias": {
    "prefer_scenic_roads": "boolean",
    "prefer_coastal": "boolean",
    "prefer_mountain": "boolean",
    "prefer_rural": "boolean",
    "urban_penalty": "number"
  },

  "stop_role_priority": [
    "anchor",
    "character",
    "support",
    "bonus"
  ],

  "scarcity_behavior": {
    "on_insufficient_stops": "relax_detour | widen_radius | reduce_count | fail_partial",
    "partial_threshold": "number"
  },

  "mode_adjustments": {
    "mode": "drive | walk | motorcycle",
    "overrides": {}
  }
}
```

### Blueprint Catalog (key → character)

| Key | trip_type | pacing | experience_goal |
|---|---|---|---|
| `fast_drive` | point_to_point | fast | efficient_journey |
| `scenic_drive` | point_to_point | balanced | rich_journey |
| `scenic_drive_exploratory` | point_to_point | exploratory | discovery |
| `loop_relaxed` | loop | balanced | relaxed_exploration |
| `loop_fast` | loop | fast | efficient_journey |
| `moto_road` | point_to_point | exploratory | discovery |
| `walk_urban` | loop | balanced | rich_journey |

---

### Motorcycle Mode Adjustments

When `mode = motorcycle`, the blueprint receives these overrides on top of the base blueprint:

```json
"mode_adjustments": {
  "mode": "motorcycle",
  "overrides": {
    "scenic_weighting_boost": 1.4,
    "route_character_bias": {
      "prefer_scenic_roads": true,
      "prefer_mountain": true,
      "prefer_coastal": true,
      "urban_penalty": 2.5
    },
    "route_flow_preference": "continuous_curves",
    "stop_density": {
      "ideal_stops": "reduce_by_1",
      "min_stops": 1,
      "reason": "Riders prefer minimal interruption to road flow"
    },
    "detour_tolerance": {
      "hard_limit_minutes": 10,
      "soft_limit_minutes": 6,
      "reason": "Detours break flow; only take high-value diversions"
    },
    "stop_type_preference": {
      "prefer": ["scenic", "viewpoint", "coastal", "mountain_pass"],
      "deprioritize": ["coffee_chain", "mall", "urban_district"]
    },
    "comfort_fatigue_pacing": {
      "max_continuous_drive_minutes": 90,
      "enforce_rest_stop_after_minutes": 90,
      "rest_stop_type": "scenic | petrol | cafe"
    },
    "road_character_importance": "critical"
  }
}
```

**Motorcycle Scoring Effects (applied during candidate scoring):**
- `scenic_score × 1.4`
- `urban_location_score × 0.4`
- Road-quality / road-character score contributes to ranking (future field)
- Stops with `category = coffee_chain | mall | shopping` are excluded entirely
- Preferred: mountain passes, coastal roads, viewpoints, rural rest stops

---

## 3. JOURNEY STOP VIEW MODEL

> An adapter layer between the Journey engine output and the location card renderer. The card receives `existing_card_payload` only — zero journey logic inside the card.

```json
{
  "journey_stop_view_model": {
    "stop_index": "number",
    "section": "route_stops | arrival_suggestions | departure_suggestions",

    "section_role": "anchor | character | support | bonus | arrival | departure",

    "stop_role": {
      "key": "anchor | character | support | bonus",
      "label": "string",
      "display_color": "string"
    },

    "display_reason": "string",

    "detour_label": "string | null",

    "dwell_label": "string | null",

    "highlight_level": "hero | featured | standard | ambient",

    "is_hero": "boolean",

    "existing_card_payload": {
      "location": "Location entity object (unchanged)",
      "stop_story_hook": "string",
      "stop_duration_minutes": "number",
      "stop_name": "string"
    }
  }
}
```

### View Model Rules

| Field | Rule |
|---|---|
| `display_reason` | Plain English. e.g. "A perfect viewpoint 4 min off-route" or "Your anchor stop for this journey" |
| `detour_label` | null if stop is on-route. Otherwise: "4 min off-route" |
| `dwell_label` | "~20 min stop" — derived from `stop_duration_minutes` |
| `highlight_level` | `hero` = first anchor. `featured` = named character stops. `standard` = support. `ambient` = bonus |
| `is_hero` | true only for stop_index 0 of type anchor |
| `existing_card_payload` | Exact current location card props — zero change to card component |

### Adapter Contract
- Produced by `buildViewModels(stops, blueprint)` — a pure function
- Input: raw engine stops + blueprint context
- Output: array of `JourneyStopViewModel`
- Card component: receives only `existing_card_payload` — no blueprint, no section, no journey state

---

## 4. DEDUPLICATION + SECTION RENDERING RULES

### Section Priority
```
1. route_stops          ← highest priority, always shown if present
2. arrival_suggestions  ← shown if arrival_stops present
3. departure_suggestions ← shown if departure_stops present
```

### Deduplication Rules

```
RULE 1 — Global ID deduplication
  A location_id may appear in ONLY ONE section.
  Priority: route_stops > arrival_suggestions > departure_suggestions
  On duplicate: remove from lower-priority section silently

RULE 2 — Proximity deduplication
  Two stops within 300m of each other collapse into one.
  Keep: the one with higher section priority.
  If same section: keep the one with higher highlight_level.

RULE 3 — Name similarity deduplication
  Stops whose names share ≥ 80% fuzzy match AND are in the same city → deduplicate.
  Apply after ID and proximity deduplication.

RULE 4 — No carry-through
  A stop removed in route_stops MUST NOT reappear in arrival_suggestions or departure_suggestions.
  Engine must track a `used_location_ids` set per journey.
```

### Section Visibility Rules

```
SHOW a section if:
  - It has ≥ 1 valid stop after deduplication

HIDE a section if:
  - It is empty after deduplication

REPLACE empty section with explanation block if:
  - result_status = "partial" AND section is arrival_suggestions or departure_suggestions
  - explanation_block.text = "We couldn't find ideal stops near [origin/destination]. 
     Try adding a theme or increasing your time."

NEVER show:
  - An empty section heading with no stops below it
  - A section with stops that were already shown above
```

### result_status Behavior

| result_status | Meaning | Wrapper behavior |
|---|---|---|
| `complete` | All sections populated with quality stops | Render all sections normally |
| `partial` | route_stops ok but arrival/departure thin | Show route_stops + partial note banner |
| `arrival_only` | Only arrival suggestions found | Show arrival section + explanation for missing route stops |
| `minimal` | 1–2 stops only, below ideal_stops | Show stops + "We found a short but meaningful journey" note |
| `empty` | No stops found at all | Show full error state, prompt to change input |

### Wrapper Behavior Per Status

```
complete       → render normally. No banner.
partial        → render route_stops. Show amber partial_note banner above arrival/departure.
arrival_only   → skip route_stops section. Show arrival section. Show banner: "We focused on your destination area."
minimal        → render all stops found. Show info banner: "Short journey — quality over quantity."
empty          → render error state. Do not render any stop section.
```

---

## RECOMMENDED WRAPPER LAYER ARCHITECTURE

```
JourneyInput
  └─ produces FormState

FormState → NIR Adapter (lib/buildNIR.js)
  └─ produces NormalizedInterpretedRequest

NormalizedInterpretedRequest → Journey Engine (buildJourneyV2)
  ├─ selects Blueprint
  ├─ applies mode_adjustments (motorcycle etc.)
  ├─ runs scoring
  └─ returns raw JourneyOutput { stops, sections, result_status, partial_note }

JourneyOutput → ViewModel Adapter (lib/buildViewModels.js)
  └─ produces JourneyStopViewModel[]

JourneyStopViewModel[] → JourneyStops (UI)
  └─ renders section groups
     └─ each stop → LocationCard (existing, unchanged)
        └─ receives existing_card_payload only
```

### Minimal Structural Files Needed

| File | Role | Status |
|---|---|---|
| `lib/buildNIR.js` | FormState → NIR | New |
| `lib/buildViewModels.js` | Engine output → ViewModel[] | New |
| `lib/blueprints.js` | Blueprint catalog + mode overrides | Extract from buildJourneyV2 |
| `lib/sectionRules.js` | Dedup + section rendering logic | New |

### What Does NOT Change
- `LocationCard` component — zero changes
- `JourneyStops` — only change: receives `JourneyStopViewModel[]` instead of raw stops
- `buildJourneyV2` scoring logic — unchanged until scoring spec is locked separately

---

*End of spec. Next step: implement `lib/buildNIR.js` and `lib/buildViewModels.js` once confirmed.*