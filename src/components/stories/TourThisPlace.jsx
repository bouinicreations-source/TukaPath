import React, { useState, useRef } from "react";
import { base44 } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronUp, MapPin, Headphones } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function TourPointCard({ point }) {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = React.useRef(null);

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center">
          {point.point_order}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{point.point_title}</p>
          {point.point_label && (
            <p className="text-[11px] text-muted-foreground">{point.point_label}</p>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
              {point.direction_hint && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-primary" />
                  <span>{point.direction_hint}</span>
                </div>
              )}

              {point.image_url && (
                <img
                  src={point.image_url}
                  alt={point.point_title}
                  className="w-full rounded-lg object-cover max-h-48"
                />
              )}

              {point.short_description && (
                <p className="text-sm text-muted-foreground leading-relaxed">{point.short_description}</p>
              )}

              {point.story_text && (
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
                  <p className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-1.5">Story</p>
                  <p className="text-sm leading-relaxed">{point.story_text}</p>
                </div>
              )}

              {point.audio_url && (
                <div className="flex items-center gap-3 bg-muted/30 rounded-lg px-3 py-2.5">
                  <button
                    onClick={toggleAudio}
                    className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0"
                  >
                    <Headphones className="w-4 h-4 text-white" />
                  </button>
                  <div className="flex-1">
                    <p className="text-xs font-medium">{playing ? "Playing…" : "Tap to listen"}</p>
                    <audio
                      ref={audioRef}
                      src={point.audio_url}
                      onEnded={() => setPlaying(false)}
                      className="hidden"
                    />
                  </div>
                  {playing && (
                    <button onClick={toggleAudio} className="text-[11px] text-muted-foreground underline">
                      Stop
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function TourThisPlace({ locationId }) {
  const { data: points = [] } = useQuery({
    queryKey: ["tour-points", locationId],
    queryFn: () => base44.entities.TourPoint.filter({ location_id: locationId }),
    enabled: !!locationId,
  });

  const activePoints = points
    .filter(p => p.is_active !== false)
    .sort((a, b) => (a.point_order ?? 0) - (b.point_order ?? 0));

  if (!activePoints.length) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
        🗺️ Tour This Place
        <span className="text-[10px] font-normal text-muted-foreground ml-1">{activePoints.length} stops</span>
      </h3>
      <div className="space-y-2">
        {activePoints.map(point => (
          <TourPointCard key={point.id} point={point} />
        ))}
      </div>
    </div>
  );
}