/**
 * ConciergeChat.jsx
 * Persistent chat-based planning assistant.
 *
 * Architecture:
 *   1. Every user message → extractJourneyEntities (LLM extraction)
 *   2. Extraction → mergeExtraction (state machine, immutable merge)
 *   3. getNextRequiredField (planning gate — what to ask next)
 *   4. AI acknowledgement generated from state description only
 *   5. When state is complete → show inline recap card
 *   6. User confirms → call onBuild
 *
 * The chat thread is always scrollable. Recap card appears inline in thread.
 * Input composer is pinned at bottom.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from '@/api/supabase';
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Mic, MicOff, RotateCcw, ChevronRight } from "lucide-react";
import { base44 } from "@/api/client";
import { extractJourneyEntities } from "@/lib/journeyExtractor";
import { classifyInputClass, getFrustrationResponse } from "@/lib/inputClassifier";
import {
  createEmptyState,
  mergeExtraction,
  getNextRequiredField,
  buildStateDescription,
  getLocalMobilityCharacter,
} from "@/lib/journeyStateMachine";
import { detectArchetype, ARCHETYPE_LABELS } from "@/lib/archetypeEngine";
import { scoreState } from "@/lib/confidenceScorer";
import { normalizeVoiceInput } from "@/lib/parseJourneyInput";
import { normalizeSemantics, applySemanticSignals } from "@/lib/semanticNormalizer";
import { loadUserProfile, saveUserProfile, updateProfileFromJourney, buildProfileHint } from "@/lib/userBehaviorProfile";
import { classifyIntent } from "@/lib/intentClassifier";
import { getNextCQEQuestion, applyCQEAnswer } from "@/lib/contextualQuestionEngine";
import FlightRouterCard from "./FlightRouterCard";

// ── Question definitions ──────────────────────────────────────────────────────
const QUESTIONS = {
  duration: {
    text: "How many days do you want to take for this trip?",
    chips: [
      { label: "Half a day",      value: "half day",  type: "hours", hours: 4 },
      { label: "Full day",        value: "full day",  type: "hours", hours: 8 },
      { label: "2 days",          value: "2 days",    type: "days",  days: 2 },
      { label: "3 days",          value: "3 days",    type: "days",  days: 3 },
      { label: "4–5 days",        value: "4 days",    type: "days",  days: 4 },
      { label: "A week",          value: "7 days",    type: "days",  days: 7 },
      { label: "Flexible",        value: "flexible",  type: "flexible" },
    ],
  },
  overnight_ok: {
    text: "This looks like a long route. Are you happy to overnight somewhere along the way?",
    chips: [
      { label: "Yes, happy to overnight",   value: true  },
      { label: "No — I want to drive it all in one day", value: false },
    ],
  },
  destination: {
    text: "Where are you heading?",
    chips: [],
    freeTextOnly: true,
  },
  transport_mode: {
    text: "How are you travelling?",
    chips: [
      { label: "🚗 Car",        value: "car" },
      { label: "🏍 Motorbike",  value: "motorbike" },
      { label: "🚴 Cycling",    value: "bike" },
      { label: "🚶 Walking",    value: "walk" },
      { label: "🚆 Train",      value: "train" },
    ],
  },
  driving_rhythm: {
    text: "How much would you like to drive between stops?",
    chips: [
      { label: "Every 45–60 min",           value: "short_legs" },
      { label: "Every 1.5–2 hours",         value: "balanced" },
      { label: "Happy with long stretches",  value: "long_legs" },
      { label: "I'm flexible",              value: "balanced" },
    ],
  },
  flight_confirm: {
    text: "This looks like a long-distance trip. Are you planning to fly to your destination?",
    chips: [
      { label: "Yes — I'll fly",           value: "flight",   field_key: "transport_primary" },
      { label: "I want to drive anyway",   value: "drive",    field_key: "transport_primary" },
      { label: "Not sure yet",             value: "unsure",   field_key: "transport_primary" },
    ],
  },
  flight_intent: {
    text: "Would you like help with flights, or focus on planning your time after you arrive?",
    chips: [
      { label: "✈️ Help me find flights",     value: "find_flights",    field_key: "flight_intent" },
      { label: "📍 Plan my trip after landing", value: "plan_after",    field_key: "flight_intent" },
      { label: "Both",                          value: "both",          field_key: "flight_intent" },
    ],
  },
  transport_secondary: {
    text: "Once you arrive, how would you like to explore?",
    chips: [
      { label: "🚗 Rent a car",          value: "car",     field_key: "transport_secondary" },
      { label: "🏍 Motorbike",           value: "motorbike", field_key: "transport_secondary" },
      { label: "🚶 Walk / local",        value: "walk",    field_key: "transport_secondary" },
      { label: "🚌 Public transport",    value: "public",  field_key: "transport_secondary" },
      { label: "Not sure yet",           value: "unsure",  field_key: "transport_secondary" },
    ],
  },
  scenic_drive_offer: {
    text: "Great — do you want me to design a scenic drive around your destination?",
    chips: [
      { label: "Yes — design a scenic drive", value: true,  field_key: "scenic_drive_offer" },
      { label: "No — I'll figure it out",     value: false, field_key: "scenic_drive_offer" },
    ],
  },
};

// ── Generate AI acknowledgement from state description ─────────────────────
async function generateAck(stateDesc, nextField, userText, profileHint, isReturn = false) {
  const fieldHints = {
    duration:            "Ask how long they have — but ask it like a person would. Example: 'How long are you thinking — a day, a few days, a week?' Not 'What is your duration?'",
    overnight_ok:        "This looks like it needs an overnight. Ask: 'Are you happy to sleep somewhere along the way, or want to get back the same day?'",
    destination:         "Ask where they're headed — or if it's more of an open explore. One sentence.",
    transport_mode:      "Ask how they're doing it — driving, motorbike, train? Keep it casual.",
    driving_rhythm:      "Ask how they like to pace it — quick stops every hour or happy to drive longer stretches?",
    transport_secondary: "Ask how they'll get around once they land — rent a car, walk, public transport?",
    scenic_drive_offer:  "Ask if they want a scenic drive designed around their destination.",
    flight_confirm:      "That's a long way — are they flying or driving?",
    flight_intent:       "Ask: do they want help finding flights, or just plan what to do once they're there?",
  };

  const returnContext = isReturn
    ? `\n\nThe user just returned from a flight/hotel search. Welcome them back in 2–3 words max, then ask the next question immediately.`
    : "";

  const instruction = nextField
    ? `Your task: Ask ONE question — ${fieldHints[nextField] || "ask the single most important missing detail"}. Sound like a knowledgeable friend, not a form. 1–2 sentences maximum.`
    : `All required fields are confirmed. Tell them you're ready to build their journey. 1 sentence only.`;

  const memorySection = profileHint
    ? `\n\nUSER MEMORY (use only if genuinely relevant):\n${profileHint}`
    : "";

  const prompt = `You are TukaPath — a smart travel companion, not a chatbot or booking system.

Current trip state:
${stateDesc || "(nothing captured yet)"}${memorySection}${returnContext}

${instruction}

STYLE RULES — no exceptions:
BANNED OPENERS: "I see" / "I understand" / "Got it" (alone) / "Sure thing" / "Absolutely" / "Of course" / "That sounds great" / "Makes sense" / "No problem" / "Happy to help" / "Great choice"

GOOD STYLE:
- If you know origin + destination: lead with that, then ask. "Edinburgh to London — driving or flying?"
- If you know only origin: "From Edinburgh — where are you heading?"  
- If nothing is known yet: ask the question directly, no preamble.
- Ask about PEOPLE and CONTEXT when relevant: "Anyone joining you?" / "Is this for yourself or a group?"
- If user mentions a person or friend: ask where they are based — it changes hotel and routing decisions.
- Never repeat the user's words verbatim without adding insight.
- Never ask for something already in the state.
- No exclamation marks.
- Maximum 2 sentences.`;

  try {
    const res = await base44.integrations.Core.InvokeLLM({ prompt });
    return typeof res === "string" ? res : String(res);
  } catch {
    if (nextField) {
      return QUESTIONS[nextField]?.text || "What else can you tell me about your trip?";
    }
    return "Everything looks good — take a look at the summary below and confirm when you're ready.";
  }
}

// ── Build prompt string from state (for buildConciergeJourney) ─────────────
function buildPromptFromState(state) {
  const parts = [];
  if (state.origin)      parts.push(`from ${state.origin}`);
  if (state.anchors?.length) parts.push(`via ${state.anchors.join(", ")}`);
  if (state.destination) parts.push(`to ${state.destination}`);
  else if (state.trip_type === "loop") parts.push("loop back to start");
  else if (state.trip_type === "exploration") parts.push("open exploration");
  if (state.duration_type === "days" && state.duration_days) parts.push(`${state.duration_days} days`);
  else if (state.duration_type === "hours" && state.duration_hours) parts.push(`${state.duration_hours} hours`);
  else if (state.duration_type === "flexible") parts.push("flexible duration");
  // Flight mode
  if (state.transport_primary === "flight") {
    parts.push("flying to destination");
    if (state.transport_secondary) parts.push(`exploring by ${state.transport_secondary} on arrival`);
    if (state.car_rental_intent) parts.push("renting a car");
    if (state.scenic_drive_offer) parts.push("wants scenic drive designed");
  } else {
    if (state.transport_mode) parts.push(state.transport_mode);
  }
  if (state.driving_rhythm) parts.push(`driving rhythm: ${state.driving_rhythm}`);
  if (state.overnight_ok === true) parts.push("overnight ok");
  if (state.overnight_ok === false) parts.push("day trip only");
  if (state.preferences?.length) parts.push(state.preferences.join(", "));
  return parts.filter(Boolean).join(", ");
}

// ── RecapCard — appears inline in chat thread ──────────────────────────────
function RecapCard({ state, onBuild, onEdit, building }) {
  const routeParts = [
    state.origin,
    ...(state.anchors || []),
    state.destination || (state.trip_type === "loop" ? "(loop back)" : null),
  ].filter(Boolean);

  const durationStr = state.duration_type === "flexible"
    ? "Flexible"
    : state.duration_type === "days" && state.duration_days
      ? `${state.duration_days} day${state.duration_days !== 1 ? "s" : ""}`
      : state.duration_type === "hours" && state.duration_hours
        ? `${state.duration_hours} hour${state.duration_hours !== 1 ? "s" : ""}`
        : null;

  const rhythmLabels = {
    short_legs: "Short legs (every 45–60 min)",
    balanced:   "Balanced (every 1.5–2 h)",
    long_legs:  "Long stretches",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="ml-9 bg-card border border-border rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50 bg-primary/5">
        <p className="text-[10px] font-bold text-primary/70 uppercase tracking-widest">Your journey plan</p>
        <p className="text-sm font-bold text-foreground mt-0.5">
          {routeParts.join(" → ")}
        </p>
      </div>

      {/* Fields */}
      <div className="px-4 py-3 space-y-2">
        {durationStr && (
          <Row label="Duration" value={durationStr} />
        )}
        {state.transport_primary === "flight" ? (
          <>
            <Row label="Getting there" value="✈️ Flying" />
            {state.transport_secondary && (
              <Row label="On arrival" value={{
                car: "🚗 Rent a car",
                motorbike: "🏍 Motorbike",
                walk: "🚶 Walk / local",
                public: "🚌 Public transport",
              }[state.transport_secondary] || capitalize(state.transport_secondary)} />
            )}
            {state.scenic_drive_offer === true && (
              <Row label="Scenic drive" value="Yes — designing route" />
            )}
          </>
        ) : (
          <>
            {state.transport_mode ? (
              <Row label="Mode" value={capitalize(state.transport_mode)} />
            ) : state.transport_primary !== "flight" && (
              <Row label="Mode" value={<span className="text-muted-foreground italic">tap to set</span>} />
            )}
            {state.overnight_ok !== null && (
              <Row label="Overnight" value={state.overnight_ok ? "Yes" : "No — day trip"} />
            )}
          </>
        )}
        {state.driving_rhythm && (
          <Row label="Driving rhythm" value={rhythmLabels[state.driving_rhythm] || state.driving_rhythm} />
        )}
        {state.preferences?.length > 0 && (
          <Row label="Preferences" value={state.preferences.join(", ")} />
        )}
      </div>

      {/* Actions */}
      <div className="flex border-t border-border">
        <button
          onClick={onEdit}
          disabled={building}
          className="flex-1 py-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors font-medium"
        >
          Change something
        </button>
        <div className="w-px bg-border" />
        <button
          onClick={() => {
            // Pass the full journey state so AIConcierge can forward duration_days to the backend
            const builtPrompt = buildPromptFromState(state);
            onBuild(builtPrompt, { ...state, duration_days: state.duration_days, _journeyState: state });
            // Fire-and-forget: update behavior profile from this journey
            supabase.auth.getUser().then(r => r.data.user).then(u => {
              if (!u?.id) return;
              loadUserProfile(u.id).then(profile => {
                const updated = updateProfileFromJourney(profile, state);
                saveUserProfile(u.id, updated);
              });
            }).catch(() => {});
          }}
          disabled={building}
          className="flex-1 py-3 text-xs text-primary font-bold hover:bg-primary/5 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {building ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Building…</>
          ) : (
            <>Plan my journey <ChevronRight className="w-3.5 h-3.5" /></>
          )}
        </button>
      </div>
    </motion.div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-start gap-3">
      <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
      <span className="text-xs font-semibold text-foreground text-right">{value}</span>
    </div>
  );
}

