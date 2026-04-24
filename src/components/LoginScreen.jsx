import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Headphones, Route, Heart, Loader2 } from "lucide-react";
import { supabase } from "@/api/supabase";

const PERKS = [
  { icon: MapPin,      text: "Unlimited locations to explore" },
  { icon: Headphones,  text: "Full immersive audio stories" },
  { icon: Route,       text: "AI-powered journey planning" },
  { icon: Heart,       text: "Save & revisit your favorites" },
];

export default function LoginScreen({ onSkip }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/AIConcierge`,
        },
      });
      if (error) throw error;
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9998] flex flex-col items-center justify-center p-6 text-white"
      style={{ background: "linear-gradient(160deg, #0d2b2b 0%, #1a3d3d 40%, #0a1f1f 100%)" }}
    >
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col items-center mb-8"
      >
        <img
          src="/logo.jpg"
          alt="TukaPath"
          className="h-16 w-auto rounded-2xl shadow-lg mb-4"
          onError={e => { e.target.style.display = 'none'; }}
        />
        <h1 className="text-3xl font-bold tracking-tight mb-1">TukaPath</h1>
        <p className="text-white/60 text-sm">Discover the stories around you</p>
      </motion.div>

      {/* Perks */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="w-full max-w-xs space-y-2.5 mb-8"
      >
        {PERKS.map(({ icon: Icon, text }, i) => (
          <motion.div
            key={text}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.07 }}
            className="flex items-center gap-3 rounded-xl px-4 py-3 border border-white/10"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <Icon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="text-sm font-medium text-white/90">{text}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* Error */}
      {error && (
        <div className="w-full max-w-xs mb-4 px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200 text-sm text-center">
          {error}
        </div>
      )}

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="w-full max-w-xs space-y-3"
      >
        <Button
          onClick={handleGoogleAuth}
          disabled={loading}
          className="w-full rounded-2xl bg-white text-primary hover:bg-white/90 font-bold text-base h-12 flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {loading ? "Connecting..." : "Continue with Google"}
        </Button>

        <Button
          onClick={handleGoogleAuth}
          disabled={loading}
          variant="outline"
          className="w-full h-12 rounded-2xl font-semibold"
          style={{ borderColor: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", color: "white" }}
        >
          {loading ? "Connecting..." : "Log in with Google"}
        </Button>

        {onSkip && (
          <button
            onClick={onSkip}
            className="w-full text-center text-sm py-2 transition-colors"
            style={{ color: "rgba(255,255,255,0.45)" }}
            onMouseEnter={e => e.target.style.color = "rgba(255,255,255,0.7)"}
            onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.45)"}
          >
            Skip for now — explore as guest
          </button>
        )}
      </motion.div>
    </div>
  );
}