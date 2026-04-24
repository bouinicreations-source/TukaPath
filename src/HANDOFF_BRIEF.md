# TukaPath AI Concierge — Complete Handoff Brief

## Project Overview
**Goal**: AI-powered scenic journey planning system (drives, multi-day trips, scenic routes)
**Tech Stack**: React 18 + Vite + Tailwind + TypeScript, Base44 backend-as-a-service
**Users**: Travelers planning road trips from origin to destination with scenic stops

---

## Core Architecture

### Frontend Structure
```
src/
├── pages/
│   ├── AIConcierge.jsx          (Main concierge chat interface)
│   ├── Home.jsx                 (Landing page)
│   ├── LocationDetail.jsx        (Stop details)
│   ├── AdventureFinder.jsx       (Journey discovery)
│   └── [other pages]
├── components/
│   ├── concierge/
│   │   ├── ConciergeChat.jsx    (Chat thread + input handler)
│   │   ├── ConciergeJourneyView.jsx (Journey visualization + refinement)
│   │   ├── RefinementBar.jsx    (Quick refinement chips)
│   │   └── FlightRouterCard.jsx (Flight vs ground routing)
│   ├── layout/
│   │   └── AppLayout.jsx        (Main layout wrapper)
│   └── ui/                       (shadcn components)
├── lib/
│   ├── journeyExtractor.js      (LLM → extraction schema)
│   ├── journeyStateMachine.js   (State merge logic + validation)
│   ├── inputClassifier.js       (Input class detection: A/B/C/D/E)
│   ├── semanticNormalizer.js    (Deterministic signal extraction)
│   ├── contextualQuestionEngine.js (Adaptive questioning)
│   ├── archetypeEngine.js       (Trip type classification)
│   ├── confidenceScorer.js      (State readiness scoring)
│   ├── userBehaviorProfile.js   (User preference tracking)
│   └── intentClassifier.js      (Flight vs journey intent)
├── functions/
│   ├── buildConciergeJourney.js (V3 minimum truth engine)
│   ├── transcribeAudio.js       (Voice-to-text)
│   ├── auditConciergeInteraction.js (Logging)
│   └── [other backend functions]
├── entities/
│   ├── Journey.json             (Trip record)
│   ├── JourneyLeg.json          (Per-day segments)
│   ├── JourneyStop.json         (Individual stops)
│   ├── JourneyHotel.json        (Hotel suggestions)
│   ├── Location.json            (Place database)
│   ├── LocationTranslation.json (Multi-language support)
│   ├── ConciergeAuditLog.json   (Concierge interaction logs)
│   └── [20+ other entities]
├── App.jsx                       (Router + auth wrapper)
├── index.css                     (Design tokens)
├── tailwind.config.js           (Theme configuration)
└── main.jsx                      (Entry point)
```

---

## Critical User Flow (Concierge Pipeline)

### Phase 1: Chat Interview
**File**: `ConciergeChat.jsx`
- User inputs free-text journey description
- Input Classification (inputClassifier.js):
  - CLASS_A: Journey data → parse normally
  - CLASS_B: Correction → apply correction + continue
  - CLASS_C: Frustration → empathetic response, no parsing
  - CLASS_D: Trivial (yes/no) → treat as confirmation
  - CLASS_E: Meta-question → answer, re-offer state

### Phase 2: Extraction & State Merge
**Files**: `journeyExtractor.js`, `journeyStateMachine.js`
1. **Deterministic Extraction**: LLM extracts ONLY explicitly stated fields
   - CRITICAL: Mode requires HIGH confidence, never invent defaults
   - Returns: origin, destination, duration, mode, preferences with confidence levels
2. **Semantic Normalization**: Pattern-based signal extraction (no AI)
3. **State Merge**: Confidence-ranked merge into journey state
4. **Validation**: Check required fields for next question via `getNextRequiredField()`

