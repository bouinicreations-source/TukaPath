import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, MapPin, Hotel, Coffee, Star, Zap, Clock, ExternalLink, Send } from "lucide-react";
import RefinementBar from "./RefinementBar";

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-muted/60 rounded-lg ${className}`} />;
}

function StageSkeleton({ stage }) {
  if (stage === "route") return (
    <div className="space-y-3">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <div className="flex gap-2 mt-3">
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-16 rounded-full" />
      </div>
    </div>
  );
  if (stage === "segments") return (
    <div className="space-y-3">
      {[0, 1].map(i => (
        <div key={i} className="border border-border rounded-2xl p-4 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
  if (stage === "stops") return (
    <div className="space-y-2">
      {[0, 1, 2].map(i => (
        <div key={i} className="flex gap-3 p-3 border border-border/40 rounded-xl">
          <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
  return null;
}

// ── Confidence Badge ──────────────────────────────────────────────────────────
function ConfidenceBadge({ confidence, reason }) {
  const cfg = {
    HIGH:   { color: "text-emerald-600 bg-emerald-50 border-emerald-200", icon: "✓" },
    MEDIUM: { color: "text-amber-600 bg-amber-50 border-amber-200",       icon: "~" },
    LOW:    { color: "text-slate-500 bg-slate-50 border-slate-200",       icon: "?" },
  }[confidence] || { color: "text-slate-500 bg-slate-50 border-slate-200", icon: "?" };

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-mono font-semibold ${cfg.color}`}
      title={reason}>
      {cfg.icon} {confidence === "LOW" ? "AI" : confidence}
    </span>
  );
}

