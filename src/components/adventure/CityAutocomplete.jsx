import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

const POPULAR_CITIES = [
  "Paris", "Amsterdam", "London", "Berlin", "Rome", "Barcelona", "Prague", "Vienna",
  "Budapest", "Istanbul", "Dubai", "Tokyo", "New York", "Los Angeles", "Miami",
  "Toronto", "Vancouver", "Sydney", "Singapore", "Bangkok", "Mumbai", "Cairo",
  "Madrid", "Lisbon", "Athens", "Stockholm", "Copenhagen", "Oslo", "Helsinki",
  "Warsaw", "Krakow", "Bucharest", "Sofia", "Belgrade", "Sarajevo", "Zagreb"
];

export default function CityAutocomplete({ value, onChange, placeholder, required }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    onChange(val);
    
    if (val.length > 0) {
      const filtered = POPULAR_CITIES.filter(city => 
        city.toLowerCase().startsWith(val.toLowerCase())
      ).slice(0, 6);
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectCity = (city) => {
    onChange(city);
    setShowSuggestions(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onFocus={() => value.length > 0 && setSuggestions(POPULAR_CITIES.filter(c => c.toLowerCase().startsWith(value.toLowerCase())).slice(0, 6))}
        required={required}
      />
      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
          >
            {suggestions.map((city, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => selectCity(city)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
              >
                {city}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}