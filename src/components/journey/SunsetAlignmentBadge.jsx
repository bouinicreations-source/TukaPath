import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";

const QUALITY_CONFIG = {
  perfect:     { icon: "🌅", label: "Sunset aligned",          color: "bg-amber-50 border-amber-200 text-amber-800",  dot: "bg-amber-400" },
  strong:      { icon: "🌅", label: "Golden hour timing",      color: "bg-amber-50 border-amber-200 text-amber-800",  dot: "bg-amber-400" },
  good:        { icon: "🌇", label: "Evening light window",    color: "bg-orange-50 border-orange-200 text-orange-800", dot: "bg-orange-400" },
  approximate: { icon: "🌆", label: "Approximate sunset timing", color: "bg-orange-50 border-orange-100 text-orange-700", dot: "bg-orange-300" },
  weak:        { icon: "🌃", label: "Limited sunset alignment", color: "bg-slate-50 border-slate-200 text-slate-600",  dot: "bg-slate-300" },
  none:        { icon: "🌃", label: "No sunset feature",        color: "bg-slate-50 border-slate-200 text-slate-500",  dot: "bg-slate-300" },
};

// Mini timeline bar: departure → mid-route → sunset
function TimelineBar({ departure, sunset, goldenStart, currentMin }) {
  // Normalize to a visible window: departure - 15 min to sunset + 20 min
  const windowStart = departure - 15;
  const windowEnd   = sunset + 20;
  const span        = windowEnd - windowStart;
  if (span <= 0) return null;

  const pct = (min) => Math.max(0, Math.min(100, ((min - windowStart) / span) * 100));

  const depPct    = pct(departure);
  const goldPct   = pct(goldenStart);
  const sunsetPct = pct(sunset);
  const nowPct    = currentMin ? pct(currentMin) : null;

  return (
    <div className="mt-3 relative">
      <div className="relative h-2 bg-gradient-to-r from-sky-200 via-amber-200 to-orange-300 rounded-full overflow-visible">
        {/* Golden hour zone highlight */}
        <div
          className="absolute top-0 h-full bg-amber-300/50 rounded-full"
          style={{ left: `${goldPct}%`, width: `${sunsetPct - goldPct}%` }}
        />

        {/* Departure marker */}
        <div className="absolute -top-1" style={{ left: `${depPct}%`, transform: "translateX(-50%)" }}>
          <div className="w-2.5 h-4 bg-primary rounded-sm" title="Departure" />
        </div>

        {/* Golden hour start */}
        <div className="absolute top-0" style={{ left: `${goldPct}%`, transform: "translateX(-50%)" }}>
          <div className="w-0.5 h-2 bg-amber-500" />
        </div>

        {/* Sunset marker */}
        <div className="absolute -top-1" style={{ left: `${sunsetPct}%`, transform: "translateX(-50%)" }}>
          <span className="text-[11px] leading-none">🌅</span>
        </div>

        {/* Current time dot */}
        {nowPct !== null && (
          <div className="absolute top-0" style={{ left: `${nowPct}%`, transform: "translateX(-50%)" }}>
            <div className="w-2 h-2 rounded-full bg-white border-2 border-primary shadow-sm" />
          </div>
        )}
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-1.5 text-[9px] text-muted-foreground/60">
        <span>Depart</span>
        <span className="text-amber-600 font-medium">Golden hour</span>
        <span>Sunset</span>
      </div>
    </div>
  );
}

export default function SunsetAlignmentBadge({ sunsetAlignment, loading }) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-100 bg-amber-50/50 animate-pulse">
        <span className="text-sm">🌅</span>
        <span className="text-xs text-amber-700/50">Checking sunset timing…</span>
      </div>
    );
  }

  if (!sunsetAlignment) return null;

  const { alignment, sun, sunset_stop, departure_suggestion, experience_text, fallback_message, sunset_intent_active } = sunsetAlignment;

  // Only show if sunset intent is active OR alignment is strong+
  if (!sunset_intent_active && (!alignment?.quality || ['weak', 'none'].includes(alignment.quality))) return null;

  const quality = alignment?.quality || 'none';
  const cfg = QUALITY_CONFIG[quality] || QUALITY_CONFIG.none;

  const showTimeline = sun?.sunset_local_minutes && alignment?.ideal_departure_time
    && !['none', 'weak'].includes(quality);

  // Parse "HH:MM" → minutes
  const parseMins = (hhmm) => {
    if (!hhmm) return null;
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };

  const depMins    = parseMins(alignment?.ideal_departure_time);
  const sunsetMins = sun?.sunset_local_minutes;
  const goldMins   = sun?.golden_hour_start_minutes;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border rounded-2xl overflow-hidden ${cfg.color}`}
    >
      {/* Header row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-lg leading-none">{cfg.icon}</span>
        <div className="flex-1 text-left">
          <p className="text-xs font-bold">{cfg.label}</p>
          {sun?.sunset_time && (
            <p className="text-[10px] opacity-70 mt-0.5">Sunset at {sun.sunset_time} · Golden hour {sun.golden_hour_start}–{sun.golden_hour_end}</p>
          )}
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 opacity-50" /> : <ChevronDown className="w-3.5 h-3.5 opacity-50" />}
      </button>

      {/* Expandable detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-current/10">

              {/* Experience text */}
              {experience_text && (
                <p className="text-[11px] leading-relaxed opacity-80 pt-3 italic">"{experience_text}"</p>
              )}

              {/* Fallback */}
              {fallback_message && (
                <p className="text-[11px] leading-relaxed opacity-70 pt-3">{fallback_message}</p>
              )}

              {/* Sunset stop */}
              {sunset_stop?.name && (
                <div className="flex items-center gap-2 text-[11px]">
                  <div className={`w-2 h-2 rounded-full ${cfg.dot} flex-shrink-0`} />
                  <span className="font-semibold">Best sunset spot:</span>
                  <span className="opacity-80">{sunset_stop.name}</span>
                  <span className="opacity-50 capitalize">({sunset_stop.category})</span>
                </div>
              )}

              {/* Departure suggestion */}
              {departure_suggestion && (
                <div className={`text-[11px] px-3 py-2 rounded-lg ${
                  departure_suggestion.type === 'on_time'  ? 'bg-green-100/60 text-green-800' :
                  departure_suggestion.type === 'tight'    ? 'bg-red-100/60 text-red-800' :
                  'bg-amber-100/60 text-amber-800'
                }`}>
                  {departure_suggestion.type === 'on_time'  ? '✓ ' : departure_suggestion.type === 'tight' ? '⚠ ' : '💡 '}
                  {departure_suggestion.message}
                </div>
              )}

              {/* Timeline bar */}
              {showTimeline && depMins && sunsetMins && goldMins && (
                <TimelineBar
                  departure={depMins}
                  sunset={sunsetMins}
                  goldenStart={goldMins}
                  currentMin={null}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}