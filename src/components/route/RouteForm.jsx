import React from "react";
import { Button } from "@/components/ui/button";
import { Car, Footprints, Clock, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import LocationSearch from "./LocationSearch";
import JourneyDescriptionInput from "./JourneyDescriptionInput";

const ROUTE_MODES = [
  { key: "on_the_way",    label: "Stay on the way",  hint: "Only places naturally along your route" },
  { key: "explore_around", label: "Explore around",  hint: "Allow scenic detours" },
];

const AVOID_OPTIONS = [
  { key: "highways",     label: "No highways" },
  { key: "tolls",        label: "No tolls" },
  { key: "traffic",      label: "Avoid traffic" },
];

const TIME_OPTIONS = [
  { value: 30,  label: "30 min" },
  { value: 60,  label: "1 hr" },
  { value: 90,  label: "1.5 hrs" },
  { value: 120, label: "2 hrs" },
  { value: 180, label: "3 hrs" },
  { value: 240, label: "4 hrs" },
  { value: 360, label: "Half day" },
  { value: 480, label: "Full day" },
];

function Chip({ active, danger, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
        ${active && danger ? "bg-destructive/10 text-destructive border-destructive/30"
          : active ? "bg-primary text-primary-foreground border-primary"
          : "bg-card border-border text-muted-foreground hover:bg-muted"}`}
    >
      {children}
    </button>
  );
}

export default function RouteForm({ form, onChange, onSubmit, loading, userPos }) {
  const toggleAvoid = (key) => {
    const current = form.avoid_options || [];
    onChange({ avoid_options: current.includes(key) ? current.filter(a => a !== key) : [...current, key] });
  };

  const handleParsed = (parsed) => {
    const patch = {};
    if (parsed.transport_mode) patch.mode = parsed.transport_mode;
    if (parsed.duration_minutes) patch.total_time_available = parsed.duration_minutes;
    if (parsed.avoid?.length) patch.avoid_options = parsed.avoid;
    if (parsed.destination) patch.destination_point_name = parsed.destination;
    onChange(patch);
  };

  const canSubmit = form.start_location?.lat || form.start_point;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

      {/* Step label */}
      <div>
        <p className="text-xs text-primary font-semibold uppercase tracking-wide mb-0.5">Step 1 of 2</p>
        <p className="text-xs text-muted-foreground">Set your journey details, then we'll suggest stops</p>
      </div>

      {/* Natural language description */}
      <JourneyDescriptionInput onParsed={handleParsed} />

      <div className="h-px bg-border" />

      {/* Start location */}
      <div>
        <LocationSearch
          label="Starting from"
          placeholder="Where are you starting?"
          value={form.start_location}
          onChange={(loc) => onChange({ start_location: loc, start_point: loc?.name || "" })}
          userPos={userPos}
          allowCurrentLocation={true}
        />
        {!form.start_location && userPos && (
          <button
            onClick={() => onChange({ start_location: { name: "Current location", lat: userPos.lat, lng: userPos.lng }, start_point: "Current location" })}
            className="mt-1.5 flex items-center gap-1 text-xs text-primary font-medium hover:underline"
          >
            <MapPin className="w-3 h-3" /> Use my current location
          </button>
        )}
      </div>

      {/* Destination */}
      <div>
        <LocationSearch
          label="Destination"
          placeholder="Where do you want to end up?"
          value={form.destination_location}
          onChange={(loc) => onChange({ destination_location: loc, destination_point: loc?.name || "" })}
          userPos={userPos}
          optional={true}
        />
        {!form.destination_location && (
          <p className="mt-1 text-[11px] text-muted-foreground">Leave empty for a loop journey back to start</p>
        )}
      </div>

      {/* Travel mode */}
      <div>
        <label className="text-xs text-muted-foreground mb-2 block">How are you travelling?</label>
        <div className="flex gap-2">
          {[{ key: "drive", label: "Drive", Icon: Car }, { key: "walk", label: "Walk", Icon: Footprints }].map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => onChange({ mode: key })}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors
                ${form.mode === key ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"}`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Time available */}
      <div>
        <label className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> Time available
        </label>
        <div className="flex flex-wrap gap-2">
          {TIME_OPTIONS.map(({ value, label }) => (
            <Chip key={value} active={form.total_time_available === value} onClick={() => onChange({ total_time_available: value })}>
              {label}
            </Chip>
          ))}
        </div>
      </div>

      {/* Route preference */}
      <div>
        <label className="text-xs text-muted-foreground mb-2 block">Route preference</label>
        <div className="flex gap-2">
          {ROUTE_MODES.map(({ key, label, hint }) => (
            <button
              key={key}
              onClick={() => onChange({ route_mode: key })}
              className={`flex-1 flex flex-col items-start px-4 py-3 rounded-xl border text-left transition-colors
                ${form.route_mode === key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:bg-muted"}`}
            >
              <p className="text-xs font-semibold">{label}</p>
              <p className={`text-[10px] mt-0.5 ${form.route_mode === key ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{hint}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Avoid */}
      <div>
        <label className="text-xs text-muted-foreground mb-2 block">Avoid <span className="opacity-60">(optional)</span></label>
        <div className="flex flex-wrap gap-2">
          {AVOID_OPTIONS.map(({ key, label }) => (
            <Chip key={key} danger active={(form.avoid_options || []).includes(key)} onClick={() => toggleAvoid(key)}>
              {label}
            </Chip>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">Anything else? <span className="opacity-60">(optional)</span></label>
        <textarea
          placeholder="e.g. I want to see old villages and stop somewhere quiet..."
          value={form.notes || ""}
          onChange={e => onChange({ notes: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border border-input bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none h-16"
        />
      </div>

      {/* Submit */}
      <Button
        className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 font-semibold"
        onClick={onSubmit}
        disabled={loading || !canSubmit}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Finding stops...
          </span>
        ) : (
          <span className="flex items-center gap-2">✨ Suggest stops for my journey</span>
        )}
      </Button>

      {!canSubmit && (
        <p className="text-center text-xs text-muted-foreground -mt-3">Enter a starting point to continue</p>
      )}
    </motion.div>
  );
}