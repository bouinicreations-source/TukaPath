import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";

const TYPE_LABEL = {
  fuel:   { emoji: '⛽', name: 'fuel' },
  coffee: { emoji: '☕', name: 'café' },
  meal:   { emoji: '🍽️', name: 'restaurant' },
  rest:   { emoji: '🛑', name: 'rest area' },
};

export default function JourneyServiceStrip({ serviceLayer, loading, onAddStop }) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(new Set());

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 px-1">
        <div className="h-2 w-2 rounded-full bg-muted animate-pulse" />
        <span className="text-[11px] text-muted-foreground animate-pulse">Checking route…</span>
      </div>
    );
  }

  if (!serviceLayer) return null;

  const { suggestions = [], support_layer, summary, fatigue, best_support_candidate } = serviceLayer;
  // support_layer is the new field; fall back to legacy summary
  const sl = support_layer || summary || {};

  // ── Header chips ────────────────────────────────────────────────────────────
  const chips = [];
  if (sl.fuel_found && sl.next_fuel_km != null)
    chips.push({ key: 'fuel',   label: `⛽ ~${sl.next_fuel_km} km`,   cls: "bg-card text-foreground border-border" });
  if (sl.coffee_found && sl.next_coffee_km != null)
    chips.push({ key: 'coffee', label: `☕ ~${sl.next_coffee_km} km`, cls: "bg-card text-foreground border-border" });
  if (sl.meal_found && sl.next_meal_km != null)
    chips.push({ key: 'meal',   label: `🍽️ ~${sl.next_meal_km} km`,  cls: "bg-card text-foreground border-border" });
  if (fatigue?.level === 'high')
    chips.push({ key: 'fatigue', label: '⚠️ Long drive', cls: "bg-amber-50 text-amber-700 border-amber-200" });
  else if (fatigue?.level === 'medium')
    chips.push({ key: 'fatigue', label: '🧭 Moderate drive', cls: "bg-slate-50 text-slate-600 border-slate-200" });

  const promptSuggestions = suggestions.filter(s => s.type === 'prompt' && !dismissed.has(s.service));
  const infoSuggestions   = suggestions.filter(s => s.type !== 'prompt');

  if (chips.length === 0 && promptSuggestions.length === 0 && infoSuggestions.length === 0) return null;

  // ── Add a stop+ handler ────────────────────────────────────────────────────
  const handleAddStop = (suggestion) => {
    if (!onAddStop || !best_support_candidate) return;
    const c = best_support_candidate;
    const typeKey = c.type || 'fuel';
    const meta = TYPE_LABEL[typeKey] || TYPE_LABEL.fuel;
    onAddStop({
      location: {
        name:      c.name,
        latitude:  c.lat,
        longitude: c.lng,
        city:      null,
        country:   null,
        id:        null,
        category:  typeKey === 'fuel' ? 'petrol_station' : typeKey === 'coffee' ? 'cafe' : typeKey === 'meal' ? 'restaurant' : 'other',
      },
      stop_role:     `${typeKey}_stop`,
      hook:          `${meta.emoji} ${meta.name.charAt(0).toUpperCase() + meta.name.slice(1)} around km ${c.dist_from_start_km}.${c.rating > 3.5 ? ` Rated ${c.rating}★` : ''}`,
      dwell_minutes: typeKey === 'meal' ? 30 : 15,
      route_label:   c.detour_km > 0 ? `+${c.detour_km} km detour` : 'On route',
      _progress:     c.progress || 0.5,
    });
    setDismissed(prev => new Set([...prev, suggestion.service]));
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">

      {/* Header strip */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex-shrink-0">
          Co-driver
        </span>
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
          {chips.map(chip => (
            <span key={chip.key} className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${chip.cls}`}>
              {chip.label}
            </span>
          ))}
          {chips.length === 0 && (
            <span className="text-[11px] text-muted-foreground/60">Route checked</span>
          )}
        </div>
        {infoSuggestions.length > 0 && (
          expanded
            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        )}
      </button>

      {/* Prompt cards — always visible, not behind expand */}
      <AnimatePresence>
        {promptSuggestions.map((s) => (
          <motion.div
            key={s.service}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border/40"
          >
            <div className="px-4 pt-3 flex items-start gap-3">
              <span className="text-base flex-shrink-0 mt-0.5">{s.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{s.message}</p>
                {best_support_candidate && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Best option: <span className="font-medium">{best_support_candidate.name}</span>
                    {best_support_candidate.dist_from_start_km != null && ` · km ${best_support_candidate.dist_from_start_km}`}
                    {best_support_candidate.detour_km > 0 && ` · +${best_support_candidate.detour_km} km`}
                  </p>
                )}
              </div>
              <button
                onClick={() => setDismissed(prev => new Set([...prev, s.service]))}
                className="text-muted-foreground/40 hover:text-muted-foreground flex-shrink-0 p-1 mt-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* CTA */}
            <div className="px-4 pb-3 pt-2.5 flex gap-2">
              {s.has_candidate !== false && onAddStop && best_support_candidate ? (
                <button
                  onClick={() => handleAddStop(s)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add a stop+
                </button>
              ) : null}
              <button
                onClick={() => setDismissed(prev => new Set([...prev, s.service]))}
                className="px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Keep it clean
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Expanded info suggestions */}
      <AnimatePresence>
        {expanded && infoSuggestions.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2 border-t border-border/40 pt-3">
              {infoSuggestions.map((s, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border text-[12px] leading-snug ${
                    s.type === 'warning'    ? 'bg-amber-50 border-amber-200 text-amber-800' :
                    s.type === 'ok'         ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                    s.type === 'suggestion' ? 'bg-primary/5 border-primary/20 text-foreground' :
                    'bg-blue-50 border-blue-200 text-blue-800'
                  }`}
                >
                  <span className="text-base flex-shrink-0 leading-tight">{s.emoji}</span>
                  <span>{s.message}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}