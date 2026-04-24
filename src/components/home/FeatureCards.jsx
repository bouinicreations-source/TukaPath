import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Compass, MapPin, Route, ChevronRight, Sparkles, Map } from "lucide-react";
import { useAuth } from "@/components/AuthContext";

const STORIES_ICON_URL = "/icons/stories.png";
const BUDGET_ICON_URL = "/icons/budget.png";

export default function FeatureCards({ settings = {} }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "owner" || user?.role === "editor";
  const adventureEnabled = settings.feature_adventure !== "false" || isAdmin;

  return (
    <section className="px-5 space-y-4 mt-2">

      {/* ── PRIMARY: AI Concierge ────────────────────────────────────────── */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35, duration: 0.5 }}
      >
        <Link to="/AIConcierge" className="block group">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-6 text-white shadow-xl">
            {/* Subtle animated glow */}
            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-primary/20 blur-2xl pointer-events-none" />
            <div className="absolute top-3 right-3 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white/80" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest bg-primary/30 px-2 py-0.5 rounded-full">New</span>
                <span className="text-xs font-semibold uppercase tracking-wider opacity-60">AI Concierge</span>
              </div>
              <h2 className="text-2xl font-bold mt-1">Plan my journey</h2>
              <p className="text-sm opacity-85 mt-1.5 leading-relaxed">
                Tell me what you want — I'll build it with you
              </p>
              <div className="flex items-center gap-1 mt-4 text-sm font-semibold opacity-90 group-hover:opacity-100 transition-opacity">
                Start planning <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </Link>
      </motion.div>

      {/* ── SECONDARY: Standard Journey Builder ──────────────────────────── */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.45, duration: 0.5 }}
      >
        <Link to="/RoutePlanner" className="block group">
          <div className="relative overflow-hidden rounded-2xl bg-muted/60 border border-border p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="absolute top-3 right-3 w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center">
              <Map className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Manual</span>
              </div>
              <h2 className="text-lg font-bold text-foreground">Explore places</h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Browse and build manually
              </p>
              <div className="flex items-center gap-1 mt-3 text-xs font-medium text-primary group-hover:text-primary/80 transition-colors">
                Open route planner <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </Link>
      </motion.div>

      {/* ── Explore Stories ───────────────────────────────────────────────── */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.5 }}
      >
        <Link to="/NearbyStories" className="block group">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground shadow-xl">
            <div className="absolute top-3 right-3 w-10 h-10 rounded-full bg-primary-foreground/10 flex items-center justify-center overflow-hidden">
              <img src={STORIES_ICON_URL} alt="" className="w-10 h-10 object-cover rounded-full" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4" />
                <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Audio Stories</span>
              </div>
              <h2 className="text-lg font-bold mt-0.5">Explore Stories</h2>
              <p className="text-sm opacity-90 mt-1 leading-relaxed">
                {settings.card1_subtitle || "Discover stories around you"}
              </p>
              <div className="flex items-center gap-1 mt-3 text-xs font-medium opacity-90 group-hover:opacity-100 transition-opacity">
                Start exploring <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </Link>
      </motion.div>

      {/* ── Adventure Finder ─────────────────────────────────────────────── */}
      {adventureEnabled && (
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.65, duration: 0.5 }}
        >
          <Link to="/AdventureFinder" className="block group">
            <div className="relative overflow-hidden rounded-2xl bg-muted/60 border border-border p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="absolute top-3 right-3 w-10 h-10 rounded-full overflow-hidden">
                <img src={BUDGET_ICON_URL} alt="" className="w-10 h-10 object-cover rounded-full" />
              </div>
              <div className="relative z-10">
                <h2 className="text-lg font-bold text-foreground">Find My Budget Trip</h2>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {settings.card2_subtitle || "Where can your budget take you?"}
                </p>
                <div className="flex items-center gap-1 mt-3 text-xs font-medium text-primary group-hover:text-primary/80 transition-colors">
                  Find destinations <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </Link>
        </motion.div>
      )}
    </section>
  );
}