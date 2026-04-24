import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";

// Subtle, dismissible hint card shown when personalization is active.
// Only rendered when hint is non-null (requires 3+ journeys).

export default function PersonalizationHint({ hint }) {
  const [dismissed, setDismissed] = useState(false);

  if (!hint || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-primary/5 border border-primary/10"
      >
        <Sparkles className="w-3.5 h-3.5 text-primary/60 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-primary/70 leading-relaxed flex-1 italic">{hint}</p>
        <button
          onClick={() => setDismissed(true)}
          className="text-primary/30 hover:text-primary/60 transition-colors flex-shrink-0"
        >
          <X className="w-3 h-3" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}