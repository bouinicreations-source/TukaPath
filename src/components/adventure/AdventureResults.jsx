import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, ChevronDown, ChevronUp, Plane, Hotel, UtensilsCrossed, Bus, Ticket, FileText, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/client";
import { resolveVisa } from "@/components/visa/visaLogic";
import VisaResultBadge from "@/components/visa/VisaResultBadge";
import VisaResultDetail from "@/components/visa/VisaResultDetail";

const CITY_IMAGES = {
  "Paris": "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&q=80",
  "Amsterdam": "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=400&q=80",
  "Barcelona": "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=400&q=80",
  "Rome": "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&q=80",
  "Berlin": "https://images.unsplash.com/photo-1560969184-10fe8719e047?w=400&q=80",
  "London": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400&q=80",
  "Prague": "https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=400&q=80",
  "Vienna": "https://images.unsplash.com/photo-1516550893885-985c836c5169?w=400&q=80",
  "Budapest": "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&q=80",
  "Istanbul": "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=400&q=80",
  "Dubai": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400&q=80",
  "Bangkok": "https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=400&q=80",
  "Tokyo": "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&q=80",
  "Bali": "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&q=80",
  "Lisbon": "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=400&q=80",
  "Madrid": "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=400&q=80",
  "Athens": "https://images.unsplash.com/photo-1555993539-1732b0258235?w=400&q=80",
  "Cairo": "https://images.unsplash.com/photo-1572252009286-268acec5ca0a?w=400&q=80",
  "Singapore": "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=400&q=80",
  "Marrakech": "https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=400&q=80",
};
const FALLBACK_IMG = "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&q=80";

function DestinationCard({ dest, index, searchParams, baseRules, exceptions, userLocation }) {
  const [expanded, setExpanded] = useState(false);

  const userProfile = {
    residence: searchParams?.residence || "",
    has_us_visa: searchParams?.has_us_visa || false,
    has_uk_visa: searchParams?.has_uk_visa || false,
    has_schengen_visa: searchParams?.has_schengen_visa || false,
  };

  const visaResult = resolveVisa(
    searchParams?.citizenship || "",
    dest.country,
    userProfile,
    baseRules,
    exceptions
  );

  const isRestricted = visaResult?.is_restricted;

  // Always calculate total from parts — never trust LLM returning budget as total
  const visaCost = visaResult?.visa_cost_usd != null ? visaResult.visa_cost_usd : (dest.visa_cost || 0);
  const calculatedTotal = (dest.flight_cost || 0) + (dest.hotel_total || 0) + (dest.food_total || 0) +
    (dest.transport_total || 0) + (dest.activities_total || 0) + visaCost;
  const displayTotal = calculatedTotal > 0 ? calculatedTotal : dest.total_cost;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
      <Card className="overflow-hidden bg-card border border-border">
        <div className="h-36 overflow-hidden relative">
          <img src={CITY_IMAGES[dest.city] || FALLBACK_IMG} alt={dest.city} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-white" />
                <h3 className="text-lg font-bold text-white">{dest.city}</h3>
              </div>
              <p className="text-xs text-white/80">{dest.country}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-white">{dest.currency}{displayTotal?.toLocaleString()}</p>
              <p className="text-[10px] text-white/70">est. total</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {dest.best_travel_window && (
              <Badge variant="secondary" className="text-xs">
                <Calendar className="w-3 h-3 mr-1" />{dest.best_travel_window}
              </Badge>
            )}
            <VisaResultBadge result={visaResult} />
          </div>

          {dest.description && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{dest.description}</p>
          )}

          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="mt-2 w-full text-primary">
            {expanded ? "Hide" : "View"} Details
            {expanded ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
          </Button>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="px-4 pb-4 space-y-4">
                <div className="bg-muted/50 rounded-xl p-4 space-y-2.5">
                  <h4 className="text-sm font-semibold mb-3">Cost Breakdown</h4>
                  <FlightCostLine value={dest.flight_cost} currency={dest.currency} sameCountry={dest.same_country_as_departure} originUnknown={dest.origin_unknown} />
                  <CostLine icon={Hotel} label={`Hotels (${(parseInt(searchParams?.trip_days) || 5) - 1} nights)`} value={dest.hotel_total} currency={dest.currency} />
                  <CostLine icon={UtensilsCrossed} label="Food" value={dest.food_total} currency={dest.currency} />
                  <CostLine icon={Bus} label="Transport" value={dest.transport_total} currency={dest.currency} />
                  <CostLine icon={Ticket} label="Activities" value={dest.activities_total} currency={dest.currency} />
                  <CostLine icon={FileText} label="Visa" value={visaResult?.visa_cost_usd ?? dest.visa_cost} currency={dest.currency} />
                  <div className="border-t border-border pt-2 mt-2 flex justify-between font-bold text-sm">
                    <span>Total</span>
                    <span className="text-primary">{dest.currency}{displayTotal?.toLocaleString()}</span>
                  </div>
                </div>

                {/* Full visa result */}
                <VisaResultDetail
                  result={visaResult}
                  passportCountry={searchParams?.citizenship}
                  residenceCountry={searchParams?.residence}
                  destinationCountry={dest.country}
                  hasUsVisa={searchParams?.has_us_visa}
                  hasUkVisa={searchParams?.has_uk_visa}
                  hasSchengenVisa={searchParams?.has_schengen_visa}
                />

                {dest.must_visit?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Must Visit</h4>
                    <div className="flex flex-wrap gap-2">
                      {dest.must_visit.map((place, i) => <Badge key={i} variant="outline" className="text-xs">{place}</Badge>)}
                    </div>
                  </div>
                )}

                {dest.suggested_itinerary && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Suggested Itinerary</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{dest.suggested_itinerary}</p>
                  </div>
                )}

                {/* Booking CTAs — suppressed if restricted */}
                {isRestricted ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-800 font-medium text-center">
                    Travel eligibility appears restricted. Please verify before making plans.
                  </div>
                ) : (
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => window.open(`https://www.kiwi.com/en/search/tiles/anywhere/anywhere/no-return?lang=en`, '_blank')}>
                      <Plane className="w-3 h-3 mr-1" /> Find Flights
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => window.open(`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(dest.city)}`, '_blank')}>
                      <Hotel className="w-3 h-3 mr-1" /> Find Hotels
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

