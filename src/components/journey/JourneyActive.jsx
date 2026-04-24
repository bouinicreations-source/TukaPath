import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Navigation, ChevronRight, CheckCircle2, Clock, Headphones, MapPin, Flag } from "lucide-react";
import { Link } from "react-router-dom";

function openNavigation(stop) {
  const lat = stop.location?.latitude;
  const lng = stop.location?.longitude;
  if (!lat || !lng) return;
  const google = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const isApple = /iPhone|iPad|iPod|Mac/.test(navigator.userAgent);
  const apple = `maps://maps.apple.com/?daddr=${lat},${lng}`;
  window.open(isApple ? apple : google, "_blank");
}

export default function JourneyActive({ journey, stops, onComplete, onReset }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [completedIds, setCompletedIds] = useState(new Set());

  const currentStop = stops[currentIdx];
  const remainingStops = stops.slice(currentIdx + 1);
  const allDone = currentIdx >= stops.length;

  const markDone = () => {
    setCompletedIds(prev => new Set([...prev, currentStop?.location?.id]));
    setCurrentIdx(i => i + 1);
  };

  if (allDone) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-center py-8">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Flag className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Journey complete</h2>
          <p className="text-sm text-muted-foreground">{journey.journey_title}</p>
        </div>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" className="rounded-xl" onClick={onReset}>
            Plan another
          </Button>
          <Button className="rounded-xl bg-primary" onClick={onComplete}>
            Done
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

      {/* Journey header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Active Journey</p>
          <h2 className="text-lg font-bold">{journey.journey_title}</h2>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">{currentIdx + 1} / {stops.length}</p>
          <div className="flex gap-0.5 mt-1">
            {stops.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-5 rounded-full transition-colors ${
                  i < currentIdx ? "bg-primary" : i === currentIdx ? "bg-primary/60" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Current stop — hero card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIdx}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/15 rounded-2xl overflow-hidden"
        >
          {currentStop?.location?.image_url && (
            <img
              src={currentStop.location.image_url}
              alt={currentStop.location.name}
              className="w-full h-36 object-cover"
            />
          )}
          <div className="p-5">
            <div className="flex items-start gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                {currentIdx + 1}
              </div>
              <div>
                <p className="text-xs text-primary font-semibold uppercase tracking-wide">Now heading to</p>
                <h3 className="text-xl font-bold">{currentStop?.location?.name}</h3>
                {currentStop?.location?.city && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" /> {currentStop.location.city}
                  </p>
                )}
              </div>
            </div>

            <p className="text-sm text-foreground/80 leading-relaxed mb-4">{currentStop?.hook}</p>

            <div className="flex items-center gap-3 flex-wrap mb-4">
              {currentStop?.dwell_minutes && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" /> {currentStop.dwell_minutes} min dwell
                </span>
              )}
              {currentStop?.location?.id && (
                <Link
                  to={`/LocationDetail?id=${currentStop.location.id}`}
                  className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
                >
                  <Headphones className="w-3.5 h-3.5" /> Hear the story
                </Link>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1 rounded-xl bg-primary hover:bg-primary/90 font-semibold"
                onClick={() => openNavigation(currentStop)}
              >
                <Navigation className="w-4 h-4 mr-1.5" /> Navigate there
              </Button>
              <Button
                variant="outline"
                className="rounded-xl px-4"
                onClick={markDone}
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Done
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Upcoming stops — compact */}
      {remainingStops.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Up next
          </p>
          <div className="space-y-2">
            {remainingStops.map((stop, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl opacity-70">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {currentIdx + i + 2}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{stop.location?.name}</p>
                  <p className="text-[10px] text-muted-foreground">{stop.dwell_minutes} min dwell</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* End journey */}
      <button
        onClick={onReset}
        className="w-full text-center text-xs text-muted-foreground py-2 hover:text-foreground"
      >
        End journey early
      </button>
    </motion.div>
  );
}