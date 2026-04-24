import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X, MapPin, Headphones, Route, Heart, Unlock } from "lucide-react";
import { base44 } from "@/api/client";

const VARIANTS = {
  audio: {
    title: "Want to hear the rest?",
    subtitle: "You've discovered the story… the best part is just ahead.",
    cta: "Unlock full story",
  },
  blocked: {
    title: "Unlock the full journey",
    subtitle: "You've discovered your first place… there's so much more waiting.",
    cta: "Continue exploring — it's free",
  },
  default: {
    title: "Unlock the full journey",
    subtitle: "You've discovered your first place… there's so much more waiting.",
    cta: "Continue exploring — it's free",
  },
};

const BENEFITS = [
  { icon: MapPin, text: "Unlimited locations" },
  { icon: Headphones, text: "Full audio stories" },
  { icon: Route, text: "Smart journey planning" },
  { icon: Heart, text: "Save your favorites" },
];

export default function GuestUpgradeOverlay({ open, onClose, variant = "default" }) {
  const v = VARIANTS[variant] || VARIANTS.default;

  const handleSignup = () => {
    window.location.href = "/login";
  };

  const handleLogin = () => {
    window.location.href = "/login";
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4"
          style={{ backdropFilter: "blur(12px)", background: "rgba(0,0,0,0.55)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="w-full max-w-sm bg-card/98 backdrop-blur-xl rounded-3xl shadow-2xl border border-border p-6 relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon */}
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 mx-auto">
              <Unlock className="w-7 h-7 text-primary" />
            </div>

            {/* Text */}
            <h2 className="text-xl font-bold text-center mb-1.5">{v.title}</h2>
            <p className="text-sm text-muted-foreground text-center mb-5 leading-relaxed">{v.subtitle}</p>

            {/* Benefits */}
            <div className="grid grid-cols-2 gap-2.5 mb-6">
              {BENEFITS.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 bg-muted/60 rounded-xl px-3 py-2">
                  <Icon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span className="text-xs font-medium">{text}</span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <Button
              className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 font-semibold text-base mb-2.5"
              onClick={handleSignup}
            >
              {v.cta}
            </Button>
            <button
              onClick={handleLogin}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              Already have an account? <span className="text-primary font-medium">Log in</span>
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}