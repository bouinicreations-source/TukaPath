import React, { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, LocateFixed, X, Loader2 } from "lucide-react";

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function LocationSearch({
  value,
  onChange,
  placeholder = "Search for a place...",
  userPos = null,
  allowCurrentLocation = false,
  label,
  optional = false,
}) {
  const [query, setQuery] = useState(value?.name || "");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const debouncedQuery = useDebounce(query, 300);
  const cacheRef = useRef({});

  // Sync external value display name
  useEffect(() => {
    if (value?.name && value.name !== query) setQuery(value.name);
  }, [value?.name]);

  // Fetch suggestions
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSuggestions([]);
      return;
    }
    if (value?.name === debouncedQuery) return; // already selected

    const cacheKey = `${debouncedQuery}|${userPos?.lat}`;
    if (cacheRef.current[cacheKey]) {
      setSuggestions(cacheRef.current[cacheKey]);
      return;
    }

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      q: debouncedQuery,
      format: "json",
      limit: "8",
      addressdetails: "1",
    });
    if (userPos) {
      params.append("lat", userPos.lat);
      params.append("lon", userPos.lng);
      params.append("countrycodes", ""); // no restriction
    }

    fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "Accept-Language": "en", "User-Agent": "TukaPath/1.0" },
    })
      .then(r => r.json())
      .then(data => {
        const results = data.slice(0, 8).map(item => {
          const addr = item.address || {};
          const area = addr.suburb || addr.neighbourhood || addr.city_district || addr.city || addr.town || addr.county || "";
          const country = addr.country || "";
          let dist = null;
          if (userPos) {
            const R = 6371;
            const dLat = ((parseFloat(item.lat) - userPos.lat) * Math.PI) / 180;
            const dLon = ((parseFloat(item.lon) - userPos.lng) * Math.PI) / 180;
            const a = Math.sin(dLat / 2) ** 2 + Math.cos((userPos.lat * Math.PI) / 180) * Math.cos((parseFloat(item.lat) * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
            dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          }
          return {
            name: item.display_name.split(",")[0],
            area: [area, country].filter(Boolean).join(", "),
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            place_id: item.place_id,
            dist,
          };
        });

        // Sort by distance if available
        if (userPos) results.sort((a, b) => (a.dist ?? 999) - (b.dist ?? 999));

        cacheRef.current[cacheKey] = results;
        setSuggestions(results);
        setOpen(true);
      })
      .catch(() => setError("Search unavailable. Try again."))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  const select = (s) => {
    setQuery(s.name);
    setSuggestions([]);
    setOpen(false);
    onChange({ name: s.name, lat: s.lat, lng: s.lng, place_id: s.place_id });
  };

  const useCurrentLocation = () => {
    if (userPos) {
      setQuery("Current location");
      setOpen(false);
      onChange({ name: "Current location", lat: userPos.lat, lng: userPos.lng });
    }
  };

  const clear = () => {
    setQuery("");
    setSuggestions([]);
    onChange(null);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (!containerRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="text-xs text-muted-foreground mb-1.5 block">
          {label} {optional && <span className="opacity-60">(optional)</span>}
        </label>
      )}
      <div className="relative flex items-center">
        <MapPin className="absolute left-3 w-4 h-4 text-primary flex-shrink-0 pointer-events-none" />
        <input
          className="w-full pl-9 pr-8 h-11 rounded-xl border border-input bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={placeholder}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (query.length >= 2) setOpen(true); }}
        />
        {loading && <Loader2 className="absolute right-3 w-4 h-4 text-muted-foreground animate-spin" />}
        {!loading && query && (
          <button onClick={clear} className="absolute right-3 p-0.5 rounded-full hover:bg-muted">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-[2000] left-0 right-0 mt-1.5 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          {error && (
            <div className="px-4 py-3 text-xs text-destructive">{error}</div>
          )}
          {allowCurrentLocation && userPos && !query && (
            <button
              onClick={useCurrentLocation}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted text-left"
            >
              <LocateFixed className="w-4 h-4 text-primary flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Current location</p>
                <p className="text-[11px] text-muted-foreground">Use where you are now</p>
              </div>
            </button>
          )}
          {suggestions.map((s, i) => (
            <button
              key={s.place_id || i}
              onClick={() => select(s)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted text-left border-t border-border/40 first:border-0"
            >
              <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{s.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {s.area}{s.dist != null ? ` · ${s.dist < 1 ? `${Math.round(s.dist * 1000)}m` : `${s.dist.toFixed(1)}km`} away` : ""}
                </p>
              </div>
            </button>
          ))}
          {!loading && !error && debouncedQuery.length >= 2 && suggestions.length === 0 && (
            <div className="px-4 py-3 text-xs text-muted-foreground">No results found. Try a different name.</div>
          )}
        </div>
      )}
    </div>
  );
}