// ── Stop Card ─────────────────────────────────────────────────────────────────
function StopCard({ stop, index }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="border border-border/60 rounded-xl overflow-hidden"
    >
      <div className="flex items-start gap-3 p-3">
        {stop.location?.image_url ? (
          <img src={stop.location.image_url} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            <MapPin className="w-4 h-4 text-muted-foreground/40" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold leading-snug">{stop.name || stop.location?.name}</p>
            <div className="flex items-center gap-1 flex-shrink-0">
              {stop.confidence && <ConfidenceBadge confidence={stop.confidence} reason={stop.confidence_reason} />}
              <button onClick={() => setExpanded(e => !e)} className="p-0.5 text-muted-foreground/40 hover:text-muted-foreground">
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{stop.why_included || stop.hook}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {stop.visit_duration && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                <Clock className="w-3 h-3" />{stop.visit_duration}
              </span>
            )}
            {stop.stop_role && (
              <span className="text-[10px] text-muted-foreground/50 capitalize">{stop.stop_role.replace(/_/g, " ")}</span>
            )}
          </div>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border/40"
          >
            <div className="px-3 py-2.5 space-y-1.5 text-xs text-muted-foreground">
              {stop.confidence_reason && <p>📍 {stop.confidence_reason}</p>}
              {stop.location?.city && <p>📌 {stop.location.city}, {stop.location.country}</p>}
              {stop.location?.id
                ? <p className="text-emerald-600/70">✓ DB-backed · {stop.location.id.slice(0, 8)}…</p>
                : <p className="text-amber-500/70">⚠ No DB record</p>
              }
              {stop.saved_stop_id
                ? <p className="text-emerald-600/70">✓ Saved · stop {stop.saved_stop_id.slice(0, 8)}…</p>
                : <p className="text-slate-400/60 italic">Not yet persisted</p>
              }
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Hotel Card ────────────────────────────────────────────────────────────────
function HotelCard({ hotel }) {
  return (
    <div className="border border-border/60 rounded-xl p-3 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
        <Hotel className="w-4 h-4 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-snug">{hotel.name}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{hotel.city}</p>
        {hotel.booking_link && (
          <a href={hotel.booking_link} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-primary font-medium hover:underline">
            Book <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

// ── Day Segment Card ──────────────────────────────────────────────────────────
function DayCard({ segment, dayIndex, stageReached }) {
  const [open, setOpen] = useState(true);
  const stops = segment.stops || [];
  const hotels = segment.hotels || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: dayIndex * 0.1 }}
      className="border border-border rounded-2xl overflow-hidden"
    >
      {/* Day header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-muted/30 hover:bg-muted/60 transition-colors text-left"
      >
        <div>
          <p className="text-sm font-bold text-foreground">Day {segment.leg_number || dayIndex + 1}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {segment.start_city || "Start"} → {segment.overnight_city || segment.end_city || "Destination"}
            {segment.distance_km ? ` · ${Math.round(segment.distance_km)} km` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {segment.route_character && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">
              {segment.route_character}
            </span>
          )}
          {segment.saved_leg_id && (
            <span className="text-[9px] text-emerald-600/60 font-mono" title={`Leg id: ${segment.saved_leg_id}`}>✓</span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-3 space-y-3">
              {/* Route bias */}
              {segment.route_bias && (
                <p className="text-[11px] text-muted-foreground/70 italic">
                  Route shaped via {segment.route_bias}
                </p>
              )}

              {/* Stops loading */}
              {stageReached < 3 ? (
                <StageSkeleton stage="stops" />
              ) : stops.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">Stops</p>
                  {stops.map((stop, i) => <StopCard key={i} stop={stop} index={i} />)}
                </div>
              ) : null}

              {/* Hotels */}
              {stageReached >= 4 && hotels.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest flex items-center gap-1.5">
                    <Hotel className="w-3 h-3" /> Overnight
                  </p>
                  {hotels.map((h, i) => <HotelCard key={i} hotel={h} />)}
                </div>
              )}
              {stageReached === 4 && hotels.length === 0 && segment.overnight_city && (
                <div className="flex items-center gap-2 py-2">
                  <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Support Layer ─────────────────────────────────────────────────────────────
function SupportLayer({ support }) {
  if (!support?.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest flex items-center gap-1.5">
        <Coffee className="w-3 h-3" /> Along the way
      </p>
      {support.map((item, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-muted/30 rounded-xl text-xs text-muted-foreground">
          <span className="flex-shrink-0">{item.type === "fuel" ? "⛽" : item.type === "food" ? "🍽️" : "☕"}</span>
          <span>{item.description || item.name}</span>
        </div>
      ))}
    </div>
  );
}

// ── Export Bar ────────────────────────────────────────────────────────────────
function ExportBar({ journey }) {
  const allStops = (journey.segments || []).flatMap(s => s.stops || []);
  const coords = allStops.filter(s => s.lat && s.lng).map(s => `${s.lat},${s.lng}`).join("/");

  const googleUrl = coords
    ? `https://www.google.com/maps/dir/${coords}`
    : null;

  const isApple = /iPhone|iPad|iPod|Mac/.test(navigator.userAgent);

  return (
    <div className="flex gap-2">
      {googleUrl && (
        <a href={googleUrl} target="_blank" rel="noopener noreferrer"
          className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
          <ExternalLink className="w-3.5 h-3.5" />
          Google Maps
        </a>
      )}
      {isApple && allStops[0]?.lat && (
        <a href={`maps://maps.apple.com/?daddr=${allStops[allStops.length - 1]?.lat},${allStops[allStops.length - 1]?.lng}`}
          className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
          <ExternalLink className="w-3.5 h-3.5" />
          Apple Maps
        </a>
      )}
    </div>
  );
}

// ── Stage progress bar ────────────────────────────────────────────────────────
const STAGE_LABELS = ["Route", "Intent", "Segments", "Stops", "Hotels", "Support"];

function StageProgress({ stage }) {
  return (
    <div className="flex items-center gap-1">
      {STAGE_LABELS.map((label, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className={`h-1 rounded-full transition-all duration-500 ${
            i + 1 <= stage ? "bg-primary" : "bg-muted"
          }`} style={{ width: i + 1 <= stage ? "28px" : "16px" }} />
        </div>
      ))}
      <span className="text-[10px] text-muted-foreground/60 ml-1">
        {STAGE_LABELS[Math.min(stage - 1, STAGE_LABELS.length - 1)]}…
      </span>
    </div>
  );
}

// ── Persistence Badge ─────────────────────────────────────────────────────────
function PersistenceBadge({ journey }) {
  const d = journey?.debug || {};
  if (!d.journey_saved) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-700 font-medium">
      <span>✓</span>
      <span>Journey saved · {d.saved_leg_count} {d.saved_leg_count === 1 ? 'leg' : 'legs'} · {d.saved_stop_count} {d.saved_stop_count === 1 ? 'stop' : 'stops'}</span>
      {d.fallback_used && <span className="ml-auto text-amber-600">fallback used</span>}
      {d.weak_stop_candidates_rejected > 0 && <span className="ml-1 text-slate-500">{d.weak_stop_candidates_rejected} weak rejected</span>}
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function ConciergeJourneyView({ journey, stage, onRefine, refining, refineMessage, onRefineMessageSeen, onCustomRefine }) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customAck, setCustomAck] = useState(null);

  if (!journey && stage < 1) return null;

  const segments = journey?.segments || [];
  const support  = journey?.support  || [];

  return (
    <div className="space-y-5">
      {/* Stage progress */}
      {stage < 6 && <StageProgress stage={stage} />}

      {/* Persistence status — shown once journey is fully built */}
      {stage >= 6 && <PersistenceBadge journey={journey} />}

      {/* Route overview */}
      {stage >= 1 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          {journey?.journey_title && (
            <h2 className="text-xl font-bold tracking-tight">{journey.journey_title}</h2>
          )}
          {journey?.summary && (
            <p className="text-sm text-muted-foreground leading-relaxed">{journey.summary}</p>
          )}
          {/* Route pills */}
          <div className="flex flex-wrap gap-1.5">
            {journey?.trip_type && (
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
                {journey.trip_type === "MULTI_DAY" ? "Multi-day" : journey.trip_type === "OVERNIGHT" ? "Overnight" : "Day trip"}
              </span>
            )}
            {journey?.route_character && (
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium capitalize">
                {journey.route_character}
              </span>
            )}
            {journey?.total_distance_km && (
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                ~{Math.round(journey.total_distance_km)} km
              </span>
            )}
            {journey?.total_duration_hours && (
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                ~{journey.total_duration_hours}h driving
              </span>
            )}
          </div>
              {/* Truth note — shown when route label could not be verified */}
          {journey?.truth_note && (
            <p className="text-[11px] text-amber-600/80 italic">{journey.truth_note}</p>
          )}
          {/* Partial match note — shown when stops are empty */}
          {journey?.partial_match_note && (
            <p className="text-[11px] text-muted-foreground/60 italic">{journey.partial_match_note}</p>
          )}
        </motion.div>
      ) : (
        <StageSkeleton stage="route" />
      )}

      {/* Segments loading */}
      {stage === 2 && <StageSkeleton stage="segments" />}

      {/* Day segments */}
      {stage >= 2 && segments.length > 0 && (
        <div className="space-y-3">
          {segments.map((seg, i) => (
            <DayCard key={i} segment={seg} dayIndex={i} stageReached={stage} />
          ))}
          {/* Single journey-level empty notice — only if ALL legs have no stops */}
          {stage >= 3 && segments.every(s => (s.stops || []).length === 0) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-4 py-3.5 rounded-xl bg-muted/40 border border-border/40 text-sm text-muted-foreground leading-relaxed"
            >
              We're still growing our library for this region.
              Here are the best suggestions we can offer right now.
            </motion.div>
          )}
        </div>
      )}

      {/* Support layer */}
      {stage >= 5 && <SupportLayer support={support} />}

      {/* Export */}
      {stage >= 3 && segments.length > 0 && (
        <ExportBar journey={journey} />
      )}

      {/* Refinement */}
      {stage >= 2 && (
        <div className="pt-2 border-t border-border/40 space-y-3">
          <RefinementBar
            onRefine={(r) => {
              if (r.type === "custom_open") {
                setCustomAck("Looks like you want to adjust your journey — tell me what you'd like to change.");
                setShowCustomInput(true);
                return;
              }
              onRefine(r);
            }}
            loading={refining}
          />

          {/* Custom input thread */}
          {customAck && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-end gap-2.5"
            >
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] text-primary-foreground font-bold">T</span>
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-card border border-border/80 shadow-sm text-sm text-foreground leading-relaxed max-w-[85%]">
                {customAck}
              </div>
            </motion.div>
          )}

          {showCustomInput && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="flex gap-2"
            >
              <input
                autoFocus
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && customPrompt.trim() && !refining) {
                    const text = customPrompt.trim();
                    setCustomPrompt("");
                    setShowCustomInput(false);
                    setCustomAck(null);
                    // Route back to concierge chat with the text — never silently drop
                    if (onCustomRefine) onCustomRefine(text);
                    else onRefine({ type: "text", text });
                  }
                }}
                placeholder="e.g. Add more stops, fewer museums, more nature…"
                disabled={refining}
                className="flex-1 px-4 py-2.5 rounded-xl bg-muted/50 border border-border/60 text-sm focus:outline-none focus:border-primary/40 transition-colors disabled:opacity-50"
              />
              <button
                onClick={() => {
                  if (!customPrompt.trim() || refining) return;
                  const text = customPrompt.trim();
                  setCustomPrompt("");
                  setShowCustomInput(false);
                  setCustomAck(null);
                  if (onCustomRefine) onCustomRefine(text);
                  else onRefine({ type: "text", text });
                }}
                disabled={!customPrompt.trim() || refining}
                className="px-3 py-2.5 rounded-xl bg-primary text-primary-foreground disabled:opacity-40 transition-opacity"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}

          {/* Refine response message */}
          {refineMessage && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              onAnimationComplete={onRefineMessageSeen}
              className="flex items-end gap-2.5"
            >
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] text-primary-foreground font-bold">T</span>
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-card border border-border/80 shadow-sm text-sm text-foreground leading-relaxed max-w-[85%]">
                {refineMessage}
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}