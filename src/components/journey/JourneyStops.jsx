import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, X, RefreshCw, Headphones, ChevronDown, ChevronUp, MapPin, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/client";
import JourneyMap from "./JourneyMap";
import JourneyServiceStrip from "./JourneyServiceStrip";
import SunsetAlignmentBadge from "./SunsetAlignmentBadge";
import MissedOpportunityEngine from "./MissedOpportunityEngine";
import GeneratedStopCard from "./GeneratedStopCard";
import HotelSuggestions from "./HotelSuggestions";
import MultiDayJourneyView from "./MultiDayJourneyView";
import { trackJourneyEvent } from "@/lib/personalization";

// ─── Role display metadata ────────────────────────────────────────────────────
const ROLE_META = {
  main_highlight:      { label: "Worth the pause",        color: "bg-primary/10 text-primary",     dot: "bg-primary" },
  sunset_anchor:       { label: "Catch the light here",   color: "bg-amber-100 text-amber-700",    dot: "bg-amber-500" },
  secondary_highlight: { label: "Worth a look",           color: "bg-emerald-100 text-emerald-700",dot: "bg-emerald-500" },
  scenic_pass:         { label: "Let it pass by",         color: "bg-sky-100 text-sky-700",        dot: "bg-sky-400" },
  quick_stop:          { label: "If you feel like it",    color: "bg-slate-100 text-slate-600",    dot: "bg-slate-400" },
  coffee_stop:         { label: "Good for a break",       color: "bg-amber-50 text-amber-700",     dot: "bg-amber-300" },
  meal_stop:           { label: "Good for a break",       color: "bg-amber-50 text-amber-700",     dot: "bg-amber-300" },
  rest_stop:           { label: "Only if you need it",    color: "bg-slate-100 text-slate-500",    dot: "bg-slate-300" },
  fuel_stop:           { label: "Only if you need it",    color: "bg-slate-100 text-slate-500",    dot: "bg-slate-300" },
  arrival_highlight:   { label: "Once you're there",      color: "bg-teal-100 text-teal-700",      dot: "bg-teal-400" },
  anchor:              { label: "Worth the pause",        color: "bg-primary/10 text-primary",     dot: "bg-primary" },
  highlight:           { label: "Worth a look",           color: "bg-amber-100 text-amber-700",    dot: "bg-amber-400" },
  connector:           { label: "If you feel like it",    color: "bg-slate-100 text-slate-600",    dot: "bg-slate-400" },
};

// Is this a support role (visually secondary)?
const SUPPORT_ROLES = new Set(["coffee_stop", "meal_stop", "rest_stop", "fuel_stop"]);

function getRoleMeta(roleKey, stop) {
  const base = ROLE_META[roleKey] || { label: "Stop", color: "bg-slate-100 text-slate-600", dot: "bg-slate-400" };
  // Prefer guardrail-injected micro copy when available
  if (stop?._micro_copy) return { ...base, label: stop._micro_copy };
  return base;
}

