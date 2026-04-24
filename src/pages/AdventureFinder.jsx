import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AdventureForm from "../components/adventure/AdventureForm";
import AdventureResults from "../components/adventure/AdventureResults";
import ChooseDestination from "../components/adventure/ChooseDestination";
import useUserLocation from "@/hooks/useUserLocation";
import { Compass, ArrowLeft, Sparkles, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { base44 } from "@/api/client";

export default function AdventureFinder() {
  const [mode, setMode] = useState("inspire");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchParams, setSearchParams] = useState(null);
  const userLocation = useUserLocation();

  const handleSearch = async (formData) => {
    setLoading(true);
    setSearchParams(formData);

    const dateInfo = formData.date_mode === "exact"
      ? "Departure: " + formData.departure_date + ", Return: " + formData.return_date
      : "Flexible: " + formData.trip_days + "-day trip within " + formData.flexible_value + " " + formData.flexible_unit;

    const departureBasis = formData.departure_city;
    const t = formData.travelers;
    const d = formData.trip_days;

    const prompt =
      "You are a travel budget advisor. Find the Top 5 travel destinations for this traveler.\n\n" +
      "Departure city: " + departureBasis + "\n" +
      "Passport country: " + formData.citizenship + "\n" +
      "Residence: " + (formData.residence || "same as passport") + "\n" +
      "Travelers: " + t + ", Trip length: " + d + " days\n" +
      "Date info: " + dateInfo + "\n" +
      "Budget: " + formData.budget + " " + formData.currency + "\n" +
      "Hotel preference: " + (formData.hotel_preference || "mid-range") + "\n" +
      "Travel style: " + (formData.travel_style || "any") + "\n\n" +
      "For each destination return costs in " + formData.currency + ":\n" +
      "- hotel_cost_per_night, hotel_total (x " + (d - 1) + " nights)\n" +
      "- daily_food, food_total (x " + t + " travelers x " + d + " days)\n" +
      "- daily_transport, transport_total (x " + t + " travelers x " + d + " days)\n" +
      "- activity_cost, activities_total (x " + t + " travelers x " + d + " days)\n" +
      "- visa_cost: total for all travelers (0 if visa-free)\n" +
      "- flight_cost: round-trip economy total for all " + t + " traveler(s) from " + departureBasis + " (always provide a non-zero estimate)\n" +
      "- total_cost: MUST equal flight_cost + hotel_total + food_total + transport_total + activities_total + visa_cost\n\n" +
      "Only suggest destinations where total_cost is within " + formData.budget + " " + formData.currency + ".\n" +
      "Consider visa preference: " + formData.visa_preference + ".\n" +
      "Return exactly 5 destinations sorted by value.";

    const llmPayload = {
      prompt,
      add_context_from_internet: true,
      model: "gemini_3_flash",
      response_json_schema: {
        type: "object",
        properties: {
          destinations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                city: { type: "string" },
                country: { type: "string" },
                total_cost: { type: "number" },
                currency: { type: "string" },
                flight_cost: { type: "number" },
                hotel_cost_per_night: { type: "number" },
                hotel_total: { type: "number" },
                daily_food: { type: "number" },
                food_total: { type: "number" },
                daily_transport: { type: "number" },
                transport_total: { type: "number" },
                activity_cost: { type: "number" },
                activities_total: { type: "number" },
                visa_type: { type: "string" },
                visa_cost: { type: "number" },
                visa_processing_days: { type: "number" },
                best_travel_window: { type: "string" },
                description: { type: "string" },
                must_visit: { type: "array", items: { type: "string" } }
              }
            }
          }
        }
      }
    };

    let res;
    try {
      res = await base44.integrations.Core.InvokeLLM(llmPayload);
    } catch (e) {
      // Retry once on invalid JSON error
      res = await base44.integrations.Core.InvokeLLM(llmPayload);
    }

    // Determine origin country client-side (never trust LLM for this)
    const originCountry = (userLocation && !userLocation.denied && userLocation.country)
      ? userLocation.country
      : (formData.residence || "");

    const destinations = (res?.destinations || []).map(dest => {
      const sameCountry = originCountry
        ? originCountry.toLowerCase().trim() === dest.country?.toLowerCase().trim()
        : null; // unknown
      return {
        ...dest,
        same_country_as_departure: sameCountry === true,
        origin_unknown: sameCountry === null,
        flight_cost: sameCountry === true ? 0 : dest.flight_cost,
        departure_label: departureBasis,
        location_denied: false,
      };
    });
    setResults(destinations);
    setSearchParams({
      ...formData,
      departure_label: departureBasis,
      locationDenied: false,
    });
    setLoading(false);
  };

  return (
    <div className="max-w-lg mx-auto px-5 py-6">
      <div className="flex items-center gap-3 mb-5">
        <Link to="/Home">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Compass className="w-5 h-5 text-accent" />
            Adventure Finder
          </h1>
          <p className="text-xs text-muted-foreground">Discover your next destination</p>
        </div>
      </div>

      <div className="flex bg-muted rounded-xl p-1 mb-6">
        <button
          onClick={() => { setMode("inspire"); setResults(null); setSearchParams(null); }}
          className={"flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all " +
            (mode === "inspire" ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          <Sparkles className="w-3.5 h-3.5" /> Inspire Me
        </button>
        <button
          onClick={() => { setMode("choose"); setResults(null); setSearchParams(null); }}
          className={"flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all " +
            (mode === "choose" ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          <MapPin className="w-3.5 h-3.5" /> I Already Know 😏
        </button>
      </div>

      <AnimatePresence mode="wait">
        {mode === "choose" && (
          <motion.div key="choose" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <ChooseDestination searchParams={searchParams} userLocation={userLocation} />
          </motion.div>
        )}

        {mode === "inspire" && !results && !loading && (
          <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <AdventureForm onSubmit={handleSearch} />
          </motion.div>
        )}

        {mode === "inspire" && loading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20">
            <div className="relative w-16 h-16 mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-muted" />
              <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-destructive" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground animate-pulse">Finding your perfect destinations...</p>
          </motion.div>
        )}

        {mode === "inspire" && results && !loading && (
          <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Button variant="ghost" size="sm" onClick={() => { setResults(null); setSearchParams(null); }} className="mb-4 text-muted-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> New search
            </Button>
            <AdventureResults results={results} searchParams={searchParams} userLocation={userLocation} />
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-[10px] text-muted-foreground text-center leading-relaxed max-w-sm mx-auto mt-8 pb-4">
        Visa information is indicative only. Please confirm requirements with the relevant embassy or official sources before traveling. Prices and exchange rates are estimates and subject to change.
      </p>
    </div>
  );
}