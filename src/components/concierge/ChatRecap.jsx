/**
 * ChatRecap — structured recap card that appears inline in the chat thread.
 * Shows archetype, editable fields, assumption notes, and the build button.
 * No separate screen. No modals. All inline.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Loader2, MapPin, Edit2, X, Plus } from "lucide-react";
import { classifyArchetype, ARCHETYPES, getFirstMissingField } from "@/lib/archetypeEngine";
import { base44 } from "@/api/client";

// ── Duration chips ──────────────────────────────────────────────────────────
const DURATION_CHIPS = [
  { label: "1 hr",     value: "1 hour",   unit: "hours" },
  { label: "2 hrs",    value: "2 hours",  unit: "hours" },
  { label: "3 hrs",    value: "3 hours",  unit: "hours" },
  { label: "4 hrs",    value: "4 hours",  unit: "hours" },
  { label: "Half day", value: "half day", unit: "hours" },
  { label: "Full day", value: "full day", unit: "day"   },
  { label: "2 days",   value: "2 days",   unit: "days"  },
  { label: "3 days",   value: "3 days",   unit: "days"  },
  { label: "4 days",   value: "4 days",   unit: "days"  },
  { label: "5 days",   value: "5 days",   unit: "days"  },
  { label: "Flexible", value: "flexible", unit: null, flexible: true },
];
const MODE_CHIPS  = [
  { label: "Car",       value: "drive",     emoji: "🚗" },
  { label: "Motorbike", value: "motorbike", emoji: "🏍" },
  { label: "Walk",      value: "walk",      emoji: "🚶" },
  { label: "Cycle",     value: "cycle",     emoji: "🚴" },
];
const STYLE_CHIPS = ["Scenic", "Coastal", "Cultural", "Countryside", "Efficient"];

// ── Helpers ─────────────────────────────────────────────────────────────────
function durLabel(state) {
  const v = state.duration?.value;
  if (!v) return null;
  const chip = DURATION_CHIPS.find(c => c.value === v);
  return chip?.label || v;
}

function modeLabel(state) {
  const v = state.mode?.value;
  if (!v) return null;
  return MODE_CHIPS.find(c => c.value === v)?.label || v;
}

function styleLabel(state) {
  const v = state.route_character || state.style;
  if (!v) return null;
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function overnightHint(state, archetypeResult) {
  if (!archetypeResult?.profile?.overnight) return null;
  const dest = state.destination?.value || state.destination_display;
  if (dest) return `Near ${dest}`;
  return "Along the route";
}

// ── Inline field row ─────────────────────────────────────────────────────────
function FieldRow({ label, value, open, onToggle, assumed, children }) {
  return (
    <div className="border-b border-border/40 last:border-0">
      <button onClick={onToggle} className="w-full flex items-center justify-between py-2.5 text-left group">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-semibold ${assumed ? "text-amber-700" : "text-foreground"}`}>
            {value}{assumed ? " *" : ""}
          </span>
          {open
            ? <ChevronUp className="w-3 h-3 text-muted-foreground/50" />
            : <ChevronDown className="w-3 h-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
          }
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.16 }}
            className="overflow-hidden pb-3"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Chip ─────────────────────────────────────────────────────────────────────
function Chip({ label, active, onClick }) {
  return (
    <motion.button
      whileTap={{ scale: [1, 1.08, 0.96, 1], transition: { duration: 0.15 } }}
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all shrink-0 ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-muted/40 text-muted-foreground border-border/60 hover:border-primary/40 hover:text-foreground"
      }`}
    >
      {label}
    </motion.button>
  );
}

// ── Origin picker ────────────────────────────────────────────────────────────
function InlinePlacePicker({ placeholder, onSelect }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounce = useState(null);

  const search = async (val) => {
    if (val.length < 2) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke("resolveLocation", { query: val, mode: "autocomplete" });
      setSuggestions((res?.data?.candidates || []).slice(0, 3));
    } catch { setSuggestions([]); }
    setLoading(false);
  };

  return (
    <div className="relative">
      <input type="text" value={query}
        onChange={e => { setQuery(e.target.value); clearTimeout(debounce[0]); debounce[0] = setTimeout(() => search(e.target.value), 320); }}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg bg-muted/40 border border-border/60 text-sm focus:outline-none focus:border-primary/50"
        autoFocus
      />
      {loading && <Loader2 className="absolute right-2.5 top-2.5 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      <AnimatePresence>
        {suggestions.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => { setSuggestions([]); setQuery(""); onSelect(s); }}
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/50 border-b border-border/40 last:border-0">
                <p className="font-medium">{s.display_name || s.name}</p>
                {s.context && <p className="text-[11px] text-muted-foreground">{s.context}</p>}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ChatRecap({ journeyState, onBuild, onFieldChange, building }) {
  const [openField, setOpenField] = useState(null);

  const archetypeResult = classifyArchetype(journeyState);
  const { archetype, humanLabel, profile, stopsRange, rhythmLabel, estimatedDays } = archetypeResult;
  const missingField = getFirstMissingField(journeyState);
  const canBuild = missingField === null;

  const dur     = durLabel(journeyState);
  const mode    = modeLabel(journeyState);
  const style   = styleLabel(journeyState);
  const origin  = journeyState.origin?.value;
  const dest    = journeyState.destination?.value;
  const tripType= journeyState.trip_type?.value;
  const overnight = overnightHint(journeyState, archetypeResult);
  const viaStops = journeyState.via_stops || [];

  // Title
  const styleStr = style || (journeyState.pacing === "fast" ? "Efficient" : "Scenic");
  const title = `${styleStr} ${humanLabel?.toLowerCase() || "journey"}${origin ? ` · ${origin}` : ""}`;

  // Archetype subtitle
  const subtitle = [
    humanLabel,
    estimatedDays && archetype === ARCHETYPES.JOURNEY_BUILDER ? `${estimatedDays} days` : dur,
  ].filter(Boolean).join(" · ");

  // Summary chips
  const summaryChips = [
    mode,
    dur,
    tripType === "LOOP" ? "Loop" : tripType === "POINT_TO_POINT" ? "Point to point" : tripType === "EXPLORATION" ? "Open" : null,
    style,
  ].filter(Boolean);

  // Assumptions
  const assumptions = [];
  if (journeyState.mode?.confidence < 3 && mode) {
    assumptions.push({ field: "mode", text: `Assumed: ${mode} — from your description.` });
  }
  if (style && !journeyState.route_character_explicit) {
    assumptions.push({ field: "style", text: `Assumed: ${style} — from your description.` });
  }

  const toggle = (field) => setOpenField(prev => prev === field ? null : field);

  const handleDurationPick = (chip) => {
    onFieldChange("duration", { value: chip.value, unit: chip.unit, confidence: 3, flexible: !!chip.flexible });
    setTimeout(() => setOpenField(null), 400);
  };

  const handleModePick = (chip) => {
    onFieldChange("mode", { value: chip.value, confidence: 3 });
    setTimeout(() => setOpenField(null), 400);
  };

  const handleStylePick = (s) => {
    onFieldChange("route_character", s.toLowerCase());
    setTimeout(() => setOpenField(null), 400);
  };

  const handleOriginSelect = (candidate) => {
    onFieldChange("origin", { value: candidate.display_name || candidate.name, lat: candidate.lat, lng: candidate.lng, confidence: 3 });
    setOpenField(null);
  };

  const handleDestSelect = (candidate) => {
    onFieldChange("destination", { value: candidate.display_name || candidate.name, lat: candidate.lat, lng: candidate.lng, confidence: 3 });
    setOpenField(null);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl overflow-hidden ml-9">

      {/* Title */}
      <div className="px-4 pt-4 pb-3">
        <h3 className="text-base font-bold text-primary leading-tight">{title}</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>

        {origin && (
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground flex-wrap">
            <MapPin className="w-3 h-3 text-primary/50 flex-shrink-0" />
            <span className="font-medium text-foreground/80">{origin}</span>
            {viaStops.map((v, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="text-muted-foreground/40">→</span>
                <span className="font-medium text-foreground/80">{v.name}</span>
              </span>
            ))}
            {dest && tripType !== "LOOP" && (
              <span className="flex items-center gap-1">
                <span className="text-muted-foreground/40">→</span>
                <span className="font-medium text-foreground/80">{dest}</span>
              </span>
            )}
            {tripType === "LOOP" && <span className="opacity-60 ml-1">loop</span>}
          </div>
        )}

        {summaryChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {summaryChips.map((c, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{c}</span>
            ))}
          </div>
        )}
      </div>

      {/* Editable fields */}
      <div className="px-4 pb-1">
        <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-1">
          Looks right? Tap anything to adjust.
        </p>

        {/* Duration */}
        <FieldRow label="Duration" value={dur || "Tap to set"} open={openField === "duration"} onToggle={() => toggle("duration")} assumed={!dur}>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {DURATION_CHIPS.map(c => (
              <Chip key={c.label} label={c.label}
                active={journeyState.duration?.value === c.value || (c.flexible && journeyState.duration?.flexible)}
                onClick={() => handleDurationPick(c)} />
            ))}
          </div>
        </FieldRow>

        {/* From */}
        <FieldRow label="From" value={origin || "Tap to set"} open={openField === "from"} onToggle={() => toggle("from")} assumed={!origin}>
          <InlinePlacePicker placeholder="Search city or place…" onSelect={handleOriginSelect} />
        </FieldRow>

        {/* Via stops — shown if any detected, or for multi-stop archetype */}
        {(viaStops.length > 0 || archetype === ARCHETYPES.MULTI_STOP) && (
          <FieldRow
            label="Stops through"
            value={viaStops.length > 0 ? viaStops.map(v => v.name).join(" → ") : "None added"}
            open={openField === "via"}
            onToggle={() => toggle("via")}
          >
            <div className="space-y-2">
              {viaStops.map((v, i) => (
                <div key={i} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-muted/40 border border-border/50 text-xs font-medium">
                  <span>{v.name}</span>
                  <button
                    onClick={() => {
                      const next = viaStops.filter((_, idx) => idx !== i);
                      onFieldChange("via_stops", next);
                    }}
                    className="text-muted-foreground/50 hover:text-destructive transition-colors ml-2"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <InlinePlacePicker
                placeholder="Add a stop…"
                onSelect={(candidate) => {
                  const next = [...viaStops, { name: candidate.display_name || candidate.name }];
                  onFieldChange("via_stops", next);
                }}
              />
            </div>
          </FieldRow>
        )}

        {/* To — only for point to point */}
        {(dest || tripType === "POINT_TO_POINT") && (
          <FieldRow label="To" value={dest || "Tap to set"} open={openField === "to"} onToggle={() => toggle("to")} assumed={!dest}>
            <InlinePlacePicker placeholder="Destination city or place…" onSelect={handleDestSelect} />
          </FieldRow>
        )}

        {/* Overnight — only for multi-day */}
        {profile?.overnight && (
          <FieldRow label="Overnight" value={overnight || "Along the route"} open={openField === "overnight"} onToggle={() => toggle("overnight")}>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Overnight city confirmed when journey is built from real route distance.
              {overnight && ` Suggested: ${overnight}.`}
            </p>
          </FieldRow>
        )}

        {/* Mode */}
        {mode && (
          <FieldRow label="Getting there" value={mode} open={openField === "mode"} onToggle={() => toggle("mode")}
            assumed={journeyState.mode?.confidence < 3}>
            <div className="flex flex-wrap gap-2">
              {MODE_CHIPS.map(c => (
                <Chip key={c.value} label={`${c.emoji} ${c.label}`}
                  active={journeyState.mode?.value === c.value}
                  onClick={() => handleModePick(c)} />
              ))}
            </div>
          </FieldRow>
        )}

        {/* Style */}
        {style && (
          <FieldRow label="Feel" value={style} open={openField === "style"} onToggle={() => toggle("style")}>
            <div className="flex flex-wrap gap-2">
              {STYLE_CHIPS.map(s => (
                <Chip key={s} label={s} active={style === s} onClick={() => handleStylePick(s)} />
              ))}
            </div>
          </FieldRow>
        )}

        {/* Structure */}
        <div className="py-2.5 space-y-1.5">
          <div className="flex justify-between">
            <span className="text-xs text-muted-foreground">Estimated stops</span>
            <span className="text-xs font-semibold">{stopsRange}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-muted-foreground">Rhythm</span>
            <span className="text-xs font-semibold">{rhythmLabel}</span>
          </div>
        </div>
      </div>

      {/* Assumptions */}
      {assumptions.length > 0 && (
        <div className="mx-4 mb-3 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
          {assumptions.map((a, i) => (
            <button key={i} onClick={() => toggle(a.field)} className="w-full text-left flex items-start gap-1.5">
              <span className="text-amber-500 text-[10px] mt-0.5 shrink-0">✦</span>
              <p className="text-xs text-amber-800 leading-relaxed hover:underline underline-offset-2">{a.text}</p>
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex border-t border-border">
        <button onClick={() => toggle("duration")} disabled={building}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors font-medium">
          <Edit2 className="w-3.5 h-3.5" />
          Change something
        </button>
        <div className="w-px bg-border" />
        {!canBuild ? (
          <button onClick={() => setOpenField(missingField === "duration_days" ? "duration" : missingField)}
            className="flex-1 flex items-center justify-center py-3 text-xs text-amber-700 font-bold hover:bg-amber-50 transition-colors">
            Set {missingField === "duration_days" ? "trip duration" : missingField} first →
          </button>
        ) : (
          <button onClick={onBuild} disabled={building}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs text-primary font-bold hover:bg-primary/5 transition-colors disabled:opacity-50">
            {building ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Building…</> : "Plan my journey →"}
          </button>
        )}
      </div>
    </motion.div>
  );
}