function capitalize(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Message bubble components ─────────────────────────────────────────────────
function AssistantBubble({ text }) {
  return (
    <div className="flex items-end gap-2.5">
      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mb-0.5">
        <span className="text-[10px] text-primary-foreground font-bold">T</span>
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-card border border-border/80 shadow-sm text-sm text-foreground leading-relaxed max-w-[85%]">
        {text}
      </div>
    </div>
  );
}

function UserBubble({ text }) {
  return (
    <div className="flex justify-end">
      <div className="px-4 py-3 rounded-2xl rounded-br-sm bg-primary text-primary-foreground text-sm leading-relaxed max-w-[80%] shadow-sm">
        {text}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2.5">
      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mb-0.5">
        <span className="text-[10px] text-primary-foreground font-bold">T</span>
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-card border border-border/80 shadow-sm">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Chip row — quick answer buttons ─────────────────────────────────────────
function ChipRow({ chips, onSelect, disabled }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="flex flex-col gap-2 pl-9"
    >
      {chips.map((chip, i) => (
        <motion.button
          key={i}
          whileTap={{ scale: 0.97 }}
          onClick={() => !disabled && onSelect(chip)}
          disabled={disabled}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium border-[1.5px] border-primary text-primary bg-white hover:bg-primary/5 active:bg-primary/10 transition-colors disabled:opacity-40 w-fit"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          {chip.label}
        </motion.button>
      ))}
    </motion.div>
  );
}

// ── Message types ─────────────────────────────────────────────────────────────
// { id, type: "user"|"assistant"|"chips"|"recap", text?, chips?, state? }

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────
export default function ConciergeChat({ onBuild, building, error }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [thinking, setThinking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [journeyState, setJourneyState] = useState(createEmptyState());
  const [showRecap, setShowRecap]       = useState(false);
  const [chipsDisabled, setChipsDisabled] = useState(false);
  const [userProfile, setUserProfile]   = useState(null);
  const [userName, setUserName]         = useState(null);

  const scrollRef = useRef(null);
  const inputRef  = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const stateRef         = useRef(journeyState); // always in sync
  stateRef.current       = journeyState;
  const inputHistoryRef  = useRef([]); // raw user texts for CQE implied signals
  const questionsAskedRef = useRef(0); // Part 19: max 3 questions before recap
  const processInputRef  = useRef(null); // stable ref to processInput for useEffect

  // ── Persist journey state to sessionStorage on every change ──────────────
  useEffect(() => {
    if (journeyState && (journeyState.origin || journeyState.destination)) {
      sessionStorage.setItem("tp_concierge_state", JSON.stringify(journeyState));
    }
  }, [journeyState]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinking]);

  // Load user profile + name on mount, restore persisted state if any
  useEffect(() => {
    // Restore any previously persisted concierge state
    const saved = sessionStorage.getItem("tp_concierge_state");
    if (saved) {
      try {
        const restored = JSON.parse(saved);
        if (restored?.origin || restored?.destination) {
          setJourneyState(restored);
        }
      } catch {}
    }

    // Fix 3: Pick up custom refinement text seeded from journey view
    const refineSeed = sessionStorage.getItem("tp_concierge_refine_input");
    if (refineSeed) {
      sessionStorage.removeItem("tp_concierge_refine_input");
      // Delay so state is hydrated and processInputRef is assigned
      setTimeout(() => {
        processInputRef.current?.(refineSeed);
      }, 400);
    }

    supabase.auth.getUser().then(r => r.data.user).then(u => {
      if (u?.id) {
        loadUserProfile(u.id).then(setUserProfile);
        const first = u.full_name?.split(" ")[0] || null;
        setUserName(first);
        // Part 1: Opening message suppression — only show if user hasn't typed yet
        // We delay slightly so that if user has already typed, we skip it
        setTimeout(() => {
          setMessages(prev => {
            // If user has already sent a message, suppress the greeting (Part 1 rule)
            if (prev.some(m => m.type === "user")) return prev;
            return [{
              id: "init",
              type: "assistant",
              text: first ? `Hey ${first} — where are we going today?` : "Hey — where are we going today?",
            }];
          });
        }, 50);
      }
    }).catch(() => {});
  }, []);

  // Fallback greeting if auth fails (guest) — also suppressable
  useEffect(() => {
    setTimeout(() => {
      setMessages(prev => {
        if (prev.length > 0) return prev;
        return [{ id: "init", type: "assistant", text: "Hey — where are we going today?" }];
      });
    }, 100);
  }, []);

  // ── Add message helpers ───────────────────────────────────────────────────
  const addMsg = useCallback((msg) => {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), ...msg }]);
  }, []);

  const removeChips = useCallback(() => {
    setMessages(prev => prev.filter(m => m.type !== "chips"));
  }, []);

  // ── Core pipeline: extract → merge → validate → respond ─────────────────
  const processInput = useCallback(async (userText) => {
    if (!userText.trim() || thinking) return;

    // Disable chips, add user bubble
    setChipsDisabled(true);
    removeChips();
    addMsg({ type: "user", text: userText });
    setThinking(true);
    setInput("");

    // ── RESUME SIGNAL — check BEFORE input classification (Part 18 Rule 5 / Part 20) ──
    // "done", "back", "I'm back", "returned" must restore full state and continue from next field.
    // This must run BEFORE CLASS_D check because "done" / "ok" would be swallowed as trivial.
    if (/\b(i('m| am) back|back|done|returned|i'?m here|finished|all done)\b/i.test(userText)) {
      const savedRaw = sessionStorage.getItem("tp_concierge_state");
      let resumeState = stateRef.current;
      if (savedRaw) {
        try {
          const parsed = JSON.parse(savedRaw);
          if (parsed?.origin || parsed?.destination) resumeState = parsed;
        } catch {}
      }
      const hasContext = resumeState.origin || resumeState.destination;
      if (hasContext) {
        // Restore state in case it drifted
        setJourneyState(resumeState);
        const nextField   = getNextRequiredField(resumeState);
        const stateDesc   = buildStateDescription(resumeState);
        const profileHint = buildProfileHint(userProfile);
        generateAck(stateDesc, nextField, userText, profileHint, true).then(ackText => {
          setThinking(false);
          addMsg({ type: "assistant", text: ackText });
          if (nextField === null) {
            setShowRecap(true);
            addMsg({ type: "recap", state: resumeState });
          } else {
            const qDef = QUESTIONS[nextField];
            if (qDef?.chips?.length) addMsg({ type: "chips", field: nextField, chips: qDef.chips });
            setChipsDisabled(false);
          }
        });
        return;
      }
    }

    // ── INPUT CLASSIFICATION (Part 2) ────────────────────────────────────────
    const inputClass = classifyInputClass(userText);

    // Class C — frustration / emotional — NEVER parse as journey data
    if (inputClass === "CLASS_C") {
      setThinking(false);
      addMsg({ type: "assistant", text: getFrustrationResponse(stateRef.current) });
      setChipsDisabled(false);
      return;
    }

    // Class D — trivial confirmation — treat as agreement with current state
    if (inputClass === "CLASS_D") {
      const currentState = stateRef.current;
      const nextField = getNextRequiredField(currentState);
      // If there's a next field to ask about, proceed to it
      if (nextField !== null) {
        const stateDesc = buildStateDescription(currentState);
        const profileHint = buildProfileHint(userProfile);
        generateAck(stateDesc, nextField, userText, profileHint, false).then(ackText => {
          setThinking(false);
          addMsg({ type: "assistant", text: ackText });
          const qDef = QUESTIONS[nextField];
          if (qDef?.chips?.length) addMsg({ type: "chips", field: nextField, chips: qDef.chips });
          setChipsDisabled(false);
        });
        return;
      }
      // If state is complete, show recap
      if (currentState.origin || currentState.destination) {
        setThinking(false);
        addMsg({ type: "assistant", text: "Everything looks good — take a look at the summary below." });
        setShowRecap(true);
        addMsg({ type: "recap", state: currentState });
        setChipsDisabled(false);
        return;
      }
      // No state yet — treat as Class A
    }

    // Class E — meta-conversation
    if (inputClass === "CLASS_E") {
      setThinking(false);
      addMsg({ type: "assistant", text: "I help you plan road trips, multi-day journeys, and scenic drives — just tell me where you're going." });
      setChipsDisabled(false);
      return;
    }

    // Detect "start over"
    if (/\b(start over|new trip|reset|begin again)\b/i.test(userText)) {
      const fresh = createEmptyState();
      setJourneyState(fresh);
      inputHistoryRef.current = [];
      questionsAskedRef.current = 0;
      sessionStorage.removeItem("tp_concierge_state");
      setShowRecap(false);
      setTimeout(() => {
        setThinking(false);
        addMsg({ type: "assistant", text: "Sure — let's start fresh. Tell me about your next trip." });
        setChipsDisabled(false);
      }, 400);
      return;
    }

    try {
      // ── INTENT GATE: classify before any LLM work ─────────────────────────
      const { intent, origin: iOrigin, destination: iDest } = classifyIntent(userText);

      if (intent === "FLIGHT_INTENT") {
        setThinking(false);
        addMsg({ type: "assistant", text: iOrigin && iDest
          ? `${iOrigin} to ${iDest} — flights or the trip itself?`
          : "Flight trip — want help finding the flight, or just plan what you'll do once you're there?" });
        addMsg({ type: "flight_router", origin: iOrigin, destination: iDest });
        setChipsDisabled(false);
        return;
      }

      if (intent === "HYBRID_INTENT") {
        setThinking(false);
        addMsg({ type: "assistant", text: "Flying there, then exploring — sort the flight first, or jump straight to planning the ground trip?" });
        addMsg({ type: "flight_router", origin: iOrigin, destination: iDest });
        setChipsDisabled(false);
        return;
      }

      if (intent === "MULTI_LEG_INTENT") {
        // Multi-city trip — flights are sorted, user wants experience planning
        // Extract cities and build anchor chain, then continue normal pipeline
        setThinking(false);
        addMsg({ type: "assistant", text: "Multi-city trip — I'll plan what to do in each place. Which city are you starting from?" });
        setChipsDisabled(false);
        // Continue into normal journey pipeline with the input
        // so state machine can extract the cities
      }

      // ── JOURNEY PATH: continue existing pipeline ──────────────────────────
      // Track raw input for CQE implied signal detection
      inputHistoryRef.current = [...inputHistoryRef.current, userText];

      // Step 1a: Semantic normalization (deterministic, no AI)
      const semanticSignals = normalizeSemantics(userText);

      // Step 1b: LLM extraction
      const rawExtraction = await extractJourneyEntities(userText);

      // Step 1c: Merge semantic signals into extraction (fills gaps only)
      const extraction = applySemanticSignals(rawExtraction, semanticSignals);

      // Step 2: Merge into state
      const currentState = stateRef.current;
      const nextState    = mergeExtraction(currentState, extraction);

      // Ensure planning_intent defaults to FULL_PLANNING_REQUIRED if user described a route
      if (!nextState.planning_intent && (nextState.origin || nextState.destination)) {
        nextState.planning_intent = "FULL_PLANNING_REQUIRED";
      }

      setJourneyState(nextState);

      // Step 2b: Evaluate archetype (Part 5) — silent, used for planning profile
      nextState._archetype = detectArchetype(nextState);

      // Step 2c: Confidence score (Part 4)
      const scoreResult = scoreState(nextState);

      // Step 3: Check required fields
      const nextField = getNextRequiredField(nextState);

      // CONFIDENCE SHORTCUT (Part 4): score >= 0.70 AND duration HIGH → skip straight to recap
      if (scoreResult.ready_for_recap && nextField === null) {
        const stateDesc   = buildStateDescription(nextState);
        const profileHint = buildProfileHint(userProfile);
        const ackText     = await generateAck(stateDesc, null, userText, profileHint, false);
        setThinking(false);
        addMsg({ type: "assistant", text: ackText });
        setShowRecap(true);
        addMsg({ type: "recap", state: nextState });
        setChipsDisabled(false);
        return;
      }

      // Step 4: If all required fields done, check CQE before showing recap
      if (nextField === null) {
        const cqe = await getNextCQEQuestion(
          nextState,
          nextState.cqe_questions_asked || [],
          inputHistoryRef.current
        );

        if (cqe) {
          // Mark this CQE question as asked
          const updatedState = {
            ...nextState,
            cqe_questions_asked: [...(nextState.cqe_questions_asked || []), cqe.id],
          };
          setJourneyState(updatedState);

          const stateDesc   = buildStateDescription(updatedState);
          const profileHint = buildProfileHint(userProfile);
          const ackText     = await generateAck(stateDesc, null, userText, profileHint, false);
          setThinking(false);
          addMsg({ type: "assistant", text: cqe.question });
          if (cqe.chips?.length) {
            addMsg({ type: "chips", field: `cqe_${cqe.state_field}`, chips: cqe.chips.map(c => ({ ...c, cqe_state_field: cqe.state_field })) });
          }
          setChipsDisabled(false);
        } else {
          // No CQE question — go straight to recap
          const stateDesc   = buildStateDescription(nextState);
          const profileHint = buildProfileHint(userProfile);
          const ackText     = await generateAck(stateDesc, null, userText, profileHint, false);
          setThinking(false);
          addMsg({ type: "assistant", text: ackText });
          setShowRecap(true);
          addMsg({ type: "recap", state: nextState });
        }
      } else {
        // Step 4b: Still collecting required fields
        // Part 19: Max 3 questions before recap — after that, show recap with assumptions
        questionsAskedRef.current += 1;
        const stateDesc   = buildStateDescription(nextState);
        const profileHint = buildProfileHint(userProfile);

        if (questionsAskedRef.current > 3 && (nextState.origin || nextState.destination)) {
          // Force recap after 3 questions — show assumptions for remaining fields
          const ackText = await generateAck(stateDesc, null, userText, profileHint, false);
          setThinking(false);
          addMsg({ type: "assistant", text: ackText });
          setShowRecap(true);
          addMsg({ type: "recap", state: nextState });
        } else {
          const ackText = await generateAck(stateDesc, nextField, userText, profileHint, false);
          setThinking(false);
          addMsg({ type: "assistant", text: ackText });
          const qDef = QUESTIONS[nextField];
          if (qDef?.chips?.length) {
            addMsg({ type: "chips", field: nextField, chips: qDef.chips });
          }
        }
        setChipsDisabled(false);
      }
    } catch {
      setThinking(false);
      addMsg({ type: "assistant", text: "Sorry, I had trouble understanding that. Could you try again?" });
      setChipsDisabled(false);
    }
  }, [thinking, addMsg, removeChips]);
  processInputRef.current = processInput;

  // ── Handle chip selection ────────────────────────────────────────────────
  const handleChipSelect = useCallback((chip, field) => {
    setChipsDisabled(true);
    removeChips();

    // Build a synthetic extraction from the chip value
    let syntheticText = chip.label;
    const currentState = stateRef.current;
    let nextState = { ...currentState };

    if (field === "duration") {
      nextState.duration_type  = chip.type || null;
      nextState.duration_days  = chip.days  || null;
      nextState.duration_hours = chip.hours || null;
      nextState.duration_conf  = "high";
    } else if (field === "overnight_ok") {
      nextState.overnight_ok   = chip.value;
      nextState.overnight_conf = "high";
    } else if (field === "transport_mode") {
      nextState.transport_mode = chip.value;
      nextState.mode_conf      = "high";
    } else if (field === "driving_rhythm") {
      nextState.driving_rhythm = chip.value;
    } else if (field === "flight_confirm") {
      if (chip.value === "flight") {
        nextState.transport_primary = "flight";
        nextState.flight_detected   = true;
      } else if (chip.value === "drive") {
        nextState.transport_primary = "drive";
        // Carry existing mode or default to car
        if (!nextState.transport_mode) nextState.transport_mode = "car";
      } else {
        // "Not sure yet" — treat as drive for now, don't block planning
        nextState.transport_primary = "drive";
        if (!nextState.transport_mode) nextState.transport_mode = "car";
      }
    } else if (field === "transport_secondary") {
      if (chip.value !== "unsure") {
        nextState.transport_secondary = chip.value;
        nextState.car_rental_intent   = chip.value === "car";
      } else {
        // unsure → default to car so planning can proceed
        nextState.transport_secondary = "car";
        nextState.car_rental_intent   = false;
      }
    } else if (field === "scenic_drive_offer") {
      nextState.scenic_drive_offer = chip.value;
    } else if (field === "flight_intent") {
      nextState.flight_intent = chip.value;
      // "plan_after" → jump straight to local planning, no flight booking needed
      if (chip.value === "plan_after") {
        nextState.transport_primary = "flight"; // confirmed flying
      }
    } else if (field.startsWith("cqe_")) {
      // CQE enrichment answer — apply to the correct state field
      const cqeStateField = chip.cqe_state_field || field.replace("cqe_", "");
      nextState = applyCQEAnswer(nextState, cqeStateField, chip.value);
    }

    setJourneyState(nextState);

    addMsg({ type: "user", text: chip.label });
    setThinking(true);

    // Check next field
    const nextField = getNextRequiredField(nextState);

    const stateDesc   = buildStateDescription(nextState);
    const profileHint = buildProfileHint(userProfile);

    if (nextField === null) {
      // All required fields done — check CQE before recap
      getNextCQEQuestion(nextState, nextState.cqe_questions_asked || [], inputHistoryRef.current).then(cqe => {
        if (cqe) {
          const updatedState = {
            ...nextState,
            cqe_questions_asked: [...(nextState.cqe_questions_asked || []), cqe.id],
          };
          setJourneyState(updatedState);
          setThinking(false);
          addMsg({ type: "assistant", text: cqe.question });
          if (cqe.chips?.length) {
            addMsg({ type: "chips", field: `cqe_${cqe.state_field}`, chips: cqe.chips.map(c => ({ ...c, cqe_state_field: cqe.state_field })) });
          }
          setChipsDisabled(false);
        } else {
          generateAck(stateDesc, null, syntheticText, profileHint, false).then(ackText => {
            setThinking(false);
            addMsg({ type: "assistant", text: ackText });
            setShowRecap(true);
            addMsg({ type: "recap", state: nextState });
          });
        }
      });
    } else {
      generateAck(stateDesc, nextField, syntheticText, profileHint, false).then(ackText => {
        setThinking(false);
        addMsg({ type: "assistant", text: ackText });
        const qDef = QUESTIONS[nextField];
        if (qDef?.chips?.length) {
          addMsg({ type: "chips", field: nextField, chips: qDef.chips });
        }
        setChipsDisabled(false);
      });
    }
  }, [addMsg, removeChips]);

  // ── Handle edit (dismiss recap, let user keep chatting) ──────────────────
  const handleEdit = useCallback(() => {
    setShowRecap(false);
    setMessages(prev => prev.filter(m => m.type !== "recap"));
    setTimeout(() => {
      addMsg({ type: "assistant", text: "Sure — what would you like to change?" });
      setChipsDisabled(false);
    }, 100);
  }, [addMsg]);

  // ── Handle flight router selection ────────────────────────────────────────
  const handleFlightRoute = useCallback((action, origin, destination) => {
    // Remove the router card
    setMessages(prev => prev.filter(m => m.type !== "flight_router"));

    if (action === "find_flights") {
      addMsg({ type: "user", text: "Help me find a flight" });
      // PART 18 RULE 5: Preserve the FULL current state — never wipe it.
      // Only overlay the flight-specific fields that aren't already set.
      const currentFull = stateRef.current;
      const handoffState = {
        ...currentFull,
        origin: origin || currentFull.origin || null,
        origin_conf: (origin || currentFull.origin) ? "high" : "low",
        destination: destination || currentFull.destination || null,
        destination_conf: (destination || currentFull.destination) ? "high" : "low",
        transport_primary: "flight",
        flight_intent: "find_flights",
        planning_intent: "FULL_PLANNING_REQUIRED",
      };
      setJourneyState(handoffState);
      sessionStorage.setItem("tp_concierge_state", JSON.stringify(handoffState));
      addMsg({ type: "assistant", text: "Tap below to search — come back when you're done and we'll plan the rest." });
      const q = [origin, destination].filter(Boolean).join(" to ");
      const url = `https://www.skyscanner.com/transport/flights/${encodeURIComponent(origin || "")}/${encodeURIComponent(destination || "")}/`;
      addMsg({ type: "flight_link", label: `Search flights${q ? `: ${q}` : ""}`, url });
    } else if (action === "plan_after") {
      addMsg({ type: "user", text: "Plan my trip after landing" });
      // Pre-seed the journey state with destination and flight mode
      const nextState = {
        ...createEmptyState(),
        destination: destination || null,
        destination_conf: destination ? "high" : "low",
        origin: origin || null,
        origin_conf: origin ? "high" : "low",
        transport_primary: "flight",
        flight_intent: "plan_after",
        planning_intent: "FULL_PLANNING_REQUIRED",
      };
      setJourneyState(nextState);
      addMsg({ type: "assistant", text: destination
        ? `Perfect — let's plan your time in ${destination}. How many days do you have there?`
        : "Perfect — let's plan your time after you land. How many days do you have?" });
      addMsg({ type: "chips", field: "duration", chips: [
        { label: "1 day",    value: "1 day",   type: "days",    days: 1 },
        { label: "2 days",   value: "2 days",  type: "days",    days: 2 },
        { label: "3 days",   value: "3 days",  type: "days",    days: 3 },
        { label: "4–5 days", value: "4 days",  type: "days",    days: 4 },
        { label: "A week",   value: "7 days",  type: "days",    days: 7 },
        { label: "Flexible", value: "flexible",type: "flexible" },
      ]});
      setChipsDisabled(false);
    } else if (action === "both") {
      addMsg({ type: "user", text: "Both — flight then trip" });
      // PART 18 RULE 5: Preserve the FULL current state — never wipe it.
      const currentFull2 = stateRef.current;
      const handoffState2 = {
        ...currentFull2,
        origin: origin || currentFull2.origin || null,
        origin_conf: (origin || currentFull2.origin) ? "high" : "low",
        destination: destination || currentFull2.destination || null,
        destination_conf: (destination || currentFull2.destination) ? "high" : "low",
        transport_primary: "flight",
        flight_intent: "both",
        planning_intent: "FULL_PLANNING_REQUIRED",
      };
      setJourneyState(handoffState2);
      sessionStorage.setItem("tp_concierge_state", JSON.stringify(handoffState2));
      addMsg({ type: "assistant", text: "Starting with the flight — come back after and we'll shape the ground trip." });
      const q = [origin, destination].filter(Boolean).join(" to ");
      const url = `https://www.skyscanner.com/transport/flights/${encodeURIComponent(origin || "")}/${encodeURIComponent(destination || "")}/`;
      addMsg({ type: "flight_link", label: `Search flights${q ? `: ${q}` : ""}`, url });
    }
  }, [addMsg]);

  // ── Text submit ──────────────────────────────────────────────────────────
  const handleSend = () => {
    if (!input.trim() || thinking || building) return;
    processInput(input.trim());
  };

  // ── Voice recording ──────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setTranscribing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const file = new File([blob], "recording.webm", { type: "audio/webm" });
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          const res = await base44.functions.invoke("transcribeAudio", { file_url });
          if (res?.data?.text) {
            const normalized = normalizeVoiceInput(res.data.text);
            setInput(prev => prev ? prev + " " + normalized : normalized);
          }
        } catch {}
        setTranscribing(false);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
    } catch {}
  };

  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">

      {/* ── Scrollable thread ───────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar"
      >
        {messages.map(msg => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {msg.type === "user"      && <UserBubble text={msg.text} />}
            {msg.type === "assistant" && <AssistantBubble text={msg.text} />}
            {msg.type === "chips"     && (
              <ChipRow
                chips={msg.chips}
                onSelect={(chip) => handleChipSelect(chip, msg.field)}
                disabled={chipsDisabled}
              />
            )}
            {msg.type === "recap" && (
              <RecapCard
                state={msg.state}
                onBuild={onBuild}
                onEdit={handleEdit}
                building={building}
              />
            )}
            {msg.type === "flight_router" && (
              <FlightRouterCard
                origin={msg.origin}
                destination={msg.destination}
                onSelect={(action) => handleFlightRoute(action, msg.origin, msg.destination)}
              />
            )}
            {msg.type === "flight_link" && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="ml-9"
              >
                <a
                  href={msg.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 transition-colors shadow-sm"
                >
                  ✈️ {msg.label}
                </a>
              </motion.div>
            )}
          </motion.div>
        ))}

        {/* Typing indicator */}
        {thinking && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <TypingIndicator />
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="ml-9 px-4 py-3 rounded-2xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            {error}
          </motion.div>
        )}
      </div>

      {/* ── Input composer — pinned at bottom ───────────────────────────── */}
      <div className="flex-shrink-0 border-t border-border bg-background px-4 py-3 flex items-center gap-2">
        {/* Reset button */}
        {messages.length > 2 && (
          <button
            onClick={() => processInput("start over")}
            disabled={thinking || building}
            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex-shrink-0"
            title="Start over"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}

        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={thinking ? "Thinking…" : "Type your reply…"}
          disabled={thinking || building}
          className="flex-1 px-4 py-2.5 rounded-full bg-muted/50 border border-border/60 text-sm focus:outline-none focus:border-primary/40 focus:bg-card transition-all disabled:opacity-50"
        />

        {/* Voice */}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={transcribing || thinking || building}
          className={`p-2 rounded-full flex-shrink-0 transition-all ${
            isRecording
              ? "bg-destructive text-white animate-pulse"
              : "text-muted-foreground hover:text-primary hover:bg-primary/10"
          }`}
        >
          {transcribing ? <Loader2 className="w-4 h-4 animate-spin" /> : isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={!input.trim() || thinking || building}
          className="p-2 rounded-full bg-primary text-primary-foreground flex-shrink-0 disabled:opacity-40 transition-opacity hover:bg-primary/90"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}