function FlightCostLine({ value, currency, sameCountry, originUnknown }) {
  if (sameCountry) {
    return (
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground"><Plane className="w-3.5 h-3.5" /> Flights</span>
        <span className="font-medium text-green-600">No flight needed</span>
      </div>
    );
  }
  if (originUnknown) {
    return (
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground"><Plane className="w-3.5 h-3.5" /> Flights</span>
        <span className="text-xs text-amber-600 italic">Flight estimate requires location access</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-muted-foreground"><Plane className="w-3.5 h-3.5" /> Flights</span>
      <span className="font-medium">{currency}{(value || 0).toLocaleString()}</span>
    </div>
  );
}

function CostLine({ icon: Icon, label, value, currency }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-muted-foreground"><Icon className="w-3.5 h-3.5" /> {label}</span>
      <span className="font-medium">{currency}{(value || 0).toLocaleString()}</span>
    </div>
  );
}

export default function AdventureResults({ results, searchParams, userLocation }) {
  const { data: baseRules = [] } = useQuery({
    queryKey: ["visa-base-rules"],
    queryFn: () => base44.entities.VisaBaseRule.list(),
  });

  const { data: exceptions = [] } = useQuery({
    queryKey: ["visa-exceptions"],
    queryFn: () => base44.entities.VisaException.list(),
  });

  if (!results || results.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No destinations found within your budget. Try increasing your budget or adjusting preferences.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Top {results.length} Destinations</h2>
      {searchParams?.departure_label && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          ✈️ Flight estimates based on departure from: <strong>{searchParams.departure_label}</strong>
        </p>
      )}
      <p className="text-xs text-muted-foreground mb-4">Travel prices and exchange rates are estimates. Verify before booking.</p>
      {results.map((dest, i) => (
        <DestinationCard key={i} dest={dest} index={i} searchParams={searchParams} baseRules={baseRules} exceptions={exceptions} userLocation={userLocation} />
      ))}
    </div>
  );
}