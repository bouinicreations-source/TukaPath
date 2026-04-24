import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, MapPin, X, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/client";
import { parseJourneyInput, geocodeText, mapParsedToState, normalizeVoiceInput, buildCanonicalPlace } from "@/lib/parseJourneyInput";
import PlaceConfirmationCard from "@/components/journey/PlaceConfirmationCard";
import TimeIntelligence from "@/components/journey/TimeIntelligence";

function haversineKmSimple(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}



const THEME_CHIPS = [
  { key: "coffee",      label: "☕ Coffee",      keywords: ["coffee", "cafe", "drink"] },
  { key: "scenic",      label: "🌄 Scenic",      keywords: ["scenic", "view", "beautiful", "photo"] },
  { key: "sunset",      label: "🌅 Sunset",      keywords: ["sunset", "evening", "golden"] },
  { key: "coastal",     label: "🌊 Coastal",     keywords: ["coast", "sea", "beach", "water", "ocean"] },
  { key: "countryside", label: "🌿 Countryside", keywords: ["country", "rural", "village", "field"] },
  { key: "history",     label: "🏛️ History",    keywords: ["history", "historic", "heritage", "old", "ancient"] },
  { key: "art",         label: "🎨 Art",          keywords: ["art", "gallery", "museum"] },
];

const SMART_CHIP_RULES = [
  { match: /\b(drive|driving|car|road)\b/i,      label: "🚗 Drive",  key: "mode_drive" },
  { match: /\b(walk|walking|stroll|on foot)\b/i, label: "🚶 Walk",   key: "mode_walk" },
  { match: /\b(sunset|golden hour|evening)\b/i,  label: "🌅 Sunset", key: "sunset" },
  { match: /\b(coffee|cafe)\b/i,                 label: "☕ Coffee", key: "coffee" },
  { match: /\b(scenic|beautiful|view)\b/i,       label: "🌄 Scenic", key: "scenic" },
  { match: /\b(quiet|peaceful|calm|relax)\b/i,   label: "🌿 Quiet",  key: "peaceful" },
  { match: /\b(hidden|secret|local)\b/i,         label: "🔍 Hidden", key: "hidden" },
];