// ─── Individual stop card ─────────────────────────────────────────────────────
function StopCard({ stop, index, onRemove, onReplace, replacing, replaceCandidates, isActive, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const cardRef = useRef(null);
  const roleKey = (stop.stop_role || "default").toLowerCase().replace(/-/g, "_");
  const role    = getRoleMeta(roleKey, stop);
  const isSupport = SUPPORT_ROLES.has(roleKey);
  const lid = stop.location?.id || stop.location?.location_id;

  // Scroll card into view when selected from map
  React.useEffect(() => {
    if (isActive && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isActive]);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ delay: index * 0.04 }}
    >
      <div
        className={`bg-card border rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer
          ${isActive
            ? "border-primary shadow-md ring-1 ring-primary/30"
            : "border-border hover:border-primary/30 hover:shadow-sm"
          }
          ${isSupport ? "opacity-85" : ""}
        `}
        onClick={() => onSelect(lid)}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Sequence indicator */}
            <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5
              ${isActive ? "bg-primary text-primary-foreground" : "bg-foreground/10 text-foreground"}`}>
              {index + 1}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className={`text-sm font-semibold ${isSupport ? "text-foreground/70" : ""}`}>
                  {stop.location?.name || "Unknown"}
                </p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${role.color}`}>
                  {role.label}
                </span>
              </div>

              <p className={`text-xs leading-relaxed mb-2 ${isSupport ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
                {stop.hook}
              </p>

              <div className="flex items-center gap-2 flex-wrap">
                {stop.route_label && stop.route_label !== "On route" && (
                  <span className="text-[10px] text-amber-600">
                    {stop.route_label}
                  </span>
                )}
                {stop.dwell_minutes && (
                  <span className="text-[10px] text-muted-foreground/60">{stop.dwell_minutes} min</span>
                )}
              </div>
            </div>

            {/* Card actions */}
            <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setExpanded(e => !e)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => onRemove(stop)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Expanded details */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-4 pb-4 pt-0 border-t border-border/50 space-y-2">
                {stop.location?.city && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {stop.location.city}, {stop.location.country}
                  </p>
                )}
                {stop.location?.id && (
                  <Link
                    to={`/LocationDetail?id=${stop.location.id}`}
                    className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
                  >
                    <Headphones className="w-3 h-3" /> Hear the story
                  </Link>
                )}
                <button
                  onClick={() => onReplace(stop)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium"
                >
                  <RefreshCw className="w-3 h-3" /> Swap this out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Inline replace candidates */}
        <AnimatePresence>
          {replacing?.location?.id === stop.location?.id && replaceCandidates?.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-border"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-3 space-y-2">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Alternatives</p>
                {replaceCandidates.map((alt, i) => (
                  <button
                    key={i}
                    onClick={() => onReplace(stop, alt)}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl bg-muted hover:bg-muted/70 transition-colors"
                  >
                    {alt.location?.image_url && (
                      <img src={alt.location.image_url} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div>
                      <p className="text-xs font-semibold">{alt.location?.name}</p>
                      <p className="text-[10px] text-muted-foreground">{alt.hook}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Main JourneyStops component ──────────────────────────────────────────────
export default function JourneyStops({ journey, onConfirm, onBack, originLat, originLng, destLat, destLng, mode }) {
  const isMultiDay = !!(journey?.multi_day_roadtrip && journey?.segments?.length > 0);

  const allJourneyStops = [
    ...(journey?.main_stops  || []),
    ...(journey?.quick_stops || []),
  ].sort((a, b) => (a._progress || 0) - (b._progress || 0));

  const [stops, setStops]         = useState(allJourneyStops);
  const [replacing, setReplacing] = useState(null);
  const [activeStopId, setActiveStopId] = useState(null);
  const [serviceLayer, setServiceLayer] = useState(null);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [sunsetAlignment, setSunsetAlignment] = useState(null);
  const [sunsetLoading, setSunsetLoading] = useState(false);

  // AI-proposed stops state: { proposal, status, resolvedLocation }
  const [proposedStops, setProposedStops] = useState([]);
  const [proposingLoading, setProposingLoading] = useState(false);
  const [hotelCities, setHotelCities] = useState([]);
  const [showProposed, setShowProposed] = useState(false);

  // Fetch service layer + sunset alignment in parallel on mount
  useEffect(() => {
    const polyline    = journey.route_metadata?.polyline;
    const routeDistKm = journey.route_metadata?.distance_km;
    const routeDurMin = journey.route_metadata?.duration_minutes;

    // Service layer
    if (originLat && originLng && polyline?.length) {
      setServiceLoading(true);
      base44.functions.invoke("detectServiceLayer", {
        startLat: originLat, startLng: originLng,
        destLat: destLat || null, destLng: destLng || null,
        routePoints: polyline, routeDistKm: routeDistKm || 0, routeDurMin: routeDurMin || 0,
        mode: journey.route_metadata?.mode || 'drive',
        intentTags: journey.themes_extracted || [],
        timeOfDay: null,
        monotonyScore: journey.route_character?.monotony_score || 30,
        db_service_support: journey.db_service_support || null,
      }).then(res => { if (res?.data && !res.data.error) setServiceLayer(res.data); })
        .catch(() => {}).finally(() => setServiceLoading(false));
    }

    // Sunset alignment — only when destination is known
    if (destLat && destLng) {
      setSunsetLoading(true);
      const allStops = [
        ...(journey.main_stops  || []),
        ...(journey.quick_stops || []),
      ];
      base44.functions.invoke("computeSunsetAlignment", {
        destLat, destLng,
        originLat: originLat || null,
        originLng: originLng || null,
        routeDurMin: routeDurMin || 60,
        routeDistKm: routeDistKm || 0,
        description: journey.debug?.layers?.intent?.description || '',
        themes:      journey.themes_extracted || [],
        intentTags:  journey.themes_extracted || [],
        allStops,
        utcOffsetHours: 3, // Qatar UTC+3; TODO: derive from user timezone
      }).then(res => { if (res?.data && !res.data.error) setSunsetAlignment(res.data); })
        .catch(() => {}).finally(() => setSunsetLoading(false));
    }
  }, []);

  // ── AI-proposed stops: fetch proposals when DB stops are few ───────────────
  const fetchProposedStops = async () => {
    if (proposingLoading) return;
    setProposingLoading(true);
    setShowProposed(true);

    const existingNames = stops.map(s => s.location?.name).filter(Boolean);

    try {
      const propRes = await base44.functions.invoke('proposeJourneyStops', {
        startLat: originLat, startLng: originLng,
        destLat: destLat || null, destLng: destLng || null,
        startName: null, destName: null,
        mode: mode || 'drive',
        routeDistKm: journey.route_metadata?.distance_km || 0,
        routeDurMin: journey.route_metadata?.duration_minutes || 0,
        intentTags: journey.themes_extracted || [],
        existingStopNames: existingNames,
        maxPropose: 3,
      });

      const proposals = propRes?.data?.proposed_stops || [];
      if (!proposals.length) { setProposingLoading(false); return; }

      // Collect hotel cities from proposals
      const hCities = [...new Set(proposals.map(p => p.hotel_candidate_city).filter(Boolean))];
      setHotelCities(hCities);

      // Initialize proposed stops in "planned" state
      const initialProposed = proposals.map(p => ({ proposal: p, status: 'planned', resolvedLocation: null }));
      setProposedStops(initialProposed);
      setProposingLoading(false);

      // Resolve each stop in parallel
      proposals.forEach(async (proposal, i) => {
        // Set to resolving
        setProposedStops(prev => prev.map((ps, idx) => idx === i ? { ...ps, status: 'resolving' } : ps));

        try {
          const res = await base44.functions.invoke('resolveProposedStop', {
            proposed_name: proposal.proposed_name,
            city: proposal.city,
            country: proposal.country,
            approx_lat: proposal.approx_lat || null,
            approx_lng: proposal.approx_lng || null,
            stop_role: proposal.stop_role,
            why_fit: proposal.why_fit,
            stop_type: proposal.stop_type,
            enrich: res?.data?.status !== 'existing', // only enrich if new
          });

          const result = res?.data;
          if (!result || result.error || !result.location) {
            setProposedStops(prev => prev.map((ps, idx) => idx === i ? { ...ps, status: 'failed' } : ps));
            return;
          }

          // Mark enriching if newly created and not yet enriched
          const nextStatus = result.status === 'existing' ? 'ready' : (result.enriched ? 'ready' : 'enriching');
          setProposedStops(prev => prev.map((ps, idx) => idx === i
            ? { ...ps, status: nextStatus, resolvedLocation: result.location, source: result.status }
            : ps
          ));

          // After a brief delay, mark as ready if enriching
          if (nextStatus === 'enriching') {
            setTimeout(() => {
              setProposedStops(prev => prev.map((ps, idx) => idx === i ? { ...ps, status: 'ready' } : ps));
            }, 2000);
          }
        } catch {
          setProposedStops(prev => prev.map((ps, idx) => idx === i ? { ...ps, status: 'failed' } : ps));
        }
      });
    } catch {
      setProposingLoading(false);
    }
  };

  // Accept a proposed stop — add it to the main journey stops list
  const acceptProposedStop = (proposed) => {
    if (!proposed.resolvedLocation) return;
    const newStop = {
      location: proposed.resolvedLocation,
      stop_role: proposed.proposal.stop_role || 'quick_stop',
      hook: proposed.resolvedLocation.quick_story || proposed.proposal.why_fit || proposed.resolvedLocation.name,
      dwell_minutes: 20,
      route_label: 'On route',
      _progress: proposed.proposal.approx_lat && originLat && destLat
        ? Math.min(0.9, Math.max(0.1, 0.5)) // rough midpoint — good enough
        : 0.5,
      _ai_proposed: true,
    };
    setStops(prev => [...prev, newStop].sort((a, b) => (a._progress || 0) - (b._progress || 0)));
    setProposedStops(prev => prev.filter(ps => ps !== proposed));
    trackJourneyEvent('proposed_stop_accepted', { stop_role: newStop.stop_role, category: newStop.location?.category });
  };

  const removeProposedStop = (proposal) => {
    setProposedStops(prev => prev.filter(ps => ps.proposal !== proposal));
  };

  const removeStop = (stop) => {
    const lid = stop.location?.id || stop.location?.location_id;
    setStops(prev => prev.filter(s => s !== stop));
    if (activeStopId === lid) setActiveStopId(null);
    setReplacing(null);
    // Track behavioral signal
    trackJourneyEvent('stop_removed', { stop_role: stop.stop_role, category: stop.location?.category });
  };

  const handleReplace = (stop, replacement) => {
    if (replacement) {
      setStops(prev => prev.map(s => s === stop ? replacement : s));
      setReplacing(null);
    } else {
      setReplacing(prev => prev?.location?.id === stop.location?.id ? null : stop);
    }
  };

  // Clicking a card focuses the map on that stop
  const handleCardSelect = (lid) => {
    setActiveStopId(prev => prev === lid ? null : lid);
  };

  // Clicking a marker highlights the matching card
  const handleMarkerClick = (lid) => {
    setActiveStopId(prev => prev === lid ? null : lid);
  };

  // Multi-day journeys get their own dedicated view — after ALL hooks
  if (isMultiDay) {
    return <MultiDayJourneyView journey={journey} onConfirm={onConfirm} onBack={onBack} />;
  }

  const showMap = stops.length > 0 || journey.result_status === "arrival_only";

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

      {/* Journey header */}
      <div className="pt-1 pb-2">
        <h2 className="text-xl font-bold tracking-tight leading-snug">{journey.journey_title}</h2>
        {journey.summary && (
          <p className="text-sm text-muted-foreground leading-relaxed mt-2">
            {journey.summary}
          </p>
        )}
      </div>

      {/* Service & Comfort strip */}
      <JourneyServiceStrip
        serviceLayer={serviceLayer}
        loading={serviceLoading}
        onAddStop={(newStop) => {
          const insertIdx = stops.findIndex(s => (s._progress || 0) > (newStop._progress || 0.5));
          if (insertIdx === -1) setStops(prev => [...prev, newStop]);
          else setStops(prev => [...prev.slice(0, insertIdx), newStop, ...prev.slice(insertIdx)]);
        }}
      />

      {/* Sunset alignment */}
      <SunsetAlignmentBadge sunsetAlignment={sunsetAlignment} loading={sunsetLoading && !!destLat} />

      {/* Missed Opportunity Engine */}
      <MissedOpportunityEngine
        routePoints={journey.route_metadata?.polyline || []}
        existingStops={stops}
        mode={mode || journey.route_metadata?.mode || 'drive'}
        routeDistKm={journey.route_metadata?.distance_km || 0}
        intentTags={journey.themes_extracted || []}
        phase="suggested"
        onAddStop={(suggestion) => {
          // Inject as a quick stop at the right progress position
          const newStop = {
            location: suggestion.location,
            stop_role: 'quick_stop',
            hook: suggestion.message,
            dwell_minutes: 15,
            route_label: `+${suggestion.detour_minutes} min detour`,
            _progress: suggestion.progress_score,
          };
          const insertIdx = stops.findIndex(s => (s._progress || 0) > suggestion.progress_score);
          if (insertIdx === -1) setStops(prev => [...prev, newStop]);
          else setStops(prev => [...prev.slice(0, insertIdx), newStop, ...prev.slice(insertIdx)]);
        }}
      />

      {/* Interactive map */}
      {showMap && (
        <JourneyMap
          stops={stops}
          arrivalSuggestions={journey.arrival_suggestions || []}
          departureSuggestions={journey.departure_suggestions || []}
          polyline={journey.route_metadata?.polyline || null}
          originLat={originLat}
          originLng={originLng}
          destLat={destLat}
          destLng={destLng}
          resultStatus={journey.result_status}
          activeStopId={activeStopId}
          onMarkerClick={handleMarkerClick}
          height="280px"
        />
      )}

      {/* Stop count + AI proposal trigger */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground/70">
          {stops.length === 1 ? "One stop." : stops.length === 0 ? "" : `${stops.length} stops.`}
        </p>
        {!showProposed && (
          <button
            onClick={fetchProposedStops}
            disabled={proposingLoading}
            className="flex items-center gap-1.5 text-xs text-primary/70 hover:text-primary font-medium transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {proposingLoading ? "Thinking…" : "Suggest more"}
          </button>
        )}
      </div>

      {/* AI-proposed stops */}
      {showProposed && (proposedStops.length > 0 || proposingLoading) && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-primary" /> AI suggestions
          </p>
          {proposingLoading && proposedStops.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-3 px-4 rounded-xl bg-muted/40">
              <span className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin inline-block" />
              Exploring what's along the way…
            </div>
          )}
          <AnimatePresence>
            {proposedStops.filter(ps => ps.status !== 'failed').map((ps, i) => (
              <div key={i} className="relative">
                <GeneratedStopCard
                  proposal={ps.proposal}
                  status={ps.status}
                  resolvedLocation={ps.resolvedLocation}
                  index={i}
                  onRemove={removeProposedStop}
                />
                {ps.status === 'ready' && ps.resolvedLocation && (
                  <button
                    onClick={() => acceptProposedStop(ps)}
                    className="mt-1 w-full text-center text-xs text-primary font-semibold hover:underline py-1"
                  >
                    + Add to journey
                  </button>
                )}
              </div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Hotel suggestions */}
      {hotelCities.length > 0 && (
        <HotelSuggestions
          hotelCandidateCities={hotelCities}
          routeCountry={journey.arrival_suggestions?.[0]?.location?.country || null}
        />
      )}

      {/* Arrival-only banner */}
      {journey.result_status === "arrival_only" && (
        <div className="py-3">
          <p className="text-sm font-semibold text-foreground/80">This one is about the drive.</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Nothing worth stopping for along the way. What matters is where you end up.
          </p>
        </div>
      )}

      {/* Arrival suggestions (arrival_only mode) */}
      {journey.result_status === "arrival_only" && (journey.arrival_suggestions || []).length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">When you get there</p>
          {journey.arrival_suggestions.map((s, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl">
              <div className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0 ml-1" />
              <div>
                <p className="text-xs font-semibold">{s.location?.name || s.hook}</p>
                {s.location?.city && <p className="text-[11px] text-muted-foreground">{s.location.city}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stop list */}
      {stops.length === 0 && journey.result_status !== "arrival_only" ? (
        <div className="py-8 text-muted-foreground text-sm">
          Nothing worth stopping for here.
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {stops.map((stop, i) => {
              const lid = stop.location?.id || stop.location?.location_id || String(i);
              return (
                <StopCard
                  key={lid}
                  stop={stop}
                  index={i}
                  onRemove={removeStop}
                  onReplace={handleReplace}
                  replacing={replacing}
                  replaceCandidates={[]}
                  isActive={activeStopId === lid}
                  onSelect={handleCardSelect}
                />
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="rounded-xl" onClick={onBack}>
          ← Back
        </Button>
        <Button
          className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 font-semibold"
          onClick={() => onConfirm(stops, serviceLayer, sunsetAlignment)}
          disabled={stops.length === 0 && journey.result_status !== "arrival_only"}
        >
          Lock this in <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </motion.div>
  );
}