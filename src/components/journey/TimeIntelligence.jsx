import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ChevronDown, ChevronUp } from "lucide-react";

function formatMinutes(min) {
  if (!min && min !== 0) return null;
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const TIME_OPTIONS = [
  { value: 30,         label: "30 min" },
  { value: 60,         label: "1 hr" },
  { value: 90,         label: "1.5 hrs" },
  { value: 120,        label: "2 hrs" },
  { value: 180,        label: "3 hrs" },
  { value: 240,        label: "4 hrs" },
  { value: 360,        label: "6 hrs" },
  { value: 480,        label: "Full day" },
  { value: "flexible", label: "Flexible" },
];

// Pace modes derived from real route duration
// paceMode hint is sent to the backend to adjust stop count / detour tolerance / pacing
const PACE_MODES = [
  {
    key: "fast",
    emoji: "🚀",
    label: "Fast",
    desc: "Minimal stops, tight detours",
    multiplier: 1.15,
  },
  {
    key: "balanced",
    emoji: "⚖️",
    label: "Balanced",
    desc: "1–2 stops, relaxed pacing",
    multiplier: 1.6,
  },
  {
    key: "exploratory",
    emoji: "🌄",
    label: "Exploratory",
    desc: "Multiple stops, wide detours",
    multiplier: 2.3,
  },
];

/**
 * TimeIntelligence
 *
 * No destination → simple chip grid.
 * Has destination + route loaded → contextual framing:
 *   "This journey naturally takes around X. Want to make it:"
 *   [Fast 🚀] [Balanced ⚖️] [Exploratory 🌄]
 *   Each sets a timeMinutes + paceMode sent to the backend.
 * Custom override always available via expand.
 *
 * onTimeChange({ timeMinutes, paceMode }) — both values emitted together.
 */
export default function TimeIntelligence({
  routeDurationMin,
  routeDurationLoading,
  timeMinutes,
  paceMode,
  hasDestination,
  onTimeChange,
}) {
  const [showCustom, setShowCustom] = useState(false);

  // Compute time value for each pace mode
  const paceModes = routeDurationMin
    ? PACE_MODES.map((pm) => ({
        ...pm,
        value: Math.round(routeDurationMin * pm.multiplier),
      }))
    : null;

  // Which pace mode is currently active?
  const activePaceKey = paceMode || (
    paceModes && typeof timeMinutes === "number"
      ? paceModes.reduce((best, pm) =>
          Math.abs(pm.value - timeMinutes) < Math.abs(best.value - timeMinutes) ? pm : best
        , paceModes[0]).key
      : null
  );

  const handlePaceSelect = (pm) => {
    onTimeChange({ timeMinutes: pm.value, paceMode: pm.key });
    setShowCustom(false);
  };

  const handleCustomSelect = (value) => {
    onTimeChange({ timeMinutes: value, paceMode: null });
  };

  // ── No destination → simple chip grid ────────────────────────────────────
  if (!hasDestination) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Time available
          </span>
          <span className="text-[10px] text-muted-foreground/40">optional</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {TIME_OPTIONS.map(({ value, label }) => (
            <motion.button
              key={value}
              onClick={() => handleCustomSelect(value)}
              whileTap={{ scale: 0.93 }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
                timeMinutes === value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              {label}
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  // ── Has destination → smart pace selector ────────────────────────────────
  return (
    <div>
      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-3">
        Time for this journey
      </span>

      {/* Loading */}
      {routeDurationLoading && !routeDurationMin && (
        <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground/50">
          <div className="w-3 h-3 border-2 border-muted-foreground/20 border-t-muted-foreground/60 rounded-full animate-spin" />
          Calculating route time…
        </div>
      )}

      {/* Natural duration + prompt */}
      {routeDurationMin && (
        <div className="mb-4 p-3.5 rounded-xl bg-muted/40 border border-border/50">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-primary/50" />
            <span className="text-xs text-muted-foreground">
              This journey naturally takes around{" "}
              <span className="font-semibold text-foreground">{formatMinutes(routeDurationMin)}</span>.
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground/70 pl-5">Want to make it:</p>
        </div>
      )}

      {/* Pace mode cards */}
      {paceModes && (
        <div className="flex gap-2 mb-3">
          {paceModes.map((pm) => {
            const isActive = activePaceKey === pm.key;
            return (
              <motion.button
                key={pm.key}
                onClick={() => handlePaceSelect(pm)}
                whileTap={{ scale: 0.96 }}
                className={`flex-1 flex flex-col items-start px-3 py-3 rounded-xl transition-all duration-150 text-left ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted/50 hover:bg-muted"
                }`}
              >
                <span className="text-lg leading-none mb-1.5">{pm.emoji}</span>
                <span className="text-xs font-bold">{pm.label}</span>
                <span className={`text-[10px] mt-0.5 font-medium ${isActive ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {formatMinutes(pm.value)}
                </span>
                <span className={`text-[10px] mt-0.5 leading-tight ${isActive ? "text-primary-foreground/60" : "text-muted-foreground/50"}`}>
                  {pm.desc}
                </span>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Custom time toggle */}
      <button
        onClick={() => setShowCustom(v => !v)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      >
        {showCustom ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {showCustom ? "Hide custom time" : "Set a specific time instead"}
      </button>

      <AnimatePresence>
        {showCustom && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-2 pt-3">
              {TIME_OPTIONS.map(({ value, label }) => (
                <motion.button
                  key={value}
                  onClick={() => handleCustomSelect(value)}
                  whileTap={{ scale: 0.93 }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
                    timeMinutes === value && !activePaceKey
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {label}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}