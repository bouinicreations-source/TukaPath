import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ChevronDown, Zap } from "lucide-react";

const CATEGORIES = [
  { value: "any",               label: "Any / All" },
  { value: "tourist attractions", label: "Landmarks & Attractions" },
  { value: "museum",            label: "Museums" },
  { value: "park",              label: "Parks & Nature" },
  { value: "art gallery",       label: "Art Galleries / Public Art" },
  { value: "place of worship",  label: "Religious Sites" },
  { value: "restaurant",        label: "Restaurants" },
  { value: "cafe",              label: "Cafes" },
  { value: "hotel",             label: "Hotels" },
  { value: "beach",             label: "Beaches" },
];

// Context-aware presets — keyed by normalized "country|city" (lowercase, trimmed)
// country-only keys (city="") match when city is blank
const PRESET_MAP = {
  "qatar|doha": [
    { label: "🏛 Museums",          category: "museum",             maxResults: 20 },
    { label: "🗺 Landmarks",        category: "tourist attractions", maxResults: 20 },
    { label: "🎨 Public Art",       category: "art gallery",         maxResults: 20 },
    { label: "🌿 Parks",            category: "park",                maxResults: 20 },
    { label: "🛐 Religious Sites",  category: "place of worship",    maxResults: 20 },
    { label: "☕ Cafes",            category: "cafe",                maxResults: 20 },
    { label: "🍽 Restaurants",     category: "restaurant",          maxResults: 20 },
    { label: "🏨 Hotels",           category: "hotel",               maxResults: 20 },
  ],
  "qatar|": [
    { label: "🗺 Doha Landmarks",  city: "Doha",       category: "tourist attractions", maxResults: 20 },
    { label: "🏛 Doha Museums",    city: "Doha",       category: "museum",              maxResults: 20 },
    { label: "🗺 Al Wakrah",       city: "Al Wakrah",  category: "tourist attractions", maxResults: 20 },
    { label: "🗺 Al Khor",         city: "Al Khor",    category: "tourist attractions", maxResults: 20 },
  ],
};

function getPresets(country, city) {
  const c = (country || "").trim().toLowerCase();
  const ci = (city || "").trim().toLowerCase();
  if (!c) return null; // nothing selected — no presets
  const key = `${c}|${ci}`;
  if (PRESET_MAP[key]) return { presets: PRESET_MAP[key], key };
  const countryKey = `${c}|`;
  if (PRESET_MAP[countryKey]) return { presets: PRESET_MAP[countryKey], key: countryKey };
  return null; // unknown country/city — no presets
}

export default function BulkGenForm({ form, onChange, onFetch, loading }) {
  const [showPresets, setShowPresets] = useState(false);

  const contextPresets = getPresets(form.country, form.city);

  const applyPreset = (preset) => {
    onChange({
      country: preset.country || form.country,
      city:    preset.city    || form.city,
      category: preset.category,
      maxResults: preset.maxResults,
    });
    setShowPresets(false);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">Search Parameters</h3>
        {contextPresets && (
          <button
            onClick={() => setShowPresets(v => !v)}
            className="flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
          >
            <Zap className="w-3 h-3" /> Area Presets
            <ChevronDown className={`w-3 h-3 transition-transform ${showPresets ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {/* Context-aware presets */}
      {showPresets && contextPresets && (
        <div className="grid grid-cols-2 gap-1.5 p-3 bg-muted/40 rounded-xl border border-border">
          <p className="col-span-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
            Area Presets — click to auto-fill
          </p>
          {contextPresets.presets.map(preset => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset)}
              className="text-left text-xs px-3 py-2 rounded-lg bg-card border border-border hover:bg-primary/5 hover:border-primary/30 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Country</label>
          <Input
            value={form.country}
            onChange={e => onChange({ country: e.target.value })}
            placeholder="e.g. Qatar"
            className="text-sm"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">City / Area</label>
          <Input
            value={form.city}
            onChange={e => onChange({ city: e.target.value })}
            placeholder="e.g. Paris, Istanbul…"
            className="text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Category</label>
          <div className="relative">
            <select
              value={form.category}
              onChange={e => onChange({ category: e.target.value })}
              className="w-full h-9 pl-3 pr-8 rounded-md border border-input bg-transparent text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Max Results</label>
          <Input
            type="number"
            min={5}
            max={60}
            value={form.maxResults}
            onChange={e => onChange({ maxResults: parseInt(e.target.value) || 20 })}
            className="text-sm"
          />
        </div>
      </div>

      <Button
        onClick={onFetch}
        disabled={loading || !form.country || !form.city}
        className="w-full rounded-xl font-semibold"
      >
        {loading ? (
          <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Fetching from Google Places…</>
        ) : (
          <><Search className="w-3.5 h-3.5 mr-2" />Fetch Candidates</>
        )}
      </Button>
    </div>
  );
}