import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle2, Circle, ArrowRight, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STOP_TYPE_META = {
  story:    { emoji: "🎙️", label: "Story Stop" },
  coffee:   { emoji: "☕", label: "Coffee" },
  food:     { emoji: "🍽️", label: "Food" },
  scenic:   { emoji: "🌄", label: "Scenic" },
  hidden:   { emoji: "🔍", label: "Hidden Gem" },
  cultural: { emoji: "🏛️", label: "Cultural" },
};

const DEVIATION_STYLES = {
  on_route:      { label: "On the way",    color: "bg-green-50 text-green-700 border-green-200" },
  small_detour:  { label: "Small detour",  color: "bg-amber-50 text-amber-700 border-amber-200" },
  scenic_detour: { label: "Scenic detour", color: "bg-sky-50 text-sky-700 border-sky-200" },
};

export default function StopSuggestions({ stops, onBuild, onBack, loading }) {
  const [selected, setSelected] = useState(() => new Set(stops.map((_, i) => i)));

  const toggleStop = (i) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(prev =>
      prev.size === stops.length ? new Set() : new Set(stops.map((_, i) => i))
    );
  };

  const selectedStops = stops.filter((_, i) => selected.has(i));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-primary font-semibold uppercase tracking-wide mb-0.5">Step 2 of 2</p>
          <h2 className="text-lg font-bold">Choose your stops</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Select the places you want to visit</p>
        </div>
        <button
          onClick={toggleAll}
          className="text-xs text-primary font-medium hover:underline"
        >
          {selected.size === stops.length ? "Deselect all" : "Select all"}
        </button>
      </div>

      {/* Stops list */}
      <div className="space-y-2.5">
        <AnimatePresence>
          {stops.map((stop, i) => {
            const meta = STOP_TYPE_META[stop.stop_type] || STOP_TYPE_META.scenic;
            const dev = DEVIATION_STYLES[stop.stop_deviation] || DEVIATION_STYLES.on_route;
            const isSelected = selected.has(i);

            return (
              <motion.button
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => toggleStop(i)}
                className={`w-full text-left rounded-xl border p-4 transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:bg-muted/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <div className="mt-0.5 flex-shrink-0">
                    {isSelected
                      ? <CheckCircle2 className="w-5 h-5 text-primary" />
                      : <Circle className="w-5 h-5 text-muted-foreground/40" />
                    }
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold">{stop.stop_name}</span>
                      <span className="text-xs text-muted-foreground">{meta.emoji} {meta.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                      {stop.short_description}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${dev.color}`}>
                        {dev.label}
                      </span>
                      {stop.why_this_stop && (
                        <span className="text-[10px] text-muted-foreground italic">
                          💡 {stop.why_this_stop}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 sticky bottom-0 pb-2 bg-background/80 backdrop-blur-sm">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="rounded-xl"
          disabled={loading}
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Back
        </Button>
        <Button
          className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary/90 font-semibold"
          onClick={() => onBuild(selectedStops)}
          disabled={loading || selected.size === 0}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Building journey...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Build my journey
              {selected.size > 0 && <span className="opacity-75">({selected.size} stop{selected.size !== 1 ? "s" : ""})</span>}
            </span>
          )}
        </Button>
      </div>

      {selected.size === 0 && (
        <p className="text-center text-xs text-muted-foreground -mt-2">Select at least one stop to continue</p>
      )}
    </motion.div>
  );
}