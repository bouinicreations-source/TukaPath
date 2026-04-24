import React from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, X, Clock, Calendar } from "lucide-react";

const TYPE_META = {
  coffee_stop:    { emoji: "☕", label: "Coffee Stop",     color: "bg-amber-50 text-amber-700 border-amber-200" },
  quick_bite:     { emoji: "🥐", label: "Quick Bite",      color: "bg-orange-50 text-orange-700 border-orange-200" },
  meal:           { emoji: "🍽️", label: "Meal",            color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  fine_dining:    { emoji: "✨", label: "Fine Dining",      color: "bg-violet-50 text-violet-700 border-violet-200" },
  bar:            { emoji: "🍸", label: "Bar",              color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  pub:            { emoji: "🍺", label: "Pub",              color: "bg-amber-50 text-amber-800 border-amber-200" },
  brunch:         { emoji: "🥂", label: "Brunch",           color: "bg-pink-50 text-pink-700 border-pink-200" },
  liquid_brunch:  { emoji: "🍹", label: "Liquid Brunch",   color: "bg-rose-50 text-rose-700 border-rose-200" },
  dessert:        { emoji: "🍰", label: "Dessert",          color: "bg-pink-50 text-pink-600 border-pink-200" },
  shisha:         { emoji: "💨", label: "Shisha",           color: "bg-slate-50 text-slate-600 border-slate-200" },
  rooftop:        { emoji: "🌇", label: "Rooftop",          color: "bg-sky-50 text-sky-700 border-sky-200" },
  sunset_spot:    { emoji: "🌅", label: "Sunset Spot",      color: "bg-amber-50 text-amber-600 border-amber-200" },
};

export default function ExperienceCard({ experience, onAdd, onSkip, compact = false }) {
  const meta = TYPE_META[experience.experience_type] || { emoji: "📍", label: experience.experience_type, color: "bg-muted text-muted-foreground border-border" };

  const hasDays = experience.day_of_week?.length > 0;
  const hasTime = experience.time_window_start || experience.time_window_end;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm"
    >
      {/* Image */}
      {experience.image_url && !compact && (
        <div className="relative h-36 overflow-hidden">
          <img
            src={experience.image_url}
            alt={experience.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <span className={`absolute top-3 left-3 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${meta.color}`}>
            {meta.emoji} {meta.label}
          </span>
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          {(compact || !experience.image_url) && (
            <span className="text-2xl flex-shrink-0">{meta.emoji}</span>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-bold leading-snug">{experience.title}</h3>
              <span className="text-sm font-bold text-primary flex-shrink-0 whitespace-nowrap">
                {experience.price > 0 ? `${experience.price} ${experience.currency || "QAR"}` : "Free"}
              </span>
            </div>
            {compact && (
              <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border mt-1 ${meta.color}`}>
                {meta.label}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed">{experience.description}</p>

        {/* Time / Day info */}
        {(hasDays || hasTime) && (
          <div className="flex flex-wrap gap-2">
            {hasDays && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                <Calendar className="w-2.5 h-2.5" />
                {experience.day_of_week.join(", ")}
              </div>
            )}
            {hasTime && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                <Clock className="w-2.5 h-2.5" />
                {experience.time_window_start}{experience.time_window_end ? ` – ${experience.time_window_end}` : ""}
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {experience.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {experience.tags.map((tag, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground font-medium">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        {(onAdd || onSkip) && (
          <div className="flex gap-2 pt-1">
            {onAdd && (
              <Button size="sm" className="flex-1 rounded-xl text-xs h-9 gap-1.5" onClick={onAdd}>
                <Plus className="w-3.5 h-3.5" /> Add to journey
              </Button>
            )}
            {onSkip && (
              <Button size="sm" variant="ghost" className="rounded-xl text-xs h-9 text-muted-foreground" onClick={onSkip}>
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}