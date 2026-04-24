/**
 * ChatBubble — assistant / user bubbles + vertical chip stack
 */
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

export function AssistantBubble({ text, loading }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-end gap-2.5 max-w-[88%]"
    >
      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mb-0.5 shadow-sm">
        <span className="text-[10px] text-primary-foreground font-bold">T</span>
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-card border border-border/80 shadow text-sm text-foreground leading-relaxed">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="text-xs">thinking…</span>
          </div>
        ) : text}
      </div>
    </motion.div>
  );
}

export function UserBubble({ text }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18 }}
      className="flex justify-end"
    >
      <div className="px-4 py-3 rounded-2xl rounded-br-sm bg-primary text-primary-foreground text-sm leading-relaxed max-w-[80%] shadow-sm">
        {text}
      </div>
    </motion.div>
  );
}

// Vertical stack of chips — spec: vertical, not horizontal
export function ChipRow({ chips, onSelect, disabled }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: 0.12 }}
      className="flex flex-col gap-2 pl-9"
    >
      {chips.map((chip, i) => (
        <ChipButton key={i} chip={chip} onSelect={onSelect} disabled={disabled} />
      ))}
    </motion.div>
  );
}

function ChipButton({ chip, onSelect, disabled }) {
  return (
    <motion.button
      whileTap={{ scale: [1, 1.08, 0.96, 1], transition: { duration: 0.15 } }}
      onClick={() => !disabled && onSelect(chip)}
      disabled={disabled}
      className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium border-[1.5px] border-primary text-primary bg-white hover:bg-primary/5 active:bg-primary/10 transition-colors disabled:opacity-40 w-fit"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {chip.emoji && <span>{chip.emoji}</span>}
      {chip.label}
    </motion.button>
  );
}