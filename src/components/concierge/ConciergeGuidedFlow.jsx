/**
 * ConciergeGuidedFlow — Adaptive Journey Interviewer
 *
 * NOT a form. NOT a fixed wizard.
 * An adaptive decision engine that asks exactly ONE question at a time,
 * evaluates each answer, and either asks the next highest-impact question
 * or proceeds directly to the confirmation card.
 *
 * EVALUATION LOOP (after every answer):
 *   1. Update journey state
 *   2. Check build threshold
 *   3. If threshold not met → find highest-priority missing variable → ask ONE question
 *
 * BUILD THRESHOLD:
 *   origin >= MEDIUM
 *   AND trip_type >= MEDIUM
 *   AND duration == HIGH (must be explicit — never assumed)
 *   AND (destination >= MEDIUM OR trip_type is LOOP OR trip_type is EXPLORATION)
 */

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, MapPin, Mic, MicOff, Sparkles, ArrowRight } from "lucide-react";
import { base44 } from "@/api/client";
import { normalizeVoiceInput } from "@/lib/parseJourneyInput";

// ─── Confidence levels ─────────────────────────────────────────────────────────
const CONF = { HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };

// ─── Initial journey state ─────────────────────────────────────────────────────
const INITIAL_STATE = () => ({
  origin:      { value: null, confidence: CONF.UNKNOWN },
  destination: { value: null, confidence: CONF.UNKNOWN },
  trip_type:   { value: null, confidence: CONF.UNKNOWN }, // LOOP | POINT_TO_POINT | EXPLORATION
  duration:    { value: null, unit: null, confidence: CONF.UNKNOWN },
  mode:        { value: null, confidence: CONF.UNKNOWN },
  overnight:   { value: null, confidence: CONF.UNKNOWN },
  intent:      [],
  preferences: [],
  assumptions: [],
});

// ─── Free text parser — extract all signals ────────────────────────────────────
function parseFromText(text) {
  if (!text?.trim()) return {};
  const t = text.toLowerCase();
  const signals = {};

  // Duration signals (HIGH confidence from explicit text)
  if (/\bday\s*trip\b/.test(t))                       signals.duration = { value: "full day", unit: "day", confidence: CONF.HIGH };
  else if (/\bhalf\s*day\b/.test(t))                  signals.duration = { value: "half day", unit: "hours", confidence: CONF.HIGH };
  else if (/\bweekend\b/.test(t))                     signals.duration = { value: "2 days", unit: "days", confidence: CONF.HIGH };
  else if (/\b(\d+)\s*days?\b/.exec(t)?.[1])          signals.duration = { value: `${/\b(\d+)\s*days?\b/.exec(t)[1]} days`, unit: "days", confidence: CONF.HIGH };
  else if (/\bweek\b/.test(t))                        signals.duration = { value: "7 days", unit: "days", confidence: CONF.HIGH };
  else if (/\bfew\s*hours?\b|couple\s*of\s*hours?\b/.test(t)) signals.duration = { value: "half day", unit: "hours", confidence: CONF.HIGH };
  else if (/\b(\d+)\s*hours?\b/.exec(t)?.[1])         signals.duration = { value: `${/\b(\d+)\s*hours?\b/.exec(t)[1]} hours`, unit: "hours", confidence: CONF.HIGH };
  else if (/overnight/.test(t))                       signals.duration = { value: "1-2 days", unit: "days", confidence: CONF.HIGH };

  // Trip type signals
  if (/\bloop\b|circular|round\s*trip/.test(t))       signals.trip_type = { value: "LOOP", confidence: CONF.HIGH };
  else if (/surprise|anywhere|explore|no\s*destination/.test(t)) signals.trip_type = { value: "EXPLORATION", confidence: CONF.HIGH };
  else if (/\bto\s+\w|\bheading\s+(to|for)\b|\btowards?\b/.test(t)) signals.trip_type = { value: "POINT_TO_POINT", confidence: CONF.MEDIUM };

  // Mode signals
  if (/\bdrive\b|\bdriving\b|\bcar\b|\broad\s*trip\b/.test(t))   signals.mode = { value: "drive", confidence: CONF.HIGH };
  else if (/\bwalk\b|\bwalking\b|\bhike\b|\bhiking\b/.test(t))   signals.mode = { value: "walk", confidence: CONF.HIGH };
  else if (/\bbike\b|\bcycl/.test(t))                             signals.mode = { value: "cycle", confidence: CONF.HIGH };
  else if (/\bmotorbike\b|\bmotorcycle\b/.test(t))                signals.mode = { value: "motorbike", confidence: CONF.HIGH };

  // Intent / style signals
  const intents = [];
  if (/scenic/.test(t)) intents.push("scenic");
  if (/coastal|coast/.test(t)) intents.push("coastal");
  if (/histor|castle|museum/.test(t)) intents.push("history");
  if (/food|restaurant|eat/.test(t)) intents.push("food");
  if (/nature|park|wildlife/.test(t)) intents.push("nature");
  if (intents.length) signals.intent = intents;

  // Origin / destination hints — rough
  const fromMatch = text.match(/(?:from|starting\s+(?:at|in|from)|leaving)\s+([A-Z][a-zA-Z\s,]{1,30})/);
  if (fromMatch) signals.origin_hint = fromMatch[1].trim();

  const toMatch = text.match(/\bto\s+([A-Z][a-zA-Z\s,]{1,30})/);
  if (toMatch) signals.destination_hint = toMatch[1].trim();

  // Single capitalised word as a likely origin if no from/to
  if (!signals.origin_hint && !signals.destination_hint) {
    const words = text.match(/\b[A-Z][a-z]{2,}\b/g);
    if (words?.length === 1) signals.origin_hint = words[0];
  }

  return signals;
}

