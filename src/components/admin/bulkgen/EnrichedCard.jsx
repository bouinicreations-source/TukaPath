import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, SkipForward, Pencil, ImageOff, Star, ChevronDown, ChevronUp } from "lucide-react";

const CATEGORY_COLORS = {
  landmark: "bg-emerald-50 text-emerald-700",
  museum: "bg-blue-50 text-blue-700",
  park: "bg-green-50 text-green-700",
  restaurant: "bg-orange-50 text-orange-700",
  cafe: "bg-amber-50 text-amber-700",
  hotel: "bg-violet-50 text-violet-700",
  beach: "bg-sky-50 text-sky-700",
  public_art: "bg-pink-50 text-pink-700",
  religious: "bg-stone-50 text-stone-700",
  nature: "bg-lime-50 text-lime-700",
  petrol_station: "bg-slate-50 text-slate-600",
  other: "bg-muted text-muted-foreground",
};

export default function EnrichedCard({ item, decision, onApprove, onSkip, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const p = item.payload;
  const colorClass = CATEGORY_COLORS[p.category] || CATEGORY_COLORS.other;

  const borderClass =
    decision === "approved" ? "border-emerald-400 bg-emerald-50/30" :
    decision === "skipped"  ? "border-border opacity-50" :
    item.duplicate_flag     ? "border-amber-300 bg-amber-50/20" :
    "border-border";

  return (
    <div className={`bg-card border rounded-2xl overflow-hidden transition-all ${borderClass}`}>
      {/* Image */}
      <div className="relative h-36 bg-muted overflow-hidden">
        {p.image_url ? (
          <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground/40">
            <ImageOff className="w-8 h-8" />
            <span className="text-xs">Picture currently unavailable</span>
          </div>
        )}

        {/* Overlay badges */}
        <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium backdrop-blur-sm bg-white/80 ${colorClass}`}>
            {p.category}
          </span>
          {item.duplicate_flag && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500 text-white flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5" /> Duplicate
            </span>
          )}
          {decision === "approved" && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500 text-white flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" /> Approved
            </span>
          )}
          {decision === "skipped" && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-400 text-white">
              Skipped
            </span>
          )}
        </div>

        {/* Rating */}
        {item.rating && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 text-white rounded-full px-2 py-0.5">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span className="text-xs font-semibold">{item.rating.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-2">
        <div>
          <h3 className="text-sm font-bold leading-tight">{p.name}</h3>
          <p className="text-xs text-muted-foreground">{p.city}, {p.country}</p>
        </div>

        {p.quick_story && (
          <p className="text-xs text-foreground/80 leading-relaxed">{p.quick_story}</p>
        )}

        {p.mystery_teaser && (
          <p className="text-[11px] italic text-primary/70">{p.mystery_teaser}</p>
        )}

        {/* Expandable details */}
        {(p.fun_fact || p.why_it_matters_today || p.deep_story) && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Less" : "More details"}
          </button>
        )}

        {expanded && (
          <div className="space-y-2 pt-1 border-t border-border/50">
            {p.fun_fact && (
              <div>
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Fun Fact</span>
                <p className="text-xs text-foreground/70 mt-0.5">{p.fun_fact}</p>
              </div>
            )}
            {p.why_it_matters_today && (
              <div>
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Why Visit</span>
                <p className="text-xs text-foreground/70 mt-0.5">{p.why_it_matters_today}</p>
              </div>
            )}
            {p.deep_story && (
              <div>
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Full Story</span>
                <p className="text-xs text-foreground/70 mt-0.5 leading-relaxed">{p.deep_story}</p>
              </div>
            )}
            {p.typical_visit_duration && (
              <p className="text-[10px] text-muted-foreground">⏱ {p.typical_visit_duration}</p>
            )}
            {p.opening_hours && (
              <p className="text-[10px] text-muted-foreground">🕐 {p.opening_hours}</p>
            )}
          </div>
        )}

        {/* Duplicate warning */}
        {item.duplicate_flag && (
          <div className="flex items-start gap-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-700">
            <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>Already exists in your locations. Approving will create a duplicate.</span>
          </div>
        )}
      </div>

      {/* Actions */}
      {decision === null && (
        <div className="px-4 pb-4 flex gap-2">
          <Button
            size="sm"
            className="flex-1 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={onApprove}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl text-xs"
            onClick={onEdit}
          >
            <Pencil className="w-3 h-3 mr-1" /> Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-xl text-xs text-muted-foreground"
            onClick={onSkip}
          >
            <SkipForward className="w-3 h-3 mr-1" /> Skip
          </Button>
        </div>
      )}

      {/* Re-decide actions */}
      {decision !== null && (
        <div className="px-4 pb-4">
          <button
            onClick={() => decision === "approved" ? onSkip() : onApprove()}
            className="text-[11px] text-muted-foreground hover:text-foreground underline"
          >
            {decision === "approved" ? "Undo approve" : "Undo skip"}
          </button>
        </div>
      )}
    </div>
  );
}