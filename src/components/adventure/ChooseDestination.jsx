import React, { useState } from "react";
import { base44 } from "@/api/client";
import useUserLocation from "@/hooks/useUserLocation";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, Headphones, Search, Plane, Hotel,
  UtensilsCrossed, Bus, Ticket, FileText, ChevronDown, ChevronUp, Calendar, PlaneTakeoff, CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { resolveVisa } from "@/components/visa/visaLogic";
import VisaResultBadge from "@/components/visa/VisaResultBadge";
import VisaResultDetail from "@/components/visa/VisaResultDetail";
import CountryAutocomplete from "@/components/adventure/CountryAutocomplete";

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

function CostLine({ icon: Icon, label, value, currency = "USD" }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-muted-foreground"><Icon className="w-3.5 h-3.5" /> {label}</span>
      <span className="font-medium">{currency === "USD" ? "$" : currency}{(value || 0).toLocaleString()}</span>
    </div>
  );
}

function FlightLine({ tripResult }) {
  if (tripResult.same_country_as_departure) {
    return (
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground"><Plane className="w-3.5 h-3.5" /> Flights</span>
        <span className="font-medium text-green-600">No flight needed</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground"><Plane className="w-3.5 h-3.5" /> Flights</span>
        <span className="font-medium">${(tripResult.flight_cost || 0).toLocaleString()}</span>
      </div>
      {tripResult.departure_label && (
        <p className="text-[10px] text-muted-foreground pl-6">From {tripResult.departure_label}</p>
      )}
    </div>
  );
}

function TripCostCard({ tripResult, visaResult, passport, residence, destination }) {
  const [expanded, setExpanded] = useState(true);
  const imgUrl = CITY_IMAGES[tripResult.city] || FALLBACK_IMG;
  const isRestricted = visaResult?.is_restricted;
  const visaCost = visaResult?.visa_cost_usd != null ? visaResult.visa_cost_usd : (tripResult.visa_cost || 0);
  const calculatedTotal = (tripResult.flight_cost || 0) + (tripResult.hotel_total || 0) + (tripResult.food_total || 0) +
    (tripResult.transport_total || 0) + (tripResult.activities_total || 0) + visaCost;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="overflow-hidden">
        <div className="h-32 overflow-hidden relative">
          <img src={imgUrl} alt={tripResult.city} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
            <p className="text-lg font-bold text-white">{tripResult.city}</p>
            <div className="text-right">
              <p className="text-lg font-bold text-white">${calculatedTotal.toLocaleString()}</p>
              <p className="text-[10px] text-white/70">est. total</p>
            </div>
          </div>
        </div>
        <div className="p-4">
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="w-full text-primary">
            {expanded ? "Hide" : "View"} Cost Breakdown
            {expanded ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
          </Button>
        </div>
        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="px-4 pb-4 space-y-4">
                <div className="bg-muted/50 rounded-xl p-4 space-y-2.5">
                  <FlightLine tripResult={tripResult} />
                  <CostLine icon={Hotel} label={`Hotels (${(tripResult.trip_days || 5) - 1} nights)`} value={tripResult.hotel_total} />
                  <CostLine icon={UtensilsCrossed} label="Food" value={tripResult.food_total} />
                  <CostLine icon={Bus} label="Transport" value={tripResult.transport_total} />
                  <CostLine icon={Ticket} label="Activities" value={tripResult.activities_total} />
                  <CostLine icon={FileText} label="Visa" value={visaResult?.visa_cost_usd ?? tripResult.visa_cost} />
                  <div className="border-t border-border pt-2 flex justify-between font-bold text-sm">
                    <span>Total</span>
                    <span className="text-primary">${calculatedTotal.toLocaleString()}</span>
                  </div>
                </div>
                {visaResult && (
                  <VisaResultDetail result={visaResult} passportCountry={passport} residenceCountry={residence} destinationCountry={tripResult.country || destination} />
                )}
                {isRestricted ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-800 font-medium text-center">
                    Travel eligibility appears restricted. Please verify before making plans.
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => window.open(`https://www.kiwi.com/en/search/tiles/anywhere/anywhere/no-return?lang=en`, '_blank')}>
                      <Plane className="w-3 h-3 mr-1" /> Book Flight
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => window.open(`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(tripResult.city)}`, '_blank')}>
                      <Hotel className="w-3 h-3 mr-1" /> Book Hotel
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

export default function ChooseDestination({ searchParams }) {
  const [destination, setDestination] = useState("");
  const [passport, setPassport] = useState(searchParams?.citizenship || "");
  const [residence, setResidence] = useState(searchParams?.residence || "");
  const [planningFrom, setPlanningFrom] = useState("current"); // "current" | "other"
  const [departureCity, setDepartureCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [tripDays, setTripDays] = useState("5");
  const [travelers, setTravelers] = useState("2");
  const [loadingTrip, setLoadingTrip] = useState(false);
  const [tripResult, setTripResult] = useState(null);
  const userLocation = useUserLocation();

  const { data: baseRules = [] } = useQuery({
    queryKey: ["visa-base-rules"],
    queryFn: () => base44.entities.VisaBaseRule.list(),
  });
  const { data: exceptions = [] } = useQuery({
    queryKey: ["visa-exceptions"],
    queryFn: () => base44.entities.VisaException.list(),
  });
  const { data: locations = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: () => base44.entities.Location.filter({ status: "active" }),
  });

  // Resolve the effective departure label
  const getEffectiveDeparture = () => {
    if (planningFrom === "other" && departureCity.trim()) {
      return { label: departureCity.trim(), isCurrentLocation: false, country: null };
    }
    if (!userLocation.denied && userLocation.country) {
      const label = userLocation.city ? `${userLocation.city}, ${userLocation.country}` : userLocation.country;
      return { label, isCurrentLocation: true, country: userLocation.country };
    }
    return { label: null, isCurrentLocation: true, country: null };
  };

  const isSameCountry = (destCountry) => {
    const dep = getEffectiveDeparture();
    if (!dep.country || !destCountry || !dep.isCurrentLocation) return false;
    return dep.country.toLowerCase().trim() === destCountry.toLowerCase().trim();
  };

  const handleSearch = async () => {
    if (!destination.trim()) return;
    setLoading(true);
    setTripResult(null);

    const destinationStories = locations.filter(loc =>
      loc.city?.toLowerCase().includes(destination.toLowerCase()) ||
      loc.country?.toLowerCase().includes(destination.toLowerCase())
    );

    const dep = getEffectiveDeparture();

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an emotionally engaging travel writer and advisor. Provide a vivid, decision-driving overview for: ${destination}
Passport: ${passport || "unknown"}, Residence: ${residence || "same"}
Departure city context: ${dep.label || "unknown"}

Return:
- destination_name, country
- emotional_tagline: one evocative sentence capturing the city's spirit (e.g. "A city of canals, culture, and effortless charm")
- trip_framing: one line like "Perfect for a 3–5 day escape" or "Ideal for a long weekend"
- daily_budget_low, daily_budget_mid, daily_budget_high (per person per day in USD)
- best_time_to_visit: include seasonal context (e.g. "April–May (tulip season), September–October (fewer crowds)")
- top_experiences: array of 3 experiential sentences (e.g. "Stand face-to-face with masterpieces at the Rijksmuseum")
- culture_note: max 2 sharp, impactful sentences about local culture
- hidden_gem: one memorable, specific hidden gem locals love
- why_it_fits: array of 3–4 short bullets explaining why this destination is great (e.g. "Great for cultural exploration", "Ideal for relaxed city walks")
- weather_summary
- nearest_airports: 3 nearest airports with iata_code, airport_name, city, country, approx_distance_km, airport_role (e.g. "Main international hub, fastest access", "Budget airline option", "Alternative if flights are cheaper")`,
      response_json_schema: {
        type: "object",
        properties: {
          destination_name: { type: "string" },
          country: { type: "string" },
          emotional_tagline: { type: "string" },
          trip_framing: { type: "string" },
          daily_budget_low: { type: "number" },
          daily_budget_mid: { type: "number" },
          daily_budget_high: { type: "number" },
          best_time_to_visit: { type: "string" },
          top_experiences: { type: "array", items: { type: "string" } },
          culture_note: { type: "string" },
          hidden_gem: { type: "string" },
          why_it_fits: { type: "array", items: { type: "string" } },
          weather_summary: { type: "string" },
          nearest_airports: {
            type: "array",
            items: {
              type: "object",
              properties: {
                iata_code: { type: "string" },
                airport_name: { type: "string" },
                city: { type: "string" },
                country: { type: "string" },
                approx_distance_km: { type: "number" },
                airport_role: { type: "string" },
              }
            }
          }
        }
      }
    });

    const sortedAirports = (res.nearest_airports || []).sort((a, b) => (a.approx_distance_km || 0) - (b.approx_distance_km || 0));
    setResult({ ...res, nearest_airports: sortedAirports, stories: destinationStories });
    setLoading(false);
  };

  const handleTakeMeThere = async () => {
    if (!result) return;
    setLoadingTrip(true);

    const days = parseInt(tripDays) || 5;
    const numTravelers = parseInt(travelers) || 2;
    const nights = days - 1;
    const destinationCountry = result.country || "";
    const dep = getEffectiveDeparture();
    const sameCountry = isSameCountry(destinationCountry);
    const departureLabel = dep.label || "unknown";

    const flightRule = sameCountry
      ? "flight_cost MUST be 0 — destination is in the same country as departure, no flight needed."
      : dep.label
        ? `flight_cost MUST be a realistic non-zero round-trip economy airfare total for all ${numTravelers} traveler(s) from ${departureLabel}. NEVER return 0.`
        : "flight_cost: use a generic global average estimate since departure location is unknown.";

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a travel budget advisor. Calculate a realistic trip cost estimate.
Destination: ${result.destination_name || destination}, ${destinationCountry}
Departure: ${departureLabel}
Passport: ${passport || "unknown"}, Residence: ${residence || "same"}
Travelers: ${numTravelers}, Trip length: ${days} days (${nights} hotel nights)
Hotel: mid-range

FLIGHT RULE: ${flightRule}

PROVIDE REALISTIC COSTS IN USD:
- flight_cost, hotel_cost_per_night, hotel_total (x${nights} nights), daily_food, food_total (x${numTravelers}x${days}), daily_transport, transport_total (x${numTravelers}x${days}), activity_cost, activities_total (x${numTravelers}x${days}), visa_cost, total_cost, best_travel_window`,
      model: "gemini_3_flash",
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          city: { type: "string" },
          country: { type: "string" },
          trip_days: { type: "number" },
          flight_cost: { type: "number" },
          hotel_cost_per_night: { type: "number" },
          hotel_total: { type: "number" },
          daily_food: { type: "number" },
          food_total: { type: "number" },
          daily_transport: { type: "number" },
          transport_total: { type: "number" },
          activity_cost: { type: "number" },
          activities_total: { type: "number" },
          visa_cost: { type: "number" },
          total_cost: { type: "number" },
          best_travel_window: { type: "string" },
        }
      }
    });

    const finalCity = res.city || result.destination_name || destination;
    const finalCountry = res.country || result.country;
    const nearestAirport = result.nearest_airports?.[0];
    const finalFlightCost = sameCountry ? 0 : res.flight_cost;

    setTripResult({
      ...res,
      flight_cost: finalFlightCost,
      same_country_as_departure: sameCountry,
      departure_label: departureLabel,
      city: finalCity,
      country: finalCountry,
      trip_days: days,
    });
    setLoadingTrip(false);

    base44.entities.DiscoveryLog.create({
      city: finalCity, country: finalCountry,
      description: result.culture_note || result.hidden_gem || "",
      flight_cost: finalFlightCost || 0, hotel_cost: res.hotel_total || 0,
      food_cost: res.food_total || 0, transport_cost: res.transport_total || 0,
      activities_cost: res.activities_total || 0, visa_cost: res.visa_cost || 0,
      total_estimated_cost: res.total_cost || 0,
      nearest_airport_name: nearestAirport?.airport_name || "",
      nearest_airport_iata: nearestAirport?.iata_code || "",
      passport_country: passport || "", residence_country: residence || "",
      approved: false,
    }).catch(() => {});
  };

  const dep = getEffectiveDeparture();

  const visaResult = (result && passport) ? resolveVisa(
    passport, result.country || destination,
    { residence, has_us_visa: false, has_uk_visa: false, has_schengen_visa: false },
    baseRules, exceptions
  ) : null;

  const tripVisaResult = (tripResult && passport) ? resolveVisa(
    passport, tripResult.country || destination,
    { residence, has_us_visa: false, has_uk_visa: false, has_schengen_visa: false },
    baseRules, exceptions
  ) : null;

  return (
    <div className="space-y-5">
      {/* Input form */}
      <div className="space-y-3">
        {/* Destination */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Destination</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={destination}
              onChange={e => setDestination(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="City or country (e.g. Istanbul, Morocco)"
              className="pl-10"
            />
          </div>
        </div>

        {/* Planning From */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Planning from</Label>
          <div className="flex gap-2">
            {[
              { key: "current", label: "My current location" },
              { key: "other",   label: "Another location" },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setPlanningFrom(key)}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-medium transition-colors ${
                  planningFrom === key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {planningFrom === "other" && (
            <Input
              placeholder="Enter departure city (e.g. Dubai)"
              value={departureCity}
              onChange={e => setDepartureCity(e.target.value)}
              className="mt-2"
            />
          )}

          {planningFrom === "current" && dep.label && (
            <p className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg px-3 py-1.5">
              📍 Based on your current location: <strong>{dep.label}</strong>
            </p>
          )}
          {planningFrom === "other" && departureCity.trim() && (
            <p className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg px-3 py-1.5">
              ✈️ Based on your departure: <strong>{departureCity}</strong>
            </p>
          )}
        </div>

        {/* Passport / Residence */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Your Passport <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <CountryAutocomplete value={passport} onChange={setPassport} placeholder="e.g. Syria" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Residence <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <CountryAutocomplete value={residence} onChange={setResidence} placeholder="e.g. Qatar" />
          </div>
        </div>

        <Button
          onClick={handleSearch}
          disabled={!destination.trim() || loading || (planningFrom === "other" && !departureCity.trim())}
          className="w-full h-11 bg-primary hover:bg-primary/90 font-semibold rounded-xl"
        >
          {loading ? "Exploring..." : "Plan My Trip"}
        </Button>
        <p className="text-center text-[11px] text-muted-foreground -mt-1">Flights, stays, and experiences tailored to you</p>
      </div>

      <AnimatePresence>
        {loading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-12">
            <div className="relative w-12 h-12 mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-muted" />
              <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground animate-pulse">Discovering {destination}...</p>
          </motion.div>
        )}

        {result && !loading && (
          <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

            {/* Hero header */}
            <div className="relative rounded-2xl overflow-hidden">
              <img
                src={CITY_IMAGES[result.destination_name] || FALLBACK_IMG}
                alt={result.destination_name}
                className="w-full h-44 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-end justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{result.destination_name || destination}</h2>
                    <p className="text-xs text-white/80">{result.country}</p>
                  </div>
                  {visaResult && <VisaResultBadge result={visaResult} />}
                </div>
              </div>
            </div>

            {/* Emotional tagline + trip framing */}
            {(result.emotional_tagline || result.trip_framing) && (
              <div className="space-y-1">
                {result.emotional_tagline && (
                  <p className="text-sm text-foreground/80 italic leading-relaxed">"{result.emotional_tagline}"</p>
                )}
                {result.trip_framing && (
                  <p className="text-xs font-semibold text-primary">{result.trip_framing}</p>
                )}
              </div>
            )}

            {/* Budget tiers */}
            <Card className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Daily Budget (per person)</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Budget",  sub: "Backpacker style",    value: result.daily_budget_low,  color: "text-green-600" },
                  { label: "Mid",     sub: "Comfortable travel",  value: result.daily_budget_mid,  color: "text-amber-600" },
                  { label: "Comfort", sub: "Premium experience",  value: result.daily_budget_high, color: "text-primary" },
                ].map(({ label, sub, value, color }) => (
                  <div key={label} className="bg-muted/40 rounded-xl p-3">
                    <p className={`text-base font-bold ${color}`}>${value || "?"}</p>
                    <p className="text-[10px] font-medium text-foreground/70">{label}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Visa */}
            {visaResult && (
              <VisaResultDetail result={visaResult} passportCountry={passport} residenceCountry={residence} destinationCountry={result.country || destination} />
            )}

            {/* Top experiences */}
            {result.top_experiences?.length > 0 && (
              <Card className="p-4 space-y-2.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Top Experiences</p>
                {result.top_experiences.map((exp, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="text-lg mt-0.5">
                      {i === 0 ? "🎨" : i === 1 ? "🚤" : "🌿"}
                    </span>
                    <p className="text-sm leading-relaxed">{exp}</p>
                  </div>
                ))}
              </Card>
            )}

            {/* Why it fits */}
            {result.why_it_fits?.length > 0 && (
              <Card className="p-4 bg-primary/5 border-primary/20">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">Why this matches your vibe</p>
                <div className="space-y-2">
                  {result.why_it_fits.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <p className="text-sm">{item}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Hidden gem — accent styled */}
            {result.hidden_gem && (
              <Card className="p-4 bg-accent/10 border-accent/30">
                <p className="text-xs font-semibold text-accent-foreground uppercase tracking-wide mb-1.5">
                  🔍 Not everyone knows this…
                </p>
                <p className="text-sm leading-relaxed">{result.hidden_gem}</p>
              </Card>
            )}

            {/* Culture note */}
            {result.culture_note && (
              <Card className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">🎭 Local Culture</p>
                <p className="text-sm leading-relaxed line-clamp-2">{result.culture_note}</p>
              </Card>
            )}

            {/* Best time to visit */}
            {result.best_time_to_visit && (
              <Card className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">📅 Best Time to Visit</p>
                <p className="text-sm leading-relaxed">{result.best_time_to_visit}</p>
              </Card>
            )}

            {/* Airports */}
            {result.nearest_airports?.length > 0 && (
              <Card className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1">
                  <PlaneTakeoff className="w-3.5 h-3.5" /> Nearest Airports
                </p>
                <div className="space-y-3">
                  {result.nearest_airports.map((ap, i) => (
                    <div key={i} className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span className="text-xs font-bold bg-primary/10 text-primary rounded px-1.5 py-0.5 mt-0.5 flex-shrink-0">{ap.iata_code}</span>
                        <div>
                          <p className="text-sm font-medium leading-tight">{ap.airport_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {ap.city}
                            {ap.country !== result.country && <span className="ml-1 text-amber-600 font-medium">({ap.country})</span>}
                          </p>
                          {ap.airport_role && (
                            <p className="text-[10px] text-muted-foreground italic mt-0.5">{ap.airport_role}</p>
                          )}
                        </div>
                      </div>
                      {ap.approx_distance_km && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">~{ap.approx_distance_km} km</span>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* TukaPath stories */}
            {result.stories?.length > 0 && (
              <Card className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1">
                  <Headphones className="w-3.5 h-3.5" /> Stories in TukaPath
                </p>
                <div className="space-y-1.5">
                  {result.stories.slice(0, 5).map((loc) => (
                    <a key={loc.id} href={`/LocationDetail?id=${loc.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-primary" />
                        <span className="text-sm font-medium">{loc.name}</span>
                      </div>
                      {loc.has_story && <Badge className="text-[10px] bg-primary/10 text-primary">Story</Badge>}
                    </a>
                  ))}
                </div>
              </Card>
            )}

            {/* Plan CTA */}
            {!tripResult && (
              <div className="space-y-3 pt-1">
                {/* Departure note */}
                {dep.label && isSameCountry(result.country) ? (
                  <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2 border border-green-200">
                    ✅ Same country as departure — no flight needed
                  </p>
                ) : dep.label ? (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                    ✈️ {planningFrom === "other" ? "Based on your departure:" : "Based on your current location:"} <strong>{dep.label}</strong>
                  </p>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Trip Length (days)</Label>
                    <Input type="number" min="1" max="30" value={tripDays} onChange={e => setTripDays(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Travelers</Label>
                    <Input type="number" min="1" max="20" value={travelers} onChange={e => setTravelers(e.target.value)} />
                  </div>
                </div>

                <Button
                  onClick={handleTakeMeThere}
                  disabled={loadingTrip}
                  className="w-full h-12 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-base rounded-xl"
                >
                  {loadingTrip ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-accent-foreground/40 border-t-accent-foreground rounded-full animate-spin" />
                      Calculating...
                    </span>
                  ) : "Start Planning My Trip ✈️"}
                </Button>
              </div>
            )}

            {loadingTrip && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-8">
                <div className="relative w-12 h-12 mb-3">
                  <div className="absolute inset-0 rounded-full border-4 border-muted" />
                  <div className="absolute inset-0 rounded-full border-4 border-accent border-t-transparent animate-spin" />
                </div>
                <p className="text-sm text-muted-foreground animate-pulse">Calculating your trip cost...</p>
              </motion.div>
            )}

            {tripResult && !loadingTrip && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="pt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">Your Trip Estimate</h3>
                  <button onClick={() => setTripResult(null)} className="text-xs text-muted-foreground hover:underline">Recalculate</button>
                </div>
                <TripCostCard tripResult={tripResult} visaResult={tripVisaResult} passport={passport} residence={residence} destination={destination} />
                <p className="text-[10px] text-muted-foreground text-center leading-relaxed pb-2">
                  Estimates only. Prices vary by season, airline, and availability.
                </p>
              </motion.div>
            )}

            <Button variant="outline" size="sm" className="w-full" onClick={() => { setResult(null); setTripResult(null); }}>
              Search another destination
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}