// ─── Build threshold check ─────────────────────────────────────────────────────
function meetsThreshold(state) {
  const ok = (field, min) => (state[field]?.confidence ?? CONF.UNKNOWN) >= min;
  const originOk    = ok("origin", CONF.MEDIUM);
  const tripTypeOk  = ok("trip_type", CONF.MEDIUM);
  const durationOk  = state.duration?.confidence === CONF.HIGH; // must be EXPLICIT
  const destOk      = ok("destination", CONF.MEDIUM)
                   || state.trip_type?.value === "LOOP"
                   || state.trip_type?.value === "EXPLORATION";
  return originOk && tripTypeOk && durationOk && destOk;
}

// ─── Next question resolver ────────────────────────────────────────────────────
function nextQuestion(state) {
  // Priority order per spec
  if ((state.duration?.confidence ?? CONF.UNKNOWN) < CONF.HIGH) return "duration";
  if ((state.origin?.confidence ?? CONF.UNKNOWN) < CONF.MEDIUM) return "origin";
  if ((state.trip_type?.confidence ?? CONF.UNKNOWN) < CONF.MEDIUM) return "trip_type";
  if (state.trip_type?.value === "POINT_TO_POINT" && (state.destination?.confidence ?? CONF.UNKNOWN) < CONF.MEDIUM) return "destination";
  if ((state.mode?.confidence ?? CONF.UNKNOWN) < CONF.MEDIUM) return "mode";
  if ((state.duration?.value?.includes("day") || state.duration?.unit === "days") && state.overnight?.confidence === CONF.UNKNOWN) return "overnight";
  return null;
}

// ─── Slide animation ───────────────────────────────────────────────────────────
const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -48 : 48, opacity: 0 }),
};
const slideTransition = { duration: 0.2, ease: "easeInOut" };

// ─── Progress dots (dynamic — only counts asked questions) ────────────────────
function ProgressDots({ asked, current }) {
  const total = Math.max(asked + 1, 1);
  return (
    <div className="flex items-center gap-1.5 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i < asked ? "w-5 h-2 bg-primary/40" : "w-5 h-2 bg-primary"
          }`}
        />
      ))}
    </div>
  );
}

// ─── Chip component ───────────────────────────────────────────────────────────
function Chip({ emoji, label, selected, onClick, disabled }) {
  return (
    <motion.button
      whileTap={{ scale: [1, 1.08, 0.96, 1] }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all border-[1.5px] select-none ${
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-primary/70 bg-white text-primary hover:bg-primary/5"
      } disabled:opacity-40`}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {emoji && <span>{emoji}</span>}
      <span>{label}</span>
    </motion.button>
  );
}

