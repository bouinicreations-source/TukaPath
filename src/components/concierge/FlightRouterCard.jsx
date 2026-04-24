/**
 * FlightRouterCard.jsx
 * Inline card shown when FLIGHT_INTENT is detected.
 * Offers 3 routing actions — no planning questions.
 */

import { motion } from "framer-motion";
import { Plane, MapPin, Layers } from "lucide-react";

const ACTIONS = [
  {
    key: "find_flights",
    icon: Plane,
    label: "Help me find a flight",
    sub: "Search routes and compare options",
    color: "text-sky-600",
    bg: "bg-sky-50 border-sky-200 hover:bg-sky-100",
  },
  {
    key: "plan_after",
    icon: MapPin,
    label: "Plan my trip after landing",
    sub: "Design a scenic drive or city itinerary on arrival",
    color: "text-primary",
    bg: "bg-primary/5 border-primary/20 hover:bg-primary/10",
  },
  {
    key: "both",
    icon: Layers,
    label: "Both — flight then trip",
    sub: "Sort the flight first, then plan the ground trip",
    color: "text-violet-600",
    bg: "bg-violet-50 border-violet-200 hover:bg-violet-100",
  },
];

export default function FlightRouterCard({ origin, destination, onSelect }) {
  const route = [origin, destination].filter(Boolean).join(" → ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="ml-9 bg-card border border-border rounded-2xl overflow-hidden"
    >
      {/* Header */}
      {route && (
        <div className="px-4 py-3 border-b border-border/50 bg-sky-50/60">
          <p className="text-[10px] font-bold text-sky-600/70 uppercase tracking-widest flex items-center gap-1.5">
            <Plane className="w-3 h-3" /> Flight detected
          </p>
          <p className="text-sm font-bold text-foreground mt-0.5 capitalize">{route}</p>
        </div>
      )}

      {/* Actions */}
      <div className="p-3 space-y-2">
        {ACTIONS.map(action => {
          const Icon = action.icon;
          return (
            <button
              key={action.key}
              onClick={() => onSelect(action.key)}
              className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl border transition-colors text-left ${action.bg}`}
            >
              <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                <Icon className={`w-3.5 h-3.5 ${action.color}`} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${action.color}`}>{action.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{action.sub}</p>
              </div>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}