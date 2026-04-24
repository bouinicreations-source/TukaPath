import React from "react";
import { motion } from "framer-motion";
import { Loader2, Sparkles, AlertCircle, MapPin, Clock } from "lucide-react";

// Status model: planned → resolving → enriching → ready → failed
const STATUS_CONFIG = {
  planned:   { icon: Clock,    color: "text-muted-foreground",  bg: "bg-muted/50",         label: "Planned"   },
  resolving: { icon: Loader2,  color: "text-primary",           bg: "bg-primary/5",        label: "Locating…" },
  enriching: { icon: Sparkles, color: "text-amber-600",         bg: "bg-amber-50",         label: "Building…" },
  ready:     { icon: Sparkles, color: "text-emerald-600",       bg: "bg-emerald-50",       label: "Ready"     },
  failed:    { icon: AlertCircle, color: "text-destructive",    bg: "bg-destructive/5",    label: "Not found" },
};

const ROLE_LABELS = {
  main_highlight:      "Worth the pause",
  secondary_highlight: "Worth a look",
  scenic_pass:         "Let it pass by",
  quick_stop:          "If you feel like it",
  hotel_suggestion:    "Sleep here",
  support_candidate:   "Good for a break",
};

export default function GeneratedStopCard({ proposal, status = "planned", resolvedLocation = null, index, onRemove }) {
  const sc = STATUS_CONFIG[status] || STATUS_CONFIG.planned;
  const StatusIcon = sc.icon;
  const isLoading = status === "resolving" || status === "enriching";
  const isFailed  = status === "failed";

  // Once resolved, use the resolved location's data if available
  const displayName = resolvedLocation?.name || proposal.proposed_name || "Loading…";
  const displayCity = resolvedLocation?.city || proposal.city || null;
  const displayCountry = resolvedLocation?.country || proposal.country || null;
  const imageUrl = resolvedLocation?.image_url || null;
  const hook = resolvedLocation?.quick_story || proposal.why_fit || null;
  const roleLabel = ROLE_LABELS[proposal.stop_role] || "Stop";

  if (isFailed) return null; // Gracefully remove failed stops from UI

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ delay: index * 0.04 }}
    >
      <div className={`border rounded-2xl overflow-hidden transition-all duration-200 ${sc.bg} border-border/60`}>
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Sequence indicator */}
            <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 bg-foreground/10 text-foreground/50">
              {index + 1}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {/* Name — skeleton if still loading */}
                {isLoading && !resolvedLocation ? (
                  <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                ) : (
                  <p className="text-sm font-semibold text-foreground/80">{displayName}</p>
                )}

                {/* Role badge */}
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-primary/10 text-primary/70">
                  {roleLabel}
                </span>

                {/* Status badge */}
                <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${sc.color}`}>
                  <StatusIcon className={`w-2.5 h-2.5 ${isLoading ? "animate-spin" : ""}`} />
                  {sc.label}
                </span>
              </div>

              {/* Hook / story */}
              {isLoading && !hook ? (
                <div className="space-y-1.5 mt-1">
                  <div className="h-3 w-full rounded bg-muted/70 animate-pulse" />
                  <div className="h-3 w-3/4 rounded bg-muted/70 animate-pulse" />
                </div>
              ) : hook ? (
                <p className="text-xs text-muted-foreground leading-relaxed">{hook}</p>
              ) : null}

              {/* Location info */}
              {displayCity && (
                <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1 mt-1.5">
                  <MapPin className="w-3 h-3" />
                  {displayCity}{displayCountry ? `, ${displayCountry}` : ""}
                </p>
              )}
            </div>

            {/* Image thumbnail (once resolved) */}
            {imageUrl && (
              <div className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden">
                <img src={imageUrl} alt={displayName} className="w-full h-full object-cover" />
              </div>
            )}

            {/* Remove button */}
            {onRemove && (
              <button
                onClick={() => onRemove(proposal)}
                className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors mt-0.5"
              >
                <span className="text-xs">✕</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}