function SectionBlock({ children, className = "" }) {
  return (
    <div className={`bg-card border border-border/60 rounded-2xl p-5 shadow-sm space-y-5 ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
      {children}
    </span>
  );
}

// LocationInput now routes through resolveLocation (our scored geocoder) for typed searches,
// so city-first ranking and anti-local-bias rules apply consistently everywhere.
function LocationInput({ label, placeholder, value, onChange, optional = false, hint = null, userPos, partnerLoc = null }) {
  const [query, setQuery] = useState(value?.name || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (value?.name && query !== value.name) setQuery(value.name);
  }, [value]);

  const search = (q) => {
    setQuery(q);
    if (!q.trim()) { setResults([]); setOpen(false); onChange(null); return; }
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await geocodeText(
          q,
          userPos?.lat || null,
          userPos?.lng || null,
          false, null, false,
          partnerLoc?.lat || null,
          partnerLoc?.lng || null,
        );
        if (!res) { setResults([]); setOpen(false); return; }
        if (res.needs_confirmation) {
          setResults(res.candidates || []);
          setOpen((res.candidates || []).length > 0);
        } else {
          setResults([{ name: res.name, lat: res.lat, lng: res.lng, place_type_label: 'Place', confidence: 100 }]);
          setOpen(true);
        }
      } catch {
        setResults([]); setOpen(false);
      }
      setSearching(false);
    }, 400);
  };

  const select = (item) => {
    if (!item.lat || !item.lng || isNaN(item.lat) || isNaN(item.lng)) return;
    const loc = { name: item.name, lat: item.lat, lng: item.lng };
    setQuery(item.name);
    onChange(loc);
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <SectionLabel>{label}</SectionLabel>
        {optional && <span className="text-[10px] text-muted-foreground/50">optional</span>}
      </div>
      <div className="relative flex items-center">
        <MapPin className="absolute left-3.5 w-3.5 h-3.5 text-primary/40 pointer-events-none" />
        <input
          value={query}
          onChange={e => search(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-3 rounded-xl bg-muted/50 border border-border/50 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 focus:bg-card transition-all duration-200 shadow-inner"
        />
        {searching && <div className="absolute right-8 w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />}
        {query && !searching && (
          <button onClick={() => { setQuery(""); onChange(null); setResults([]); setOpen(false); }} className="absolute right-3 text-muted-foreground/40 hover:text-muted-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {hint && <p className="text-[10px] text-muted-foreground/50 mt-1.5 pl-1">{hint}</p>}
      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute z-50 top-full mt-1 left-0 right-0 bg-card border border-border rounded-xl shadow-lg overflow-hidden"
          >
            {results.map((r, i) => (
              <button key={i} onClick={() => select(r)}
                className="w-full text-left px-4 py-3 text-sm hover:bg-muted border-b border-border/40 last:border-0 flex items-start gap-2"
              >
                <MapPin className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <span className="line-clamp-1 text-[13px]">{r.name}</span>
                  {r.place_type_label && r.place_type_label !== 'Place' && (
                    <span className="text-[10px] text-muted-foreground/50"> · {r.place_type_label}</span>
                  )}
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function JourneyInput({ onBuild, userPos, loading, formInputs, onFormChange }) {
  // Destructure from lifted state
  const {
    description = "",
    timeMinutes = null,
    paceMode = null,
    mode = "drive",
    routeStyle = "standard",
    themes = [],
    startLoc,
    destLoc,
  } = formInputs || {};

  // Route duration inference state
  const [routeDurationMin, setRouteDurationMin] = useState(null);
  const [routeDurationLoading, setRouteDurationLoading] = useState(false);

  const [focused, setFocused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  // Pending confirmations: { role: "origin"|"destination", candidates, raw_query }
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  // Queue for destination confirmation to show after origin is resolved
  const pendingDestRef = useRef(null);
  // Track which raw query strings have already been confirmed — prevents re-popup loops
  const confirmedQueriesRef = useRef(new Set());

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const parseTimerRef = useRef(null);

  // Set default start location once userPos is available, if not set
  useEffect(() => {
    if (!startLoc && userPos && onFormChange) {
      onFormChange({ startLoc: { name: "Current location", lat: userPos.lat, lng: userPos.lng } });
    }
  }, [userPos, startLoc, onFormChange]);

  // Fetch real route duration when both start + destination are set
  useEffect(() => {
    if (!startLoc?.lat || !startLoc?.lng || !destLoc?.lat || !destLoc?.lng) {
      setRouteDurationMin(null);
      return;
    }
    let cancelled = false;
    setRouteDurationLoading(true);
    const profile = mode === "walk" ? "foot" : "driving";
    fetch(
      `https://router.project-osrm.org/route/v1/${profile}/${startLoc.lng},${startLoc.lat};${destLoc.lng},${destLoc.lat}?overview=false`,
      { signal: AbortSignal.timeout(6000) }
    )
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        const dur = d?.routes?.[0]?.duration;
        if (dur) setRouteDurationMin(dur / 60);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setRouteDurationLoading(false); });
    return () => { cancelled = true; };
  }, [startLoc?.lat, startLoc?.lng, destLoc?.lat, destLoc?.lng, mode]);

  const softHighlighted = THEME_CHIPS
    .filter(chip => chip.keywords.some(kw => description.toLowerCase().includes(kw)))
    .map(chip => chip.key);

  const smartChips = SMART_CHIP_RULES.filter(r => r.match.test(description));

  // Use refs for values we need inside runGptParser but don't want to cause re-runs
  const startLocRef = useRef(startLoc);
  const destLocRef  = useRef(destLoc);
  const themesRef   = useRef(themes);
  const timeMinutesRef = useRef(timeMinutes);
  useEffect(() => { startLocRef.current  = startLoc;    }, [startLoc]);
  useEffect(() => { destLocRef.current   = destLoc;     }, [destLoc]);
  useEffect(() => { themesRef.current    = themes;       }, [themes]);
  useEffect(() => { timeMinutesRef.current = timeMinutes; }, [timeMinutes]);

  const runGptParser = useCallback(async (text, fromVoice = false) => {
    if (!text.trim() || text.length < 8) return;
    setIsParsing(true);
    try {
      const parsed = await parseJourneyInput(text);
      const state = mapParsedToState(parsed, timeMinutesRef.current);
      const updates = {};

      if (parsed.trip_type === 'loop_journey') updates.destLoc = null;
      if (state.mode) updates.mode = state.mode;
      if (state.routeStyle) updates.routeStyle = state.routeStyle;
      if (state.timeMinutes !== undefined) updates.timeMinutes = state.timeMinutes;
      if (state.themes?.length) updates.themes = [...new Set([...(themesRef.current || []), ...state.themes])];

      const uLat = userPos?.lat || null, uLng = userPos?.lng || null;
      const isTravelMode = !!(parsed.origin_text && parsed.destination_text);

      // Read current loc state from refs — avoids stale closure AND avoids re-creating the callback
      const currentStartLoc = startLocRef.current;
      const currentDestLoc  = destLocRef.current;

      // Skip geocoding if already confirmed or already resolved
      const originAlreadyConfirmed = parsed.origin_text && confirmedQueriesRef.current.has(parsed.origin_text.toLowerCase().trim());
      const destAlreadyConfirmed   = parsed.destination_text && confirmedQueriesRef.current.has(parsed.destination_text.toLowerCase().trim());
      const originAlreadySet = !!(currentStartLoc?.lat && currentStartLoc?.lng);
      const destAlreadySet   = !!(currentDestLoc?.lat && currentDestLoc?.lng);

      // Pass partner coords when known — improves plausibility scoring
      const partnerForDest = currentStartLoc?.lat ? currentStartLoc : null;
      const partnerForOrigin = currentDestLoc?.lat ? currentDestLoc : null;

      const [originResult, destResult] = await Promise.all([
        (parsed.origin_text && !originAlreadyConfirmed && !originAlreadySet)
          ? geocodeText(parsed.origin_text, uLat, uLng, fromVoice, parsed.destination_text, isTravelMode, partnerForOrigin?.lat || null, partnerForOrigin?.lng || null)
          : Promise.resolve(null),
        (parsed.destination_text && !destAlreadyConfirmed && !destAlreadySet)
          ? geocodeText(parsed.destination_text, uLat, uLng, fromVoice, parsed.origin_text, isTravelMode, partnerForDest?.lat || null, partnerForDest?.lng || null)
          : Promise.resolve(null),
      ]);

      if (originResult?.needs_confirmation) {
        setPendingConfirmation({ role: "origin", candidates: originResult.candidates, raw_query: originResult.raw_query });
        if (destResult?.needs_confirmation) {
          pendingDestRef.current = { role: "destination", candidates: destResult.candidates, raw_query: destResult.raw_query };
        } else if (destResult) {
          updates.destLoc = destResult;
        }
      } else {
        if (originResult) updates.startLoc = originResult;

        if (destResult?.needs_confirmation) {
          setPendingConfirmation({ role: "destination", candidates: destResult.candidates, raw_query: destResult.raw_query });
        } else if (destResult) {
          const resolvedOrigin = originResult || currentStartLoc;
          if (resolvedOrigin && destResult && state.timeMinutes) {
            const distKm = haversineKmSimple(resolvedOrigin.lat, resolvedOrigin.lng, destResult.lat, destResult.lng);
            const maxRealisticKm = (state.timeMinutes / 60) * 150;
            if (distKm > maxRealisticKm * 3) {
              setPendingConfirmation({ role: "destination", candidates: [destResult], raw_query: destResult.name, absurd: true, distKm: Math.round(distKm) });
            } else {
              updates.destLoc = destResult;
            }
          } else {
            updates.destLoc = destResult;
          }
        }
      }

      if (Object.keys(updates).length > 0) onFormChange(updates);
    } catch {}
    setIsParsing(false);
  // Only stable values in deps — userPos and onFormChange are stable refs
  }, [userPos, onFormChange]);

  useEffect(() => {
    clearTimeout(parseTimerRef.current);
    if (!description.trim()) return;
    parseTimerRef.current = setTimeout(() => runGptParser(description), 900);
    return () => clearTimeout(parseTimerRef.current);
  }, [description, runGptParser]);

  // Called when user picks a candidate from the confirmation card
  const handlePlaceConfirmed = (candidate) => {
    // Build a full canonical place object — user_confirmed=true locks the choice
    const resolved = buildCanonicalPlace(candidate, true) || {
      display_name: candidate.name, canonical_name: candidate.name,
      name: candidate.name, lat: candidate.lat, lng: candidate.lng,
      country: candidate.country || null, place_kind: candidate.place_type_label || 'place',
      resolution_confidence: candidate.confidence || 100, user_confirmed: true,
    };

    // Mark this query as confirmed so the parser never re-shows the popup
    if (pendingConfirmation?.raw_query) {
      confirmedQueriesRef.current.add(pendingConfirmation.raw_query.toLowerCase().trim());
    }
    if (pendingConfirmation?.role === "origin") {
      onFormChange({ startLoc: resolved });
      // Chain to queued destination confirmation if any
      if (pendingDestRef.current) {
        setPendingConfirmation(pendingDestRef.current);
        pendingDestRef.current = null;
      } else {
        setPendingConfirmation(null);
      }
    } else {
      onFormChange({ destLoc: resolved });
      setPendingConfirmation(null);
    }
  };

  const toggleTheme = (key) => {
    onFormChange({ themes: themes.includes(key) ? themes.filter(t => t !== key) : [...themes, key] });
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    chunksRef.current = [];
    mr.ondataavailable = e => chunksRef.current.push(e.data);
    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      try {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], "recording.webm", { type: "audio/webm" });
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        const res = await base44.functions.invoke("transcribeAudio", { file_url });
        if (res?.data?.text) {
          const normalized = normalizeVoiceInput(res.data.text);
          const fullText = description ? description + " " + normalized : normalized;
          onFormChange({ description: fullText });
          runGptParser(fullText, true); // fromVoice=true → stricter ambiguity rules
        }
      } catch {
        // Voice transcription failed (e.g. guest user) — silently ignore
      }
    };
    mr.start();
    mediaRecorderRef.current = mr;
    setIsRecording(true);
  };

  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); };

  const handleBuild = () => {
    // Block journey generation until all place confirmations are resolved
    if (pendingConfirmation) return;
    const effectiveStart = startLoc || (userPos ? { name: "Current location", lat: userPos.lat, lng: userPos.lng } : null);
    const effectiveTime = timeMinutes === "flexible" ? null : (timeMinutes || null);
    onBuild({ description, startLoc: effectiveStart, destLoc, timeMinutes: effectiveTime, paceMode, mode, routeStyle, themes, flexible: timeMinutes === "flexible" });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pb-4">

      {/* ── BLOCK 1: Hero + Description + Themes ─────────────────────────── */}
      <SectionBlock>
        {/* Hero */}
        <div>
          <h2 className="text-[22px] font-bold text-foreground leading-snug">Where are you headed?</h2>
          <p className="text-[13px] text-muted-foreground mt-1">Describe it however feels right.</p>
        </div>

        {/* Description */}
        <motion.div animate={{ scale: focused ? 1.005 : 1 }} transition={{ duration: 0.15 }} className="relative">
          <textarea
            value={description}
            onChange={e => onFormChange({ description: e.target.value })}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="e.g. A quiet drive north, stop somewhere with a view…"
            className="w-full px-4 py-4 pr-12 rounded-xl bg-muted/50 border border-border/50 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 focus:bg-card transition-all duration-200 resize-none leading-relaxed shadow-sm"
            style={{ minHeight: focused || description ? "100px" : "76px", transition: "min-height 0.2s ease" }}
          />
          {isParsing && (
            <div className="absolute top-3 right-12 flex items-center gap-1 text-[10px] text-primary/40">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
            </div>
          )}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`absolute bottom-3.5 right-3.5 p-1.5 rounded-full transition-colors ${isRecording ? "bg-destructive text-white animate-pulse" : "text-muted-foreground/30 hover:text-foreground"}`}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </motion.div>

        {/* Smart chips from description */}
        <AnimatePresence>
          {smartChips.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex flex-wrap gap-1.5 overflow-hidden -mt-2">
              {smartChips.map(chip => (
                <motion.span key={chip.key} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-primary/70 border border-primary/20 font-medium">
                  {chip.label}
                </motion.span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Themes */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <SectionLabel>Themes</SectionLabel>
            <span className="text-[10px] text-muted-foreground/40">optional</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {THEME_CHIPS.map(({ key, label }) => {
              const isSelected = themes.includes(key);
              const isSoft = !isSelected && softHighlighted.includes(key);
              return (
                <motion.button key={key} onClick={() => toggleTheme(key)} whileTap={{ scale: 0.93 }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : isSoft
                      ? "bg-primary/10 text-primary/80 border border-primary/20"
                      : "bg-muted/70 text-muted-foreground hover:bg-muted"
                  }`}>
                  {label}
                </motion.button>
              );
            })}
          </div>
        </div>
      </SectionBlock>

      {/* ── PLACE AMBIGUITY CONFIRMATION ─────────────────────────────────── */}
      <AnimatePresence>
        {pendingConfirmation && (
          <PlaceConfirmationCard
            rawQuery={pendingConfirmation.raw_query}
            role={pendingConfirmation.role}
            candidates={pendingConfirmation.candidates}
            absurd={pendingConfirmation.absurd}
            distKm={pendingConfirmation.distKm}
            onConfirm={handlePlaceConfirmed}
            onSearchAgain={() => { setPendingConfirmation(null); pendingDestRef.current = null; }}
          />
        )}
      </AnimatePresence>

      {/* ── BLOCK 2: From / To ────────────────────────────────────────────── */}
      <SectionBlock>
        <LocationInput label="Starting from" placeholder="Current location" value={startLoc} onChange={loc => { if (!loc) confirmedQueriesRef.current.clear(); onFormChange({ startLoc: loc }); }} userPos={userPos} partnerLoc={destLoc} />
        <div className="h-px bg-border/40" />
        <LocationInput label="Destination" placeholder="Where would you like to end?" value={destLoc} onChange={loc => { if (!loc) confirmedQueriesRef.current.clear(); onFormChange({ destLoc: loc }); }} optional hint="Leave empty for a loop journey" userPos={userPos} partnerLoc={startLoc} />
      </SectionBlock>

      {/* ── BLOCK 3: Mode + Time + Style ─────────────────────────────────── */}
      <SectionBlock>
        {/* Mode */}
        <div>
          <SectionLabel>How are you travelling?</SectionLabel>
          <div className="flex gap-2 mt-3">
            {[{ key: "drive", label: "🚗 Drive" }, { key: "walk", label: "🚶 Walk" }].map(({ key, label }) => {
              const isActive = mode === key;
              return (
                <motion.button key={key} onClick={() => onFormChange({ mode: key })} whileTap={{ scale: 0.97 }}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}>
                  {label}
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-border/40" />

        {/* Time Intelligence */}
        <TimeIntelligence
          routeDurationMin={routeDurationMin}
          routeDurationLoading={routeDurationLoading}
          timeMinutes={timeMinutes}
          paceMode={paceMode}
          hasDestination={!!(destLoc?.lat && destLoc?.lng)}
          onTimeChange={({ timeMinutes: t, paceMode: p }) => onFormChange({ timeMinutes: t, paceMode: p ?? null })}
        />

        <div className="h-px bg-border/40" />

        {/* Route style */}
        <div>
          <SectionLabel>Route style</SectionLabel>
          <div className="flex gap-3 mt-3">
            {[
              { key: "standard", label: "Standard",  hint: "Efficient" },
              { key: "scenic",   label: "🌄 Scenic",  hint: "Slower, more beautiful" },
            ].map(({ key, label, hint }) => {
              const isActive = routeStyle === key;
              return (
                <motion.button key={key} onClick={() => onFormChange({ routeStyle: key })} whileTap={{ scale: 0.97 }}
                  className={`flex-1 flex flex-col items-start px-4 py-3.5 rounded-xl text-left transition-all duration-150 ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-muted/50 hover:bg-muted"
                  }`}>
                  <span className="text-xs font-bold">{label}</span>
                  <span className={`text-[10px] mt-0.5 ${isActive ? "text-primary-foreground/70" : "text-muted-foreground/70"}`}>{hint}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </SectionBlock>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <div className="pt-2">
        <motion.div whileTap={{ scale: 0.984 }} transition={{ duration: 0.1 }}>
          <Button
            className="w-full rounded-2xl bg-primary hover:bg-primary/90 font-bold text-[15px] relative overflow-hidden shadow-lg"
            onClick={handleBuild}
            disabled={loading || !!pendingConfirmation}
            style={{ height: "54px" }}
          >
            {loading && (
              <motion.div
                className="absolute inset-0 pointer-events-none"
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)" }}
              />
            )}
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.span key="loading" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Designing your journey…
                </motion.span>
              ) : (
                <motion.span key="idle" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="flex items-center gap-2">
                  Create my journey <ArrowRight className="w-4 h-4" />
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </motion.div>
        <p className="text-center text-[10px] text-muted-foreground/40 mt-3">
          We pick the stops. You drive.
        </p>
      </div>

    </motion.div>
  );
}