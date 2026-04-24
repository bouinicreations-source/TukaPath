import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackJourneyEvent } from "@/lib/personalization";

// Profile display + reset control shown in the user's Profile page.

const PREF_LABEL = {
  stop_tolerance: { low: "Fewer stops", medium: "Balanced", high: "More stops" },
  detour_tolerance: { low: "Stay on route", medium: "Occasional detours", high: "Open to detours" },
  preferred_pacing: { fast: "Fast", balanced: "Balanced", exploratory: "Exploratory" },
  preferred_mode: { drive: "Drive", motorcycle: "Motorcycle", walk: "Walk" },
};

function ScoreBar({ value, label }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="text-[11px] font-semibold text-foreground">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="h-full rounded-full bg-primary/60"
        />
      </div>
    </div>
  );
}

export default function PersonalizationPanel({ profile, onReset }) {
  const [expanded, setExpanded] = useState(false);
  const [resetting, setResetting] = useState(false);

  if (!profile) return null;

  const journeyCount = profile.journey_count || 0;

  const handleReset = async () => {
    setResetting(true);
    await trackJourneyEvent('preferences_reset', {});
    setResetting(false);
    if (onReset) onReset();
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-primary/70" />
          <div className="text-left">
            <p className="text-sm font-semibold">Journey Preferences</p>
            <p className="text-xs text-muted-foreground">
              {journeyCount === 0
                ? "Build after your first journey"
                : `Learned from ${journeyCount} journey${journeyCount !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-5 border-t border-border/50 pt-4">

              {journeyCount < 3 && (
                <p className="text-xs text-muted-foreground/60 italic">
                  Complete a few more journeys to see your personalized profile.
                </p>
              )}

              {/* Ordinal preferences */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'preferred_mode', label: 'Mode' },
                  { key: 'preferred_pacing', label: 'Pacing' },
                  { key: 'stop_tolerance', label: 'Stop density' },
                  { key: 'detour_tolerance', label: 'Detours' },
                ].map(({ key, label }) => (
                  <div key={key} className="bg-muted/50 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                    <p className="text-xs font-semibold">{PREF_LABEL[key]?.[profile[key]] || profile[key] || '—'}</p>
                  </div>
                ))}
              </div>

              {/* Continuous preferences */}
              <div className="space-y-3">
                <ScoreBar value={profile.scenic_preference || 0.5} label="Scenic affinity" />
                <ScoreBar value={profile.culture_preference || 0.5} label="Cultural interest" />
                <ScoreBar value={profile.food_preference || 0.5} label="Food & coffee stops" />
                <ScoreBar value={1 - (profile.fatigue_sensitivity || 0.5)} label="Long journey comfort" />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Journeys", value: profile.journey_count || 0 },
                  { label: "Detours taken", value: profile.missed_opp_accepted_total || 0 },
                  { label: "Stops removed", value: profile.stops_removed_total || 0 },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-muted/50 rounded-xl py-2.5">
                    <p className="text-base font-bold">{value}</p>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              {/* Reset */}
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-xl text-xs text-muted-foreground"
                onClick={handleReset}
                disabled={resetting}
              >
                <RotateCcw className="w-3 h-3 mr-1.5" />
                {resetting ? "Resetting…" : "Reset preferences"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}