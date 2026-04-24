import { motion } from "framer-motion";
import { MapPin, Search, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * PlaceConfirmationCard — shown when voice/GPT parse returns ambiguous location.
 *
 * Props:
 *   rawQuery      — original text the user said/typed, e.g. "Malaga"
 *   role          — "origin" | "destination"
 *   candidates    — array of { name, lat, lng, country, confidence, source }
 *   onConfirm(candidate) — called when user picks one
 *   onSearchAgain()      — called when user wants to type manually
 */
export default function PlaceConfirmationCard({ rawQuery, role, candidates, onConfirm, onSearchAgain, absurd, distKm }) {
  const label = role === "origin" ? "starting point" : "destination";

  const title = absurd
    ? `That route looks very long (~${distKm} km)`
    : `Multiple places match "${rawQuery}"`;

  const subtitle = absurd
    ? `Is "${rawQuery}" really your ${label}? Confirm or search again.`
    : `Which ${label} did you mean?`;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 shadow-sm"
    >
      <div className="flex items-start gap-2.5 mb-3">
        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 leading-tight">
            {title}
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {candidates.map((c, i) => (
          <button
            key={i}
            onClick={() => onConfirm(c)}
            className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl bg-white dark:bg-card border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
          >
            <MapPin className="w-3.5 h-3.5 text-primary/50 mt-0.5 flex-shrink-0 group-hover:text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground leading-tight truncate">{c.name}</p>
              {c.place_type_label && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{c.place_type_label}</p>
              )}
            </div>
            {c.place_type_label && (
              <span className={`text-[10px] font-medium flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded-full ${
                c.place_tier <= 2
                  ? "bg-primary/10 text-primary"
                  : c.place_tier <= 4
                  ? "bg-muted text-muted-foreground"
                  : "bg-amber-100 text-amber-700"
              }`}>
                {c.place_type_label}
              </span>
            )}
          </button>
        ))}
      </div>

      <button
        onClick={onSearchAgain}
        className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5"
      >
        <Search className="w-3 h-3" />
        Search again manually
      </button>
    </motion.div>
  );
}