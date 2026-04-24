import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Navigation, Headphones, ExternalLink, RotateCcw, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const STOP_TYPE_META = {
  story:    { emoji: "🎙️", label: "Story Stop",  color: "bg-primary/10 text-primary" },
  coffee:   { emoji: "☕",  label: "Coffee",      color: "bg-amber-100 text-amber-700" },
  food:     { emoji: "🍽️", label: "Food Stop",   color: "bg-orange-100 text-orange-700" },
  scenic:   { emoji: "🌄",  label: "Scenic",      color: "bg-sky-100 text-sky-700" },
  hidden:   { emoji: "🔍",  label: "Hidden Gem",  color: "bg-purple-100 text-purple-700" },
  cultural: { emoji: "🏛️", label: "Cultural",    color: "bg-green-100 text-green-700" },
};

const DEVIATION_META = {
  on_route:      { label: "On the way",   color: "text-green-600 bg-green-50 border-green-200" },
  small_detour:  { label: "Small detour", color: "text-amber-600 bg-amber-50 border-amber-200" },
  scenic_detour: { label: "Scenic detour", color: "text-sky-600 bg-sky-50 border-sky-200" },
};

export default function RouteResult({ result, onReset }) {
  if (!result) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

      {/* Journey summary header */}
      <Card className="p-5 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/10">
        <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Your Journey</p>
        <h2 className="text-xl font-bold mb-1">{result.route_name || "Your Route"}</h2>

        {result.route_personality && (
          <p className="text-sm text-foreground/80 italic mb-3">"{result.route_personality}"</p>
        )}

        {/* Stats row */}
        <div className="flex gap-4 flex-wrap mb-3">
          {result.estimated_total_time && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              {result.estimated_total_time >= 60
                ? `${Math.floor(result.estimated_total_time / 60)}h ${result.estimated_total_time % 60 > 0 ? result.estimated_total_time % 60 + "m" : ""}`
                : `${result.estimated_total_time} min`}
            </div>
          )}
          {result.estimated_distance_km && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Navigation className="w-3.5 h-3.5" />
              {result.estimated_distance_km} km
            </div>
          )}
          {result.stops?.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              📍 {result.stops.length} stop{result.stops.length !== 1 ? "s" : ""}
            </div>
          )}
          {result.extra_time_vs_fastest > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              +{result.extra_time_vs_fastest} min vs fastest
            </Badge>
          )}
        </div>

        {/* Themes */}
        {result.themes?.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-3">
            {result.themes.map((t, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{t}</span>
            ))}
          </div>
        )}

        {result.route_summary && (
          <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-3">
            {result.route_summary}
          </p>
        )}
      </Card>

      {/* Timeline flow */}
      {result.stops?.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-3">Journey timeline</p>

          {/* Start */}
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-white" />
            </div>
            <p className="text-xs font-semibold text-primary">{result.origin || "Start"}</p>
          </div>

          <div className="space-y-2 ml-3 border-l-2 border-border/60 pl-4">
            {result.stops.map((stop, i) => {
              const meta = STOP_TYPE_META[stop.stop_type] || STOP_TYPE_META.scenic;
              const dev = DEVIATION_META[stop.stop_deviation] || DEVIATION_META.on_route;

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <Card className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-sm mt-0.5">
                        {meta.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* Name row */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-semibold">{stop.stop_name}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${meta.color}`}>
                            {meta.label}
                          </span>
                          {stop.stop_deviation && dev && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${dev.color}`}>
                              {dev.label}
                            </span>
                          )}
                          {stop.stop_duration && (
                            <span className="text-[10px] text-muted-foreground">{stop.stop_duration} min</span>
                          )}
                        </div>

                        {/* Story */}
                        {stop.stop_story && (
                          <p className="text-xs text-muted-foreground leading-relaxed mb-1.5">{stop.stop_story}</p>
                        )}

                        {/* Why this stop */}
                        {stop.why_this_stop && (
                          <p className="text-[10px] text-muted-foreground italic mb-1.5">
                            💡 {stop.why_this_stop}
                          </p>
                        )}

                        {/* Link to location */}
                        {stop.location_id && (
                          <Link
                            to={`/LocationDetail?id=${stop.location_id}`}
                            className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                          >
                            <Headphones className="w-3 h-3" /> Hear the story
                          </Link>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* End */}
          <div className="flex items-center gap-2 mt-2 ml-3 border-l-2 border-border/60 pl-4 pb-2">
            <div className="-ml-[1.4rem] w-6 h-6 rounded-full bg-muted-foreground/20 flex items-center justify-center flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-muted-foreground" />
            </div>
            <p className="text-xs font-semibold text-muted-foreground">{result.destination || "End"}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {result.export_link && (
          <Button
            className="flex-1 bg-primary hover:bg-primary/90 rounded-xl"
            onClick={() => window.open(result.export_link, "_blank")}
          >
            <ExternalLink className="w-4 h-4 mr-2" /> Open in Maps
          </Button>
        )}
        <Button variant="outline" className="flex-1 rounded-xl" onClick={onReset}>
          <RotateCcw className="w-4 h-4 mr-2" /> New Journey
        </Button>
      </div>

      {result.route_reasoning && (
        <p className="text-[11px] text-muted-foreground text-center italic px-2">
          {result.route_reasoning}
        </p>
      )}
    </motion.div>
  );
}