### Phase 3: Question Engine
**File**: `contextualQuestionEngine.js`
- Priority order: duration → destination → mode → driving_rhythm → overnight_ok → flight_confirm
- Max 3 questions before forcing recap
- Skip logic based on state confidence and user signals

### Phase 4: Journey Building
**File**: `buildConciergeJourney.js` (1800+ lines)
- Google Geocoding: resolve origin/destination to lat/lng
- Region Resolution: "the lakes" → real towns
- Route Shaping: Google Directions API with semantic waypoints
- Truth Check: validate route_character label against geometry
- Drive Blocks: segment route by max drive time (120min car, 90min motorbike)
- Stop Selection: corridor search on Location DB, filter by suitability score
- Corridor Enrichment: if <3 stops found, fetch from Google Places + generate stories (AI)
- Validation Gate: reject if segment count <2 for multi-day, daily km >550
- Persistence: save Journey → JourneyLeg[] → JourneyStop[] + JourneyHotel[]

### Phase 5: Refinement
**File**: `ConciergeJourneyView.jsx`
- Custom refinement text routes back to ConciergeChat via sessionStorage
- Semantic chips trigger partial re-planning

---

## State Object Structure

```javascript
{
  // ── CORE ROUTE ───────────────────
  origin: "Milan",                    // HIGH confidence
  origin_conf: "high",
  destination: "Amsterdam",           // HIGH confidence
  destination_conf: "high",
  anchors: ["Lake District"],         // user-stated stops
  
  // ── DURATION ──────────────────────
  duration_type: "days",              // "hours"|"days"|"flexible"
  duration_days: 3,
  duration_hours: null,
  duration_conf: "high",
  
  // ── TRANSPORT ─────────────────────
  transport_mode: null,               // UNKNOWN → ask Q-MOD-01
  mode_conf: "low",                   // CRITICAL: low=null
  
  // ── FLIGHT MODE (optional) ────────
  transport_primary: "flight",        // "flight"|"drive"|null
  flight_intent: "find_flights",      // "find_flights"|"plan_after"|"both"
  transport_secondary: "car",         // mode on arrival
  scenic_drive_offer: true,
  
  // ── OPTIONAL FIELDS ───────────────
  driving_rhythm: "balanced",         // "short_legs"|"balanced"|"long_legs"
  overnight_ok: true,                 // user stated | inferred | null
  preferences: ["scenic", "cultural"],
  
  // ── ENRICHMENT (CQE) ──────────────
  time_preference: null,
  compactness: null,
  day_pace: null,
  cqe_questions_asked: [],
  
  // ── METADATA ──────────────────────
  trip_type: "MULTI_DAY",
  planning_intent: "FULL_PLANNING_REQUIRED",
  _archetype: "scenic_multi_day_drive"
}
```

---

## Key Bugs Fixed & Known Issues

### Recent Fixes (Last Session)
1. **Hallucinated Fields**: Mode extraction now requires HIGH confidence only; null fields show "tap to set"
2. **Correction Handling**: CLASS_B inputs (negations like "am not flying") now properly clear fields
3. **Custom Refinement**: Seeded text from journey view now auto-processes through full pipeline

### Current Known Blockers
1. **Confidence Scoring**: LLM extraction sometimes returns "medium" confidence for ambiguous inputs → needs stricter "high only" rule
2. **Segment Enforcement**: Multi-day trips <2 segments → auto-generation works but doesn't ask user for intermediate cities
3. **Hotel Search**: Region resolution sometimes returns generic region names instead of real towns
4. **Corridor Enrichment**: Google Places API rate limiting on bulk generation
5. **Flight Mode**: Flight intent detection sometimes triggers incorrectly on "can you help me fly somewhere scenic"

### Credit Waste Sources
- `buildConciergeJourney()` calls Google Directions for every refinement (3-5 calls per session)
- Enrichment pipeline (Google Places + AI story generation) runs even for partial-coverage regions
- LLM extraction called twice: once for initial parse, once if segment enforcement fails

