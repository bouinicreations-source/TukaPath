import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Plus, MapPin, Clock } from "lucide-react";
import { base44 } from "@/api/client";

export default function MissedOpportunityCard({ suggestion, onAdd, onSkip }) {
  const [dismissed, setDismissed] = useState(false);
  const { location, message, detour_minutes, distance_from_route_km, total_score } = suggestion;

  const handleSkip = () => {
    setDismissed(true);
    // Log skip
setTimeout(() => onSkip(location.id), 300);
  };

  const handleAdd = () => {
    setDismissed(true);
// Log to EventLog
    setTimeout(() => onAdd(suggestion), 200);
  };

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 340, damping: 28 }}
          className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-lg"
        >
          {/* Subtle accent strip */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/40 via-accent/40 to-transparent" />

          <div className="p-4">
            {/* Header row */}
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center mt-0.5">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>

              <div className="flex-1 min-w-0">
                {/* Message */}
                <p className="text-sm font-medium text-foreground leading-snug mb-0.5">
                  {message}
                </p>
                {/* Location name */}
                <p className="text-xs font-bold text-primary">{location.name}</p>
              </div>

              {/* Dismiss X */}
              <button
                onClick={handleSkip}
                className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Image + meta row */}
            <div className="flex gap-3 mt-3">
              {location.image_url && (
                <img
                  src={location.image_url}
                  alt={location.name}
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                {location.quick_story && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 mb-2">
                    {location.quick_story}
                  </p>
                )}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {detour_minutes} min detour
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    {distance_from_route_km} km off route
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleAdd}
                className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add to journey
              </button>
              <button
                onClick={handleSkip}
                className="flex-1 flex items-center justify-center h-9 rounded-xl bg-muted text-muted-foreground text-xs font-medium hover:bg-muted/70 transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}