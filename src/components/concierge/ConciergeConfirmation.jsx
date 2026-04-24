/**
 * ConciergeConfirmation — Archetype Wizard
 *
 * Shows BEFORE journey build.
 * Displays the classified archetype in human language.
 * All fields inline-editable with instant re-classification on duration change.
 * No page navigation needed to edit any field.
 */
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Edit2, Loader2, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { classifyArchetype, ARCHETYPES, parseDurationHours } from "@/lib/archetypeEngine";
import { base44 } from "@/api/client";

// ── Duration chip rows ─────────────────────────────────────────────────────────
const DURATION_CHIPS = [
  { label: "1 hr",     value: "1 hour",   unit: "hours" },
  { label: "2 hrs",    value: "2 hours",  unit: "hours" },
  { label: "3 hrs",    value: "3 hours",  unit: "hours" },
  { label: "4 hrs",    value: "4 hours",  unit: "hours" },
  { label: "Half day", value: "half day", unit: "hours" },
  { label: "Full day", value: "full day", unit: "day" },
  { label: "2 days",   value: "2 days",   unit: "days" },
  { label: "3 days",   value: "3 days",   unit: "days" },
  { label: "4 days",   value: "4 days",   unit: "days" },
  { label: "5 days",   value: "5 days",   unit: "days" },
  { label: "Flexible", value: "flexible", unit: null, flexible: true },
];

const STYLE_CHIPS = ["Scenic", "Coastal", "Cultural", "Countryside", "Efficient"];

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildTitle(plan, archetypeResult) {
  const { route_character, pacing, origin_display } = plan;
  const style = route_character
    ? route_character.charAt(0).toUpperCase() + route_character.slice(1)
    : pacing === "fast" ? "Efficient" : "Scenic";
  const typeLabel = archetypeResult?.humanLabel || "drive";
  return `${style} ${typeLabel.toLowerCase()}${origin_display ? ` · ${origin_display}` : ""}`;
}

function getChipValue(durationValue) {
  // Map a plan duration value back to a chip label for display
  const chip = DURATION_CHIPS.find(c => c.value === durationValue);
  return chip?.label || durationValue || "Unknown";
}

function formatOvernightHint(plan, archetypeResult) {
  if (!archetypeResult?.profile?.overnight) return null;
  const { destination_display, regions = [], segments = [] } = plan;
  const region = regions?.[0]?.resolved_region_name;
  if (region) return `Near ${region}`;
  if (destination_display) return `Near ${destination_display}`;
  if (segments.length > 0) {
    const mid = segments[Math.floor(segments.length / 2)];
    const city = mid?.overnight_city || mid?.to_anchor;
    if (city) return `Near ${city}`;
  }
  return "Along the route";
}

function detectAssumptions(plan) {
  const flags = [];
  const assumptions = plan.assumptions || [];
  const hasDuration = assumptions.some(a => /duration|days|trip_duration|number_of_days/.test(a.field));
  const hasMode     = assumptions.some(a => a.field === "mode");
  if (hasDuration) flags.push({ field: "duration", text: "Duration assumed — tap Duration to set it precisely." });
  if (hasMode)     flags.push({ field: "mode",     text: "Travel mode assumed as driving." });
  return flags;
}

