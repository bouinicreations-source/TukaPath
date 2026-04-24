import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin, Star, GitCompare, Brain, AlertCircle } from "lucide-react";

const CATEGORY_COLORS = {
  landmark:      "bg-emerald-50 text-emerald-700",
  museum:        "bg-blue-50 text-blue-700",
  park:          "bg-green-50 text-green-700",
  restaurant:    "bg-orange-50 text-orange-700",
  cafe:          "bg-amber-50 text-amber-700",
  hotel:         "bg-violet-50 text-violet-700",
  beach:         "bg-sky-50 text-sky-700",
  public_art:    "bg-pink-50 text-pink-700",
  religious:     "bg-stone-50 text-stone-700",
  nature:        "bg-lime-50 text-lime-700",
  petrol_station:"bg-slate-50 text-slate-600",
  other:         "bg-muted text-muted-foreground",
};

const WORTHINESS_CONFIG = {
  hero:            { label: "Hero",           cls: "bg-emerald-100 text-emerald-800" },
  worth_stop:      { label: "Worth Stop",     cls: "bg-green-50 text-green-700" },
  conditional:     { label: "Conditional",    cls: "bg-blue-50 text-blue-700" },
  background_only: { label: "Background",     cls: "bg-slate-100 text-slate-500" },
  ignore:          { label: "Ignore",         cls: "bg-red-50 text-red-400" },
};

const TIER_CONFIG = {
  tier_1: { label: "Tier 1", cls: "bg-violet-100 text-violet-800" },
  tier_2: { label: "Tier 2", cls: "bg-purple-50 text-purple-700" },
  tier_3: { label: "Tier 3", cls: "bg-slate-100 text-slate-600" },
  tier_0: { label: "Tier 0", cls: "bg-slate-50 text-slate-400" },
};

const LAYER_CONFIG = {
  journey:     { label: "Journey",     cls: "bg-teal-50 text-teal-700" },
  service:     { label: "Service",     cls: "bg-orange-50 text-orange-700" },
  hospitality: { label: "Hospitality", cls: "bg-violet-50 text-violet-700" },
  utility:     { label: "Utility",     cls: "bg-slate-100 text-slate-500" },
  transit:     { label: "Transit",     cls: "bg-blue-50 text-blue-700" },
};

const AI_WORTHINESS_CONFIG = {
  hero:            { cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  worth_stop:      { cls: "bg-green-50 text-green-700 border-green-200" },
  conditional:     { cls: "bg-blue-50 text-blue-700 border-blue-200" },
  background_only: { cls: "bg-slate-100 text-slate-500 border-slate-200" },
  ignore:          { cls: "bg-red-50 text-red-500 border-red-200" },
};

export default function CandidateRow({ candidate, selected, onToggle, isProbableDuplicate = false, aiReview = null }) {
  const colorClass  = CATEGORY_COLORS[candidate.category_guess] || CATEGORY_COLORS.other;
  const worthiness  = WORTHINESS_CONFIG[candidate.visit_worthiness] || null;
  const tier        = TIER_CONFIG[candidate.enrichment_tier] || null;
  const layer       = LAYER_CONFIG[candidate.record_layer] || null;
  const mapsUrl     = `https://www.google.com/maps/search/?api=1&query=${candidate.latitude},${candidate.longitude}&query_place_id=${candidate.place_id}`;

  return (
    <div className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors ${selected ? "bg-primary/5" : ""}`}>
      <div className="pt-0.5 flex-shrink-0">
        <Checkbox checked={selected} onCheckedChange={onToggle} className="rounded" />
      </div>

      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors mt-0.5"
        title="View on Google Maps"
      >
        <MapPin className="w-3.5 h-3.5 text-primary" />
      </a>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold truncate">{candidate.name}</span>
          {isProbableDuplicate && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
              <GitCompare className="w-2.5 h-2.5" /> Similar to "{candidate.existing_location_name}"
            </span>
          )}
        </div>

        {/* Row 1: category + city */}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
            {candidate.category_guess}
          </span>
          {candidate.place_type_code && (
            <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {candidate.place_type_code}
            </span>
          )}
          <span className="text-[11px] text-muted-foreground">{candidate.city}, {candidate.country}</span>
        </div>

        {/* Row 2: classification badges */}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {layer && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${layer.cls}`}>
              {layer.label}
            </span>
          )}
          {worthiness && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${worthiness.cls}`}>
              {worthiness.label}
            </span>
          )}
          {tier && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${tier.cls}`}>
              {tier.label}
            </span>
          )}
        </div>

        {/* AI review result — shown only when GPT has classified this candidate */}
        {aiReview && aiReview.ai_reviewed && (
          <div className={`flex items-start gap-1.5 mt-1.5 px-2 py-1 rounded-lg border text-[10px] ${AI_WORTHINESS_CONFIG[aiReview.visit_worthiness]?.cls || "bg-violet-50 text-violet-700 border-violet-200"}`}>
            <Brain className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">AI: {aiReview.visit_worthiness}</span>
              {aiReview.ai_confidence != null && (
                <span className="ml-1 opacity-70">{aiReview.ai_confidence}%</span>
              )}
              {aiReview.ai_reason && (
                <span className="ml-1 opacity-80">— {aiReview.ai_reason}</span>
              )}
              {aiReview.needs_manual_review && (
                <span className="ml-1 font-semibold text-amber-700">· manual review</span>
              )}
            </div>
          </div>
        )}
        {/* Gray-zone flag — shown before AI runs */}
        {!aiReview && candidate.needs_ai_review && (
          <div className="flex items-center gap-1 mt-1.5">
            <AlertCircle className="w-3 h-3 text-violet-500" />
            <span className="text-[10px] text-violet-600 font-medium">Borderline — AI review available</span>
          </div>
        )}

        {candidate.formatted_address && (
          <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{candidate.formatted_address}</p>
        )}
      </div>

      <div className="flex-shrink-0 text-right">
        {candidate.rating ? (
          <div className="flex items-center gap-1 justify-end">
            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
            <span className="text-sm font-semibold">{candidate.rating.toFixed(1)}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/50">—</span>
        )}
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {candidate.review_count > 0 ? `${candidate.review_count.toLocaleString()} reviews` : "no reviews"}
        </p>
      </div>
    </div>
  );
}