// ─── Place Autocomplete ────────────────────────────────────────────────────────
function PlaceAutocomplete({ placeholder, onSelect, autoFocus }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  const fetchSuggestions = useCallback(async (val) => {
    if (val.length < 2) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke("resolveLocation", { query: val, mode: "autocomplete" });
      setSuggestions((res?.data?.candidates || []).slice(0, 4));
    } catch { setSuggestions([]); }
    setLoading(false);
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 320);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full px-4 py-3 rounded-xl bg-muted/40 border border-border/60 text-sm focus:outline-none focus:border-primary/50 focus:bg-card transition-all"
      />
      {loading && <Loader2 className="absolute right-3 top-3.5 w-4 h-4 animate-spin text-muted-foreground" />}
      <AnimatePresence>
        {suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute z-20 top-full left-0 right-0 mt-1.5 bg-card border border-border rounded-xl shadow-lg overflow-hidden"
          >
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => { setQuery(s.display_name || s.name); setSuggestions([]); onSelect(s); }}
                className="w-full text-left px-4 py-3 text-sm hover:bg-muted/50 transition-colors border-b border-border/40 last:border-0"
              >
                <p className="font-medium text-foreground">{s.display_name || s.name}</p>
                {s.context && <p className="text-[11px] text-muted-foreground mt-0.5">{s.context}</p>}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Question screens ──────────────────────────────────────────────────────────

function DurationQuestion({ onAnswer, loading }) {
  const chips = [
    { id: "couple_hours", emoji: "⏱",  label: "A couple of hours", value: "2 hours",  unit: "hours" },
    { id: "half_day",     emoji: "☀️", label: "Half a day",         value: "half day", unit: "hours" },
    { id: "full_day",     emoji: "🌅", label: "Full day",           value: "full day", unit: "day" },
    { id: "weekend",      emoji: "🌙", label: "Weekend (2 days)",   value: "2 days",   unit: "days" },
    { id: "multi",        emoji: "📅", label: "3 to 5 days",        value: "4 days",   unit: "days" },
    { id: "flexible",     emoji: "🤷", label: "I'm flexible",       value: "flexible", unit: null, flexible: true },
  ];
  const [selected, setSelected] = useState(null);
  const [freeText, setFreeText] = useState("");

  const submit = (chip) => {
    setSelected(chip.id);
    setTimeout(() => onAnswer({ duration: { value: chip.value, unit: chip.unit, confidence: CONF.HIGH, flexible: !!chip.flexible } }), 300);
  };

  const submitText = () => {
    if (!freeText.trim()) return;
    const signals = parseFromText(freeText);
    if (signals.duration) {
      onAnswer({ duration: signals.duration, _freeText: freeText });
    } else {
      // Treat entire text as duration hint
      onAnswer({ duration: { value: freeText.trim(), unit: null, confidence: CONF.HIGH }, _freeText: freeText });
    }
  };

  return (
    <>
      <h2 className="text-2xl font-bold text-foreground leading-snug mb-1">How long do you want to be away?</h2>
      <p className="text-sm text-muted-foreground mb-6">I'll fit the stops and overnights to your time.</p>
      <div className="flex flex-wrap gap-2.5 mb-5">
        {chips.map(c => (
          <Chip key={c.id} emoji={c.emoji} label={c.label} selected={selected === c.id} onClick={() => submit(c)} disabled={loading} />
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={freeText}
          onChange={e => setFreeText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submitText()}
          placeholder="Or describe it…"
          className="flex-1 px-4 py-3 rounded-xl bg-muted/40 border border-border/60 text-sm focus:outline-none focus:border-primary/50"
          disabled={loading}
        />
        {freeText.trim() && (
          <button onClick={submitText} className="px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">→</button>
        )}
      </div>
    </>
  );
}

function OriginQuestion({ onAnswer, loading }) {
  const [showInput, setShowInput] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationConfirm, setLocationConfirm] = useState(null);
  const [freeText, setFreeText] = useState("");

  const handleGPS = async () => {
    setLocationLoading(true);
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
      );
      const { latitude: lat, longitude: lng } = pos.coords;
      const res = await base44.functions.invoke("resolveLocation", { query: `${lat},${lng}`, mode: "reverse" });
      const city = res?.data?.display_name || res?.data?.name || "your location";
      setLocationConfirm({ name: city, lat, lng });
    } catch {
      setShowInput(true);
    }
    setLocationLoading(false);
  };

  const confirmLocation = () => {
    onAnswer({ origin: { value: locationConfirm.name, lat: locationConfirm.lat, lng: locationConfirm.lng, confidence: CONF.HIGH } });
  };

  const handleSelect = (c) => {
    onAnswer({ origin: { value: c.display_name || c.name, lat: c.lat, lng: c.lng, confidence: CONF.HIGH } });
  };

  const submitText = () => {
    if (!freeText.trim()) return;
    onAnswer({ origin: { value: freeText.trim(), confidence: CONF.MEDIUM }, _freeText: freeText });
  };

  return (
    <>
      <h2 className="text-2xl font-bold text-foreground leading-snug mb-1">Where are you starting from?</h2>
      <p className="text-sm text-muted-foreground mb-6">I'll build your route from here.</p>

      {locationConfirm ? (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl bg-primary/5 border border-primary/20 mb-3">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-primary" />
            <p className="text-sm font-medium">Starting from <strong>{locationConfirm.name}</strong> — correct?</p>
          </div>
          <div className="flex gap-2">
            <button onClick={confirmLocation} className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">Yes, that's right</button>
            <button onClick={() => { setLocationConfirm(null); setShowInput(true); }} className="flex-1 h-9 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground">Change it</button>
          </div>
        </motion.div>
      ) : !showInput ? (
        <div className="space-y-3">
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleGPS} disabled={locationLoading}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-[1.5px] border-primary/70 bg-white text-primary text-sm font-medium hover:bg-primary/5 transition-all">
            {locationLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            Use my current location
          </motion.button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowInput(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-[1.5px] border-primary/70 bg-white text-primary text-sm font-medium hover:bg-primary/5 transition-all">
            ✏️ Type a starting place
          </motion.button>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <PlaceAutocomplete placeholder="e.g. London, Doha, Edinburgh…" onSelect={handleSelect} autoFocus />
          <div className="flex gap-2">
            <input value={freeText} onChange={e => setFreeText(e.target.value)} onKeyDown={e => e.key === "Enter" && submitText()}
              placeholder="Or type a city name…"
              className="flex-1 px-4 py-3 rounded-xl bg-muted/40 border border-border/60 text-sm focus:outline-none focus:border-primary/50" />
            {freeText.trim() && <button onClick={submitText} className="px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">→</button>}
          </div>
          <button onClick={() => setShowInput(false)} className="text-xs text-muted-foreground hover:text-foreground">← Use my location instead</button>
        </motion.div>
      )}
    </>
  );
}

function TripTypeQuestion({ onAnswer, loading }) {
  const [selected, setSelected] = useState(null);
  const [showDestInput, setShowDestInput] = useState(false);
  const [freeText, setFreeText] = useState("");

  const chips = [
    { id: "dest",   emoji: "🗺️", label: "I have a destination" },
    { id: "loop",   emoji: "🔄", label: "Loop — back to start" },
    { id: "explore",emoji: "✨", label: "Surprise me" },
  ];

  const submitChip = (id) => {
    setSelected(id);
    if (id === "loop")    setTimeout(() => onAnswer({ trip_type: { value: "LOOP",        confidence: CONF.HIGH } }), 300);
    if (id === "explore") setTimeout(() => onAnswer({ trip_type: { value: "EXPLORATION", confidence: CONF.HIGH } }), 300);
    if (id === "dest")    setTimeout(() => setShowDestInput(true), 300);
  };

  const handleDestSelect = (c) => {
    onAnswer({
      trip_type:   { value: "POINT_TO_POINT", confidence: CONF.HIGH },
      destination: { value: c.display_name || c.name, lat: c.lat, lng: c.lng, confidence: CONF.HIGH },
    });
  };

  const submitText = () => {
    if (!freeText.trim()) return;
    onAnswer({ trip_type: { value: "POINT_TO_POINT", confidence: CONF.MEDIUM }, destination: { value: freeText.trim(), confidence: CONF.MEDIUM }, _freeText: freeText });
  };

  return (
    <>
      <h2 className="text-2xl font-bold text-foreground leading-snug mb-1">Where are you headed?</h2>
      <p className="text-sm text-muted-foreground mb-6">Or I can plan a loop or surprise route.</p>
      {!showDestInput ? (
        <div className="flex flex-wrap gap-2.5 mb-5">
          {chips.map(c => (
            <Chip key={c.id} emoji={c.emoji} label={c.label} selected={selected === c.id} onClick={() => submitChip(c.id)} disabled={loading} />
          ))}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 mb-4">
          <PlaceAutocomplete placeholder="e.g. Paris, Edinburgh, the coast…" onSelect={handleDestSelect} autoFocus />
          <button onClick={() => setShowDestInput(false)} className="text-xs text-muted-foreground hover:text-foreground">← See other options</button>
        </motion.div>
      )}
      {!showDestInput && (
        <div className="flex gap-2">
          <input value={freeText} onChange={e => setFreeText(e.target.value)} onKeyDown={e => e.key === "Enter" && submitText()}
            placeholder="Or describe it…"
            className="flex-1 px-4 py-3 rounded-xl bg-muted/40 border border-border/60 text-sm focus:outline-none focus:border-primary/50"
            disabled={loading} />
          {freeText.trim() && <button onClick={submitText} className="px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">→</button>}
        </div>
      )}
    </>
  );
}

function DestinationQuestion({ onAnswer, loading }) {
  const [freeText, setFreeText] = useState("");

  const handleSelect = (c) => {
    onAnswer({ destination: { value: c.display_name || c.name, lat: c.lat, lng: c.lng, confidence: CONF.HIGH } });
  };

  const submitText = () => {
    if (!freeText.trim()) return;
    onAnswer({ destination: { value: freeText.trim(), confidence: CONF.MEDIUM }, _freeText: freeText });
  };

  return (
    <>
      <h2 className="text-2xl font-bold text-foreground leading-snug mb-1">Where are you heading?</h2>
      <p className="text-sm text-muted-foreground mb-6">I'll route you there via the best stops.</p>
      <div className="space-y-3">
        <PlaceAutocomplete placeholder="e.g. Edinburgh, Rome, the coast…" onSelect={handleSelect} autoFocus />
        <div className="flex gap-2">
          <input value={freeText} onChange={e => setFreeText(e.target.value)} onKeyDown={e => e.key === "Enter" && submitText()}
            placeholder="Or type a destination…"
            className="flex-1 px-4 py-3 rounded-xl bg-muted/40 border border-border/60 text-sm focus:outline-none focus:border-primary/50"
            disabled={loading} />
          {freeText.trim() && <button onClick={submitText} className="px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">→</button>}
        </div>
      </div>
    </>
  );
}

function ModeQuestion({ onAnswer, loading }) {
  const [selected, setSelected] = useState(null);
  const chips = [
    { id: "drive",     emoji: "🚗", label: "Driving",   value: "drive" },
    { id: "walk",      emoji: "🚶", label: "Walking",   value: "walk" },
    { id: "cycle",     emoji: "🚴", label: "Cycling",   value: "cycle" },
    { id: "motorbike", emoji: "🏍", label: "Motorbike", value: "motorbike" },
  ];
  const submit = (c) => {
    setSelected(c.id);
    setTimeout(() => onAnswer({ mode: { value: c.value, confidence: CONF.HIGH } }), 300);
  };
  return (
    <>
      <h2 className="text-2xl font-bold text-foreground leading-snug mb-1">How are you travelling?</h2>
      <p className="text-sm text-muted-foreground mb-6">This shapes how far apart your stops can be.</p>
      <div className="flex flex-wrap gap-2.5">
        {chips.map(c => <Chip key={c.id} emoji={c.emoji} label={c.label} selected={selected === c.id} onClick={() => submit(c)} disabled={loading} />)}
      </div>
    </>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ConciergeGuidedFlow({ onSubmit, loading }) {
  // Opening hook state
  const [phase, setPhase]             = useState("hook"); // hook | questions
  const [freeText, setFreeText]       = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  // Adaptive engine state
  const [journeyState, setJourneyState]     = useState(INITIAL_STATE());
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionsAsked, setQuestionsAsked]   = useState(0);
  const [direction, setDirection]             = useState(1);
  const [history, setHistory]                 = useState([]); // array of { question, prevState }

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // ── Build final text prompt and submit to parent ────────────────────────────
  const buildAndSubmit = useCallback((state, extraText = "") => {
    const parts = [];
    if (state.origin?.value) parts.push(`from ${state.origin.value}`);
    if (state.destination?.value && state.trip_type?.value !== "LOOP" && state.trip_type?.value !== "EXPLORATION") {
      parts.push(`to ${state.destination.value}`);
    }
    if (state.trip_type?.value === "LOOP") parts.push("loop route back to start");
    if (state.trip_type?.value === "EXPLORATION") parts.push("scenic exploration, no fixed destination");
    if (state.duration?.value && !state.duration?.flexible) parts.push(state.duration.value);
    if (state.duration?.flexible) parts.push("flexible duration");
    if (state.mode?.value) parts.push(state.mode.value === "drive" ? "driving" : state.mode.value);
    if (state.intent?.length) parts.push(state.intent.join(", "));
    if (extraText.trim()) parts.push(extraText.trim());

    const prompt = parts.filter(Boolean).join(", ");
    if (prompt) onSubmit(prompt);
  }, [onSubmit]);

  // ── Apply answer to state, check threshold, advance ────────────────────────
  const applyAnswer = useCallback((updates, extraText = "") => {
    setJourneyState(prev => {
      const next = { ...prev };

      // Merge updates into state
      for (const [key, val] of Object.entries(updates)) {
        if (key.startsWith("_")) continue; // skip _freeText etc.
        if (val && typeof val === "object" && "confidence" in val) {
          next[key] = val;
        } else if (key === "intent" || key === "preferences") {
          next[key] = [...(prev[key] || []), ...(Array.isArray(val) ? val : [val])];
        }
      }

      // Infer mode from trip_type if not already set
      if (!next.mode?.value && next.trip_type?.value === "LOOP" || next.trip_type?.value === "POINT_TO_POINT") {
        if (!next.mode?.value) next.mode = { value: "drive", confidence: CONF.MEDIUM };
      }

      // Infer overnight from duration
      const dv = next.duration?.value || "";
      const isMultiDay = /\d+\s*day|\bdays?\b/.test(dv) || dv === "2 days" || dv === "4 days";
      if (isMultiDay && next.overnight?.confidence === CONF.UNKNOWN) {
        next.overnight = { value: true, confidence: CONF.MEDIUM };
      }

      const combinedExtra = (extraText + " " + (updates._freeText || "")).trim();

      // Check threshold
      if (meetsThreshold(next)) {
        setTimeout(() => buildAndSubmit(next, combinedExtra), 10);
        return next;
      }

      // Find next question
      const nq = nextQuestion(next);
      if (!nq) {
        setTimeout(() => buildAndSubmit(next, combinedExtra), 10);
        return next;
      }

      // Navigate forward
      setHistory(h => [...h, { question: currentQuestion, prevState: prev }]);
      setQuestionsAsked(q => q + 1);
      setDirection(1);
      setCurrentQuestion(nq);
      return next;
    });
  }, [buildAndSubmit, currentQuestion]);

  // ── Back navigation ────────────────────────────────────────────────────────
  const goBack = () => {
    if (history.length === 0) {
      setPhase("hook");
      return;
    }
    const last = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setJourneyState(last.prevState);
    setCurrentQuestion(last.question);
    setQuestionsAsked(q => Math.max(0, q - 1));
    setDirection(-1);
  };

  // ── Opening hook free text submit ──────────────────────────────────────────
  const handleFreeTextSubmit = () => {
    if (!freeText.trim() || loading) return;
    const signals = parseFromText(freeText);

    const initial = INITIAL_STATE();
    if (signals.duration)         initial.duration    = signals.duration;
    if (signals.trip_type)        initial.trip_type   = signals.trip_type;
    if (signals.mode)             initial.mode        = signals.mode;
    if (signals.intent?.length)   initial.intent      = signals.intent;
    if (signals.origin_hint)      initial.origin      = { value: signals.origin_hint, confidence: CONF.MEDIUM };
    if (signals.destination_hint) initial.destination = { value: signals.destination_hint, confidence: CONF.MEDIUM };

    // Infer mode from trip type if needed
    if (!initial.mode?.value && (initial.trip_type?.value === "POINT_TO_POINT" || initial.trip_type?.value === "LOOP")) {
      initial.mode = { value: "drive", confidence: CONF.MEDIUM };
    }

    setJourneyState(initial);

    if (meetsThreshold(initial)) {
      onSubmit(freeText.trim());
      return;
    }

    const nq = nextQuestion(initial);
    if (!nq) {
      onSubmit(freeText.trim());
      return;
    }

    setCurrentQuestion(nq);
    setQuestionsAsked(0);
    setDirection(1);
    setPhase("questions");
  };

  // ── Voice recording ────────────────────────────────────────────────────────
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
            setFreeText(prev => prev ? prev + " " + normalized : normalized);
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <AnimatePresence mode="wait" custom={direction}>

        {/* ── OPENING HOOK ──────────────────────────────────────────────── */}
        {phase === "hook" && (
          <motion.div
            key="hook"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
          >
            <h2 className="text-2xl font-bold text-foreground leading-snug mb-1">
              Where do you want to go?
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Tell me your idea — I'll ask only what I need.
            </p>

            {/* Free text */}
            <div className="relative">
              <textarea
                value={freeText}
                onChange={e => setFreeText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleFreeTextSubmit(); }}
                placeholder="e.g. Scenic drive from London, 2 days… or just tell me your idea"
                className="w-full px-4 py-3.5 pr-12 rounded-2xl bg-muted/40 border border-border/60 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:bg-card transition-all resize-none leading-relaxed"
                style={{ minHeight: "100px" }}
                disabled={loading}
                autoFocus
              />
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={transcribing || loading}
                className={`absolute bottom-3.5 right-3.5 p-1.5 rounded-lg transition-all ${
                  isRecording ? "bg-destructive text-white animate-pulse" : "text-muted-foreground/50 hover:text-primary hover:bg-primary/10"
                }`}
              >
                {transcribing ? <Loader2 className="w-4 h-4 animate-spin" /> : isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>

            {freeText.trim().length > 2 && (
              <motion.button
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleFreeTextSubmit}
                disabled={loading}
                className="w-full mt-3 h-12 rounded-2xl bg-primary text-primary-foreground font-semibold text-[15px] flex items-center justify-center gap-2 shadow-md disabled:opacity-40"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Thinking…</>
                  : <><Sparkles className="w-4 h-4" /> Plan my journey <ArrowRight className="w-4 h-4" /></>
                }
              </motion.button>
            )}

            {/* Example prompts */}
            <div className="mt-5">
              <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-2.5">Try something like</p>
              <div className="space-y-1.5">
                {[
                  "Scenic drive from London to Edinburgh, 2 days",
                  "Day trip from Doha, scenic loop",
                  "Drive from London, weekend away",
                  "Walk from the starting point, half a day",
                ].map((p, i) => (
                  <button key={i} onClick={() => setFreeText(p)}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl bg-muted/40 hover:bg-muted/70 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    "{p}"
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── ADAPTIVE QUESTIONS ────────────────────────────────────────── */}
        {phase === "questions" && currentQuestion && (
          <motion.div
            key={`q-${currentQuestion}-${questionsAsked}`}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
          >
            {/* Back + progress */}
            <button onClick={goBack} className="flex items-center gap-1.5 text-xs text-muted-foreground mb-5 hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <ProgressDots asked={questionsAsked} current={currentQuestion} />

            {currentQuestion === "duration"     && <DurationQuestion    onAnswer={applyAnswer} loading={loading} />}
            {currentQuestion === "origin"       && <OriginQuestion      onAnswer={applyAnswer} loading={loading} />}
            {currentQuestion === "trip_type"    && <TripTypeQuestion    onAnswer={applyAnswer} loading={loading} />}
            {currentQuestion === "destination"  && <DestinationQuestion onAnswer={applyAnswer} loading={loading} />}
            {currentQuestion === "mode"         && <ModeQuestion        onAnswer={applyAnswer} loading={loading} />}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}