// ── Small Chip ────────────────────────────────────────────────────────────────
function Chip({ label, active, onClick, disabled, pulse }) {
  return (
    <motion.button
      whileTap={pulse ? { scale: [1, 1.08, 0.96, 1], transition: { duration: 0.15 } } : {}}
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all shrink-0 ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-muted/40 text-muted-foreground border-border/60 hover:border-primary/40 hover:text-foreground"
      } disabled:opacity-40`}
    >
      {label}
    </motion.button>
  );
}

// ── Editable field row ────────────────────────────────────────────────────────
function EditableRow({ label, value, assumed, open, onToggle, children }) {
  return (
    <div className="border-b border-border/40 last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3 text-left group"
      >
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${assumed ? "text-amber-700" : "text-foreground"}`}>
            {value}{assumed ? " *" : ""}
          </span>
          {open
            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/60" />
            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity" />
          }
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden pb-3"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Origin inline search ──────────────────────────────────────────────────────
function OriginPicker({ current, onSelect }) {
  const [query, setQuery] = useState(current || "");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useState(null);

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
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); clearTimeout(debounceRef[0]); debounceRef[0] = setTimeout(() => search(e.target.value), 320); }}
        placeholder="Type a city or place…"
        className="w-full px-3 py-2 rounded-lg bg-muted/40 border border-border/60 text-sm focus:outline-none focus:border-primary/50"
      />
      {loading && <Loader2 className="absolute right-2.5 top-2.5 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      <AnimatePresence>
        {suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden"
          >
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => { setSuggestions([]); setQuery(s.display_name || s.name); onSelect(s); }}
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

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────
export default function ConciergeConfirmation({ plan, onConfirm, onEdit, building }) {
  // Local editable state — starts from plan, user can modify without re-fetching
  const [localPlan, setLocalPlan] = useState(() => plan);
  const [openField, setOpenField] = useState(null);

  // Update localPlan when parent plan changes (e.g. after clarification)
  // but don't override user edits
  const [lastPlanId, setLastPlanId] = useState(null);
  if (plan !== null && plan !== lastPlanId) {
    setLastPlanId(plan);
    setLocalPlan(plan);
  }

  if (!localPlan) return null;

  const { needs_clarification, clarifying_question, origin_display, destination_display, trip_type } = localPlan;

  // ── Clarification mode ────────────────────────────────────────────────────
  if (needs_clarification && clarifying_question) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span>🤔</span>
          </div>
          <div>
            <p className="text-sm font-semibold">One quick question</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{clarifying_question}</p>
          </div>
        </div>
        <textarea id="clarification-input" placeholder="Type your answer…"
          className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border/60 text-sm focus:outline-none focus:border-primary/40 resize-none"
          style={{ minHeight: "72px" }} />
        <button
          onClick={() => { const v = document.getElementById("clarification-input")?.value?.trim(); if (v) onConfirm(v); }}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm">
          Got it, continue →
        </button>
      </motion.div>
    );
  }

  // ── Archetype classification (live, deterministic) ────────────────────────
  const archetypeResult = classifyArchetype(localPlan);
  const { archetype, humanLabel, profile, stopsRange, rhythmLabel, isMultiDay } = archetypeResult;
  const durationUnknown = archetype === ARCHETYPES.UNRESOLVED;

  const title       = buildTitle(localPlan, archetypeResult);
  const overnight   = formatOvernightHint(localPlan, archetypeResult);
  const assumptions = detectAssumptions(localPlan);

  // Get current duration display
  const durValue = localPlan.duration?.value || localPlan._duration_value || null;
  const durLabel = durValue ? getChipValue(durValue) : "Not set";
  const durAssumed = assumptions.some(a => a.field === "duration");

  // Get style
  const style = localPlan.route_character
    ? localPlan.route_character.charAt(0).toUpperCase() + localPlan.route_character.slice(1)
    : "Scenic";

  // ── Field toggle helpers ──────────────────────────────────────────────────
  const toggleField = (field) => setOpenField(prev => prev === field ? null : field);

  // ── Duration change — triggers instant archetype re-classification ────────
  const handleDurationChange = (chip) => {
    const next = {
      ...localPlan,
      duration: { value: chip.value, unit: chip.unit, confidence: 3, flexible: !!chip.flexible },
      _duration_value: chip.value,
      _duration_unit: chip.unit,
    };
    setLocalPlan(next);
    // Close picker after 400ms
    setTimeout(() => setOpenField(null), 400);
    // Notify parent so onEdit can re-submit if needed
    if (onEdit) onEdit({ duration: chip.value });
  };

  // ── Style change ──────────────────────────────────────────────────────────
  const handleStyleChange = (s) => {
    setLocalPlan(prev => ({ ...prev, route_character: s.toLowerCase() }));
    setTimeout(() => setOpenField(null), 400);
    if (onEdit) onEdit({ style: s.toLowerCase() });
  };

  // ── Origin change ─────────────────────────────────────────────────────────
  const handleOriginSelect = (candidate) => {
    const name = candidate.display_name || candidate.name;
    setLocalPlan(prev => ({ ...prev, origin_display: name, origin_text: name }));
    setOpenField(null);
    if (onEdit) onEdit({ origin: name });
  };

  // ── Build it ──────────────────────────────────────────────────────────────
  const handleBuild = () => {
    // Pass enriched localPlan back to parent before building
    if (onEdit) onEdit({ _localPlan: localPlan });
    onConfirm();
  };

  // ── Summary chips (non-editable) ──────────────────────────────────────────
  const summaryChips = [
    localPlan.mode ? (localPlan.mode === "DRIVE" ? "Driving" : localPlan.mode.charAt(0) + localPlan.mode.slice(1).toLowerCase()) : null,
    durLabel !== "Not set" ? durLabel : null,
    trip_type === "LOOP" ? "Loop" : trip_type === "MULTI_DAY" ? "Multi-day" : trip_type === "DAY_TRIP" ? "Day trip" : null,
    style,
  ].filter(Boolean);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl overflow-hidden">

      {/* ── Title + Archetype ────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4">
        <h2 className="text-xl font-bold text-primary leading-tight">{title}</h2>

        {/* Archetype label */}
        <p className="text-xs text-muted-foreground mt-1">
          {humanLabel}
          {archetypeResult.estimatedDays && archetype === ARCHETYPES.JOURNEY_BUILDER
            ? ` · ${archetypeResult.estimatedDays} days`
            : durLabel !== "Not set" ? ` · ${durLabel}` : ""}
        </p>

        {/* Route line */}
        {(origin_display || destination_display) && (
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
            <span className="font-medium text-foreground/80">{localPlan.origin_display || origin_display || "Your location"}</span>
            {destination_display && trip_type !== "LOOP" && (
              <>
                <span className="text-muted-foreground/40">→</span>
                <span className="font-medium text-foreground/80">{destination_display}</span>
              </>
            )}
            {trip_type === "LOOP" && <span className="text-muted-foreground/60 text-xs">loop route</span>}
          </div>
        )}

        {/* Summary chips */}
        {summaryChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {summaryChips.map((c, i) => (
              <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">{c}</span>
            ))}
          </div>
        )}
      </div>

      {/* ── Editable fields ──────────────────────────────────────────────── */}
      <div className="px-5 pb-2">
        <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-1">
          Looks right? Adjust anything.
        </p>

        {/* Duration */}
        <EditableRow
          label="Duration"
          value={durLabel}
          assumed={durAssumed}
          open={openField === "duration"}
          onToggle={() => toggleField("duration")}
        >
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {DURATION_CHIPS.map(c => (
              <Chip
                key={c.label}
                label={c.label}
                active={durValue === c.value || (c.flexible && localPlan.duration?.flexible)}
                onClick={() => handleDurationChange(c)}
                pulse
              />
            ))}
          </div>
        </EditableRow>

        {/* From */}
        <EditableRow
          label="From"
          value={localPlan.origin_display || origin_display || "—"}
          open={openField === "from"}
          onToggle={() => toggleField("from")}
        >
          <OriginPicker current={localPlan.origin_display || origin_display} onSelect={handleOriginSelect} />
        </EditableRow>

        {/* Overnight — only if archetype needs it */}
        {profile?.overnight && (
          <EditableRow
            label="Overnight"
            value={overnight || "Along the route"}
            open={openField === "overnight"}
            onToggle={() => toggleField("overnight")}
          >
            <p className="text-xs text-muted-foreground leading-relaxed">
              Overnight city will be confirmed when the journey is built based on distance and timing.
              {overnight && ` Suggested: ${overnight}.`}
            </p>
          </EditableRow>
        )}

        {/* Style */}
        <EditableRow
          label="Style"
          value={style}
          open={openField === "style"}
          onToggle={() => toggleField("style")}
        >
          <div className="flex flex-wrap gap-2">
            {STYLE_CHIPS.map(s => (
              <Chip
                key={s}
                label={s}
                active={style === s}
                onClick={() => handleStyleChange(s)}
                pulse
              />
            ))}
          </div>
        </EditableRow>

        {/* Structure summary */}
        <div className="py-3 space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">Estimated stops</span>
            <span className="text-sm font-semibold">{stopsRange}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">Travel rhythm</span>
            <span className="text-sm font-semibold">{rhythmLabel}</span>
          </div>
        </div>
      </div>

      {/* ── Assumption notes ─────────────────────────────────────────────── */}
      {assumptions.length > 0 && (
        <div className="mx-5 mb-4 px-3.5 py-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
          {assumptions.map((a, i) => (
            <button key={i} onClick={() => toggleField(a.field)} className="w-full text-left flex items-start gap-2">
              <span className="text-amber-500 mt-0.5 flex-shrink-0 text-xs">✦</span>
              <p className="text-xs text-amber-800 leading-relaxed underline-offset-2 hover:underline">{a.text}</p>
            </button>
          ))}
        </div>
      )}

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="flex border-t border-border">
        <button
          onClick={() => setOpenField(openField ? null : "duration")}
          disabled={building}
          className="flex-1 flex items-center justify-center gap-1.5 py-3.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors font-medium"
        >
          <Edit2 className="w-3.5 h-3.5" />
          Change something
        </button>
        <div className="w-px bg-border" />
        {durationUnknown ? (
          <button
            onClick={() => setOpenField("duration")}
            className="flex-1 flex items-center justify-center gap-1.5 py-3.5 text-sm text-amber-700 font-bold hover:bg-amber-50 transition-colors"
          >
            Tell me how long first →
          </button>
        ) : (
          <button
            onClick={handleBuild}
            disabled={building}
            className="flex-1 flex items-center justify-center gap-1.5 py-3.5 text-sm text-primary font-bold hover:bg-primary/5 transition-colors disabled:opacity-50"
          >
            {building
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Building…</>
              : "Yes, build it →"
            }
          </button>
        )}
      </div>
    </motion.div>
  );
}