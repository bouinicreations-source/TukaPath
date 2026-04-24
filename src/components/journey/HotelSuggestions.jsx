import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Hotel, ChevronDown, ChevronUp, ExternalLink, Loader2 } from "lucide-react";
import { base44 } from "@/api/client";

/**
 * HotelSuggestions
 * Shows hotel options for AI-proposed overnight city.
 * Fetches from DB first, falls back to a simple text suggestion.
 */
export default function HotelSuggestions({ hotelCandidateCities = [], routeCountry = null }) {
  const [expanded, setExpanded] = useState(false);
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hotelCandidateCities.length) return;
    setLoading(true);

    // Fetch hotels from DB for the candidate cities
    const fetchAll = async () => {
      const results = [];
      for (const city of hotelCandidateCities.slice(0, 2)) {
        try {
          const filter = { category: 'hotel', status: 'active', visible_to_users: true };
          if (city) filter.city = { $regex: city, $options: 'i' };
          if (routeCountry) filter.country = routeCountry;
          const found = await base44.entities.Location.filter(filter);
          for (const h of found.slice(0, 3)) {
            results.push({ location: h, overnight_city: city });
          }
        } catch {}
      }
      setHotels(results);
      setLoading(false);
    };
    fetchAll();
  }, [hotelCandidateCities.join(',')]);

  if (!hotelCandidateCities.length) return null;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-4 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Hotel className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Stay overnight in {hotelCandidateCities[0]}</p>
          <p className="text-[11px] text-muted-foreground">
            {loading ? "Finding options…" : hotels.length > 0 ? `${hotels.length} option${hotels.length > 1 ? 's' : ''} found` : "Hotel suggestions"}
          </p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-2">
              {loading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> Finding hotels…
                </div>
              )}
              {!loading && hotels.length === 0 && (
                <div className="space-y-2">
                  {hotelCandidateCities.map((city, i) => (
                    <a
                      key={i}
                      href={`https://www.google.com/search?q=hotels+in+${encodeURIComponent(city)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" /> Search hotels in {city}
                    </a>
                  ))}
                </div>
              )}
              {hotels.map((h, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted hover:bg-muted/70 transition-colors">
                  {h.location.image_url && (
                    <img src={h.location.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{h.location.name}</p>
                    <p className="text-[10px] text-muted-foreground">{h.overnight_city}</p>
                  </div>
                  {h.location.hotel_booking_link && (
                    <a
                      href={h.location.hotel_booking_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-[10px] text-primary font-medium hover:underline"
                      onClick={e => e.stopPropagation()}
                    >
                      Book
                    </a>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}