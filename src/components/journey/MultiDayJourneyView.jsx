import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  ChevronDown, ChevronUp, ArrowRight, Moon, MapPin,
  Star, Car, Clock, Hotel, Navigation
} from "lucide-react";
import { Link } from "react-router-dom";

// ── Price level display ───────────────────────────────────────────────────────
function PriceLevel({ level }) {
  if (!level) return null;
  const filled = "£".repeat(level);
  const empty  = "£".repeat(4 - level);
  return (
    <span className="text-[11px]">
      <span className="text-foreground font-medium">{filled}</span>
      <span className="text-foreground/20">{empty}</span>
    </span>
  );
}

// ── Hotel card with Booking.com link ─────────────────────────────────────────
function HotelCard({ hotel }) {
  // Prefer Booking.com deep search, fallback to Google
  const bookingUrl = hotel.booking_url ||
    `https://www.booking.com/search.html?ss=${encodeURIComponent(hotel.name)}`;
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(hotel.name + " hotel booking")}`;

  return (
    <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-primary/30 hover:shadow-sm transition-all group">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Hotel className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">{hotel.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {hotel.rating && (
            <span className="flex items-center gap-0.5 text-[10px] text-amber-600">
              <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
              {hotel.rating}
            </span>
          )}
          <PriceLevel level={hotel.price_level} />
        </div>
      </div>
      {/* Booking actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[#003580] text-white hover:bg-[#00224F] transition-colors"
        >
          Book
        </a>
        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 rounded-lg text-muted-foreground hover:text-primary transition-colors"
        >
          <Navigation className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

// ── Stop row inside a day leg ─────────────────────────────────────────────────
function LegStopRow({ stop, index }) {
  const roleColors = {
    main_highlight: "bg-primary/10 text-primary border-primary/20",
    secondary_highlight: "bg-emerald-100 text-emerald-700 border-emerald-200",
    scenic_pass: "bg-sky-100 text-sky-700 border-sky-200",
    quick_stop: "bg-slate-100 text-slate-600 border-slate-200",
  };
  const roleLabels = {
    main_highlight: "Must-see",
    secondary_highlight: "Worth a look",
    scenic_pass: "Scenic pass",
    quick_stop: "Quick stop",
  };
  const roleKey = (stop.stop_role || "quick_stop").toLowerCase();
  const colorClass = roleColors[roleKey] || roleColors.quick_stop;
  const label = roleLabels[roleKey] || "Stop";
  const lid = stop.location?.id;

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex flex-col items-center flex-shrink-0 mt-0.5">
        <div className="w-5 h-5 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-bold text-foreground/60">
          {index + 1}
        </div>
        <div className="w-px flex-1 bg-border mt-1 min-h-[10px]" />
      </div>
      <div className="flex-1 pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold">{stop.location?.name || stop._proposed_name || "Unknown"}</p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${colorClass}`}>
            {label}
          </span>
        </div>
        {stop.hook && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{stop.hook}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          {stop.location?.city && (
            <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5">
              <MapPin className="w-2.5 h-2.5" />{stop.location.city}
            </span>
          )}
          {stop.dwell_minutes && (
            <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />{stop.dwell_minutes} min
            </span>
          )}
          {lid && (
            <Link to={`/LocationDetail?id=${lid}`} className="text-[10px] text-primary hover:underline font-medium">
              Hear the story →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Single day leg card ───────────────────────────────────────────────────────
function DayLegCard({ segment, dayIndex, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const isLastLeg = !segment.overnight_city || segment.hotels === undefined;
  const hrs = Math.floor((segment.estimated_duration_min || 0) / 60);
  const mins = Math.round((segment.estimated_duration_min || 0) % 60);
  const durationLabel = hrs > 0 ? `${hrs}h${mins > 0 ? ` ${mins}m` : ""}` : `${mins}m`;
  const routeCharacterColors = {
    coastal: "text-sky-600 bg-sky-50 border-sky-200",
    countryside: "text-emerald-600 bg-emerald-50 border-emerald-200",
    mountain: "text-slate-600 bg-slate-100 border-slate-200",
    urban: "text-violet-600 bg-violet-50 border-violet-200",
    mixed: "text-amber-600 bg-amber-50 border-amber-200",
  };
  const charColor = routeCharacterColors[segment.route_character] || "text-slate-600 bg-slate-100 border-slate-200";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: dayIndex * 0.05 }}
      className="border border-border rounded-2xl overflow-hidden bg-card"
    >
      {/* Day header — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
      >
        {/* Day badge */}
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex flex-col items-center justify-center">
          <span className="text-[9px] font-bold text-primary/70 uppercase tracking-wide leading-none">Day</span>
          <span className="text-base font-black text-primary leading-none">{dayIndex + 1}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold">
              {segment.overnight_city
                ? `Overnight in ${segment.overnight_city}`
                : `Arrive at destination`}
            </p>
            {segment.route_character && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${charColor}`}>
                {segment.route_character}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Car className="w-3 h-3" />{Math.round(segment.distance_km || 0)} km
            </span>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />{durationLabel} drive
            </span>
            {segment.stops?.length > 0 && (
              <span className="text-[11px] text-muted-foreground">
                {segment.stops.length} stop{segment.stops.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 text-muted-foreground">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-border/50 space-y-4 pt-3">
              {/* Overnight city reason */}
              {segment.overnight_city_reason && (
                <p className="text-xs text-muted-foreground italic">
                  {segment.overnight_city_reason}
                </p>
              )}

              {/* Stops */}
              {segment.stops?.length > 0 ? (
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                    Stops along the way
                  </p>
                  <div>
                    {segment.stops.map((stop, i) => (
                      <LegStopRow key={i} stop={stop} index={i} />
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No stops on this leg — enjoy the drive.</p>
              )}

              {/* Overnight stay / hotels */}
              {segment.overnight_city && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Moon className="w-3.5 h-3.5 text-primary/70" />
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Sleep in {segment.overnight_city}
                    </p>
                  </div>
                  {segment.hotels?.length > 0 ? (
                    <div className="space-y-2">
                      {segment.hotels.map((hotel, i) => (
                        <HotelCard key={i} hotel={hotel} />
                      ))}
                    </div>
                  ) : (
                    <a
                      href={`https://www.google.com/search?q=hotels+in+${encodeURIComponent(segment.overnight_city)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <Hotel className="w-3.5 h-3.5" /> Search hotels in {segment.overnight_city}
                    </a>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main MultiDayJourneyView ──────────────────────────────────────────────────
export default function MultiDayJourneyView({ journey, onConfirm, onBack }) {
  const segments = journey.segments || [];
  const totalDays = segments.length;
  const totalStays = segments.filter(s => s.overnight_city).length;
  const totalStops = segments.reduce((sum, s) => sum + (s.stops?.length || 0), 0);

  const totalDistKm = Math.round(journey.route_metadata?.distance_km || 0);
  const totalDurHrs = Math.round((journey.route_metadata?.duration_minutes || 0) / 60 * 10) / 10;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

      {/* Trip header */}
      <div className="pt-1 pb-1">
        <h2 className="text-xl font-bold tracking-tight leading-snug">{journey.journey_title}</h2>
        {journey.summary && (
          <p className="text-sm text-muted-foreground leading-relaxed mt-1">{journey.summary}</p>
        )}
      </div>

      {/* Trip stats pill */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-2xl border border-primary/20 flex-wrap">
          <span className="text-sm font-bold text-primary">{totalDays} days</span>
          <span className="text-primary/40">·</span>
          <span className="text-sm font-bold text-primary">{totalStays} stays</span>
          <span className="text-primary/40">·</span>
          <span className="text-sm font-bold text-primary">{totalStops} stops</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-2xl text-xs text-muted-foreground flex-wrap">
          <Car className="w-3.5 h-3.5" />
          <span>{totalDistKm} km</span>
          <span>·</span>
          <span>{totalDurHrs}h total drive</span>
        </div>
      </div>

      {/* Day-by-day legs */}
      <div className="space-y-3">
        {segments.map((seg, i) => (
          <DayLegCard
            key={seg.leg_number || i}
            segment={seg}
            dayIndex={i}
            defaultOpen={i === 0}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="rounded-xl" onClick={onBack}>
          ← Back
        </Button>
        <Button
          className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 font-semibold"
          onClick={() => onConfirm([], null, null)}
        >
          Start this trip <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </motion.div>
  );
}