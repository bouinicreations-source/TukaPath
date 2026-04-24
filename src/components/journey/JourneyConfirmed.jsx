import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Clock, Headphones, RotateCcw, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/client";
import JourneyMap from "./JourneyMap";
import JourneyServiceStrip from "./JourneyServiceStrip";
import SunsetAlignmentBadge from "./SunsetAlignmentBadge";
import MissedOpportunityEngine from "./MissedOpportunityEngine";

// Role → timeline dot color
const ROLE_DOT = {
  main_highlight:      "bg-primary",
  sunset_anchor:       "bg-amber-500",
  secondary_highlight: "bg-emerald-500",
  scenic_pass:         "bg-sky-400",
  quick_stop:          "bg-slate-400",
  coffee_stop:         "bg-amber-300",
  meal_stop:           "bg-amber-300",
  rest_stop:           "bg-slate-300",
  fuel_stop:           "bg-slate-300",
  anchor:              "bg-primary",
  highlight:           "bg-amber-400",
  connector:           "bg-slate-300",
};

function openNavigation(stop) {
  const lat = stop.location?.latitude;
  const lng = stop.location?.longitude;
  if (!lat || !lng) return;
  const isApple = /iPhone|iPad|iPod|Mac/.test(navigator.userAgent);
  window.open(
    isApple
      ? `maps://maps.apple.com/?daddr=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    "_blank"
  );
}

export default function JourneyConfirmed({ journey, stops: initialStops, onBegin, onReset, originLat, originLng, destLat, destLng, serviceLayer, sunsetAlignment, mode }) {
  const [activeStopId, setActiveStopId] = useState(null);
  const [stops, setStops] = useState(initialStops || []);

  const handleCardSelect = (lid) => setActiveStopId(prev => prev === lid ? null : lid);
  const handleMarkerClick = (lid) => setActiveStopId(prev => prev === lid ? null : lid);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

      {/* Confirmed banner */}
      <div className="pt-1 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-1">Ready to go</p>
        <h2 className="text-xl font-bold tracking-tight leading-snug">{journey.journey_title}</h2>
      </div>

      {/* Interactive map */}
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
        height="300px"
      />

      {/* Service & Comfort strip */}
      {serviceLayer && (
        <JourneyServiceStrip
          serviceLayer={serviceLayer}
          onAddStop={(newStop) => {
            const insertIdx = stops.findIndex(s => (s._progress || 0) > (newStop._progress || 0.5));
            setStops(prev => {
              if (insertIdx === -1) return [...prev, newStop];
              return [...prev.slice(0, insertIdx), newStop, ...prev.slice(insertIdx)];
            });
          }}
        />
      )}

      {/* Sunset alignment */}
      <SunsetAlignmentBadge sunsetAlignment={sunsetAlignment} />

      {/* Missed Opportunity Engine */}
      <MissedOpportunityEngine
        routePoints={journey.route_metadata?.polyline || []}
        existingStops={stops}
        mode={mode || journey.route_metadata?.mode || 'drive'}
        routeDistKm={journey.route_metadata?.distance_km || 0}
        intentTags={journey.themes_extracted || []}
        phase="locked"
        onAddStop={(suggestion) => {
          const newStop = {
            location: suggestion.location,
            stop_role: 'quick_stop',
            hook: suggestion.message,
            dwell_minutes: 15,
            route_label: `+${suggestion.detour_minutes} min detour`,
            _progress: suggestion.progress_score,
          };
          const insertIdx = stops.findIndex(s => (s._progress || 0) > suggestion.progress_score);
          setStops(prev => {
            if (insertIdx === -1) return [...prev, newStop];
            return [...prev.slice(0, insertIdx), newStop, ...prev.slice(insertIdx)];
          });
        }}
      />

      {/* Journey summary */}
      {journey.summary && (
        <p className="text-sm text-muted-foreground leading-relaxed">{journey.summary}</p>
      )}

      {/* Stop timeline */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Along the way</p>

        {/* Start node */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          </div>
          <p className="text-xs text-primary/70">You start here</p>
        </div>

        <div className="ml-2.5 border-l-2 border-border/50">
          {stops.map((stop, i) => {
            const roleKey = (stop.stop_role || "connector").toLowerCase().replace(/-/g, "_");
            const dotClass = ROLE_DOT[roleKey] || "bg-slate-300";
            const lid = stop.location?.id || stop.location?.location_id || String(i);
            const isActive = activeStopId === lid;

            return (
              <div key={lid} className="flex gap-3 pl-5 -ml-px relative pb-3">
                {/* Timeline dot */}
                <div className={`absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-background ${dotClass}`} />

                <div
                  className={`flex-1 bg-card border rounded-xl p-3 cursor-pointer transition-all duration-150
                    ${isActive ? "border-primary shadow ring-1 ring-primary/20" : "border-border hover:border-primary/30"}`}
                  onClick={() => handleCardSelect(lid)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span className="text-[11px] font-bold text-muted-foreground">{i + 1}.</span>
                        <p className="text-sm font-semibold">{stop.location?.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{stop.hook}</p>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {stop.dwell_minutes && (
                          <span className="text-[10px] text-muted-foreground/50">{stop.dwell_minutes} min</span>
                        )}
                        {stop.location?.id && (
                          <Link
                            to={`/LocationDetail?id=${stop.location.id}`}
                            onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary font-medium hover:underline"
                          >
                            <Headphones className="w-3 h-3" /> Listen
                          </Link>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); openNavigation(stop); }}
                      className="flex-shrink-0 p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
                      title="Navigate to this stop"
                    >
                      <Navigation className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* End node */}
        <div className="flex items-center gap-3 ml-2.5 pl-5 mt-1">
          <p className="text-xs text-muted-foreground/50">
            {journey.journey_type === "loop" ? "Back where you started" : "You arrive"}
          </p>
        </div>
      </div>

      {/* Primary action */}
      <Button
        className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 font-semibold"
        onClick={() => onBegin(stops[0])}
      >
        <Navigation className="w-4 h-4 mr-2" />
        Start driving
      </Button>

      {/* Secondary actions */}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 rounded-xl text-sm" onClick={() => openNavigation(stops[0])}>
          <MapPin className="w-3.5 h-3.5 mr-1.5" /> Open Maps
        </Button>
        <Button variant="outline" className="flex-1 rounded-xl text-sm" onClick={onReset}>
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Start over
        </Button>
      </div>
    </motion.div>
  );
}