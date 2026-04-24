import { motion } from "framer-motion";
import { SlidersHorizontal } from "lucide-react";

const REFINEMENT_CHIPS = [
  { key: "more_scenic",     label: "🌄 More scenic" },
  { key: "less_driving",    label: "⏱ Less driving" },
  { key: "add_hotels",      label: "🏨 Add hotels" },
  { key: "more_culture",    label: "🏛️ More culture" },
  { key: "more_nature",     label: "🌿 More nature" },
  { key: "fewer_stops",     label: "✂️ Fewer stops" },
  { key: "family_friendly", label: "👨‍👩‍👧 Family friendly" },
  { key: "avoid_tolls",     label: "🚫 Avoid tolls" },
  { key: "change_dates",    label: "📅 Change dates" },
];

export default function RefinementBar({ onRefine, loading }) {
  const handleChip = (chip) => {
    onRefine({ type: "chip", key: chip.key, label: chip.label });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
          Refine your journey
        </p>
        <button
          onClick={() => onRefine({ type: "custom_open" })}
          className="flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary font-medium transition-colors"
        >
          <SlidersHorizontal className="w-3 h-3" />
          Custom
        </button>
      </div>

      {/* Chips */}
      <div className="flex flex-wrap gap-1.5">
        {REFINEMENT_CHIPS.map(chip => (
          <motion.button
            key={chip.key}
            whileTap={{ scale: 0.93 }}
            onClick={() => handleChip(chip)}
            disabled={loading}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-muted/70 hover:bg-primary/10 hover:text-primary text-muted-foreground transition-all disabled:opacity-40"
          >
            {chip.label}
          </motion.button>
        ))}
      </div>
    </div>
  );
}