---

## Entities Reference

### Core Entities
| Entity | Purpose | Key Fields |
|--------|---------|-----------|
| Journey | Trip record | origin, destination, trip_type, result_status |
| JourneyLeg | Day segment | journey_id, overnight_city, stop_count |
| JourneyStop | Individual stop | location_id, stop_role, confidence |
| JourneyHotel | Overnight option | journey_leg_id, booking_url, rating |
| Location | Place database | name, latitude, longitude, category, image_url, quick_story |

### Logging/Audit
- **ConciergeAuditLog**: Session turns, parsed state, issues, corrections
- **JourneyRequestLog**: Raw user input, parsed preferences, result status
- **EventLog**: User actions (journey_requested, audio_language_changed, etc.)
- **IncidentLog**: System failures, errors, stack traces

---

## Backend Functions

### Primary Functions
- `buildConciergeJourney(user_input, existing_plan, duration_days, stage_requested)` → Journey JSON
- `transcribeAudio(file_url)` → {text}
- `auditConciergeInteraction(session_id, turn_index, user_input, system_response)` → log record

### Helper Functions
- `enrichLocationImages()` — Google Places → Unsplash fallback
- `generateLocationOnDemand(query, city, country)` — AI + media generation
- `generateTranslation(location_id, language_code)` — TTS for stories

---

## Integration Points

### APIs
- **Google Maps**: Geocoding, Directions, Places (for corridor enrichment)
- **Google Places**: Photos, reviews, opening hours
- **Unsplash**: Fallback images for locations
- **OpenAI**: LLM calls (gpt-4o-mini for extraction, gpt-4o for planning)

### Secrets Required
- `OPENAI_API_KEY`
- `GOOGLE_PLACES_API_KEY`
- `UNSPLASH_ACCESS_KEY`
- `google_oauth_client_secret` (for OAuth)

---

## Dependencies
```json
{
  "react": "^18.2.0",
  "react-router-dom": "^6.26.0",
  "framer-motion": "^11.16.4",
  "@tanstack/react-query": "^5.84.1",
  "react-hook-form": "^7.54.2",
  "date-fns": "^3.6.0",
  "recharts": "^2.15.4",
  "tailwindcss": "^3.x",
  "@base44/sdk": "^0.8.26"
}
```

---

## Recommendations for Standalone Migration

### Phase 1: Database
- Replace Base44 entities with PostgreSQL (Supabase/Railway recommended)
- Migrate schemas from JSON to proper tables
- Add indices on (user_id, created_date), (location.category, lat/lng)

### Phase 2: Auth
- Move from Base44 auth to NextAuth.js or Supabase Auth
- Implement JWT token refresh, role-based access (user/admin)

### Phase 3: Backend
- Convert Base44 functions to Next.js API routes or Express
- Implement request queuing (Bull/RabbitMQ) for Google Places enrichment
- Cache Location queries (Redis) to reduce API calls

### Phase 4: LLM Optimization
- Use batch API for extraction calls (90% cheaper than single calls)
- Cache extraction results for duplicate inputs
- Move to Claude 3.5 Sonnet (cheaper than GPT-4o-mini for parsing)

### Phase 5: DevOps
- Host on Vercel (Next.js) or Railway (full-stack)
- Set up monitoring (Sentry) for error tracking
- Implement usage/credit tracking dashboard

---

## Files to Prioritize (Most Complex)
1. `buildConciergeJourney.js` — 1800 lines, V3 planning engine
2. `ConciergeChat.jsx` — 1100 lines, state machine + UI
3. `journeyExtractor.js` → needs strict no-invent rule
4. `journeyStateMachine.js` → confidence-based merging
5. All entity schemas (23 total)

---

## Contact for Clarification
All system behavior, confidence thresholds, and API integrations are documented in code comments.
Run `npm run dev` and hit `/AIConcierge` page to test full flow.