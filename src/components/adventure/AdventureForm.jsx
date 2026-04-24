import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar, Users, DollarSign, Plane, Star, Globe, ChevronDown, ChevronUp } from "lucide-react";
import CityAutocomplete from "./CityAutocomplete";
import CountryAutocomplete from "./CountryAutocomplete";

const CURRENCIES = ["EUR", "USD", "GBP", "TRY", "AED", "SAR", "JPY", "CAD", "AUD"];
const HOTEL_OPTIONS = ["1 star", "2 star", "3 star", "4 star", "5 star", "All"];
const STYLES = ["Nature", "Culture", "Beach", "Adventure", "Food", "City", "Luxury", "Budget"];

export default function AdventureForm({ onSubmit }) {
  const [form, setForm] = useState({
    departure_city: "",
    citizenship: "",
    residence: "",
    budget: "",
    currency: "EUR",
    travelers: "1",
    trip_value: "5",
    trip_unit: "Days",
    activities_per_day: "0",
    hotel_preference: "all",
    travel_style: "Culture",
    date_mode: "flexible",
    departure_date: "",
    return_date: "",
    flexible_window: "1_week",
    has_us_visa: false,
    has_uk_visa: false,
    has_schengen_visa: false,
  });
  const [showVisa, setShowVisa] = useState(false);

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const tripDays = () => {
    const n = parseInt(form.trip_value) || 1;
    if (form.trip_unit === "Weeks") return n * 7;
    if (form.trip_unit === "Months") return n * 30;
    return n;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const flexMap = { "3_days": "within 3 days", "1_week": "within 1 week", "2_weeks": "within 2 weeks", "1_month": "within 1 month", "3_months": "within 3 months" };
    onSubmit({
      ...form,
      trip_days: String(tripDays()),
      flexible_value: form.flexible_window.split("_")[0],
      flexible_unit: form.flexible_window.split("_")[1],
      activities_per_stay: form.activities_per_day,
      visa_preference: (form.citizenship || form.residence) ? "check" : "skip",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Departure */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <Plane className="w-4 h-4 text-primary" /> Departure City
        </Label>
        <CityAutocomplete
          placeholder="e.g. Amsterdam"
          value={form.departure_city}
          onChange={(val) => update("departure_city", val)}
          required
        />
      </div>

      {/* Budget + Currency */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-2">
          <Label className="flex items-center gap-1.5 text-sm font-medium">
            <DollarSign className="w-4 h-4 text-accent" /> Budget
          </Label>
          <Input
            type="text"
            placeholder="1,500"
            value={form.budget ? Number(form.budget).toLocaleString() : ""}
            onChange={(e) => {
              const num = e.target.value.replace(/,/g, "");
              if (/^\d*$/.test(num)) update("budget", num);
            }}
            required
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Currency</Label>
          <Select value={form.currency} onValueChange={(v) => update("currency", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Travelers + Trip Length */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm font-medium">
            <Users className="w-4 h-4 text-primary" /> Travelers
          </Label>
          <Select value={form.travelers} onValueChange={(v) => update("travelers", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Trip Length</Label>
          <div className="flex gap-1.5">
            <Input
              type="number"
              min="1"
              max="365"
              value={form.trip_value}
              onChange={(e) => update("trip_value", e.target.value)}
              className="w-16 flex-shrink-0"
            />
            <Select value={form.trip_unit} onValueChange={(v) => update("trip_unit", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Days">Days</SelectItem>
                <SelectItem value="Weeks">Weeks</SelectItem>
                <SelectItem value="Months">Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Activities per day */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Activities per day</Label>
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => update("activities_per_day", String(n))}
              className={`w-10 h-10 rounded-xl text-sm font-semibold transition-colors border ${
                form.activities_per_day === String(n)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      {/* Hotel Preference */}
<div className="space-y-2">
  <Label className="flex items-center gap-1.5 text-sm font-medium">
    <Star className="w-4 h-4 text-accent" /> Hotel Preference
  </Label>

  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        className="w-full rounded-md border bg-background px-3 py-2 text-left text-sm flex items-center justify-between"
      >
        <span>
          {form.hotel_preference === "all"
            ? "All"
            : `${form.hotel_preference.join(", ")} ★`}
        </span>
        <ChevronDown className="w-4 h-4 opacity-60" />
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="start" className="w-52">
      <DropdownMenuCheckboxItem
        checked={form.hotel_preference === "all"}
        onSelect={(e) => e.preventDefault()}
        onCheckedChange={() => update("hotel_preference", "all")}
      >
        All
      </DropdownMenuCheckboxItem>

      {["1", "2", "3", "4", "5"].map((star) => (
        <DropdownMenuCheckboxItem
          key={star}
          checked={
            form.hotel_preference !== "all" &&
            form.hotel_preference.includes(star)
          }
          onSelect={(e) => e.preventDefault()}
          onCheckedChange={(checked) => {
            let current =
              form.hotel_preference === "all" ? [] : form.hotel_preference

            let next = checked
              ? [...current, star]
              : current.filter((s) => s !== star)

            next = [...new Set(next)].sort()

            update(
              "hotel_preference",
              next.length === 0 || next.length === 5 ? "all" : next
            )
          }}
        >
          {star} ★
        </DropdownMenuCheckboxItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
      </div>

      {/* Travel Style */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Travel Style</Label>
        <div className="flex flex-wrap gap-2">
          {STYLES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                const current = Array.isArray(form.travel_style) ? form.travel_style : [];
                const next = current.includes(s) ? current.filter((item) => item !== s) : [...current, s];
                update("travel_style", next);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                Array.isArray(form.travel_style) && form.travel_style.includes(s) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Visa Preference (collapsible) */}
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowVisa(!showVisa)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" /> Visa Preference
            <span className="text-xs text-muted-foreground font-normal">(optional)</span>
          </span>
          {showVisa ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showVisa && (
          <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">Fill in to check visa requirements. Leave empty to skip.</p>
            <div className="space-y-2">
              <Label className="text-xs">Passport Country (optional)</Label>
              <CountryAutocomplete
                placeholder="e.g. Netherlands"
                value={form.citizenship}
                onChange={(val) => update("citizenship", val)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Country of Residence (optional)</Label>
              <CountryAutocomplete
                placeholder="e.g. Germany"
                value={form.residence}
                onChange={(val) => update("residence", val)}
              />
            </div>
            {/* Visa flags */}
            <div className="space-y-2 pt-1">
              <Label className="text-xs font-medium">Visas you currently hold (optional)</Label>
              {[
                { key: "has_us_visa", label: "🇺🇸 Holding valid US visa" },
                { key: "has_uk_visa", label: "🇬🇧 Holding valid UK visa" },
                { key: "has_schengen_visa", label: "🇪🇺 Holding valid Schengen visa" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={e => update(key, e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-xs text-foreground">{label}</span>
                </label>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
              ⚠️ Visa guidance is indicative only. Please double-check with the destination country's embassy or consulate before traveling.
            </p>
            {!form.citizenship && !form.residence && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                ⚠️ Visa requirements not checked.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Date Mode */}
      <div className="space-y-3">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <Calendar className="w-4 h-4 text-primary" /> Travel Dates
        </Label>
        <RadioGroup value={form.date_mode} onValueChange={(v) => update("date_mode", v)} className="flex gap-4">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="exact" id="exact" />
            <Label htmlFor="exact" className="text-sm">Exact Dates</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="flexible" id="flexible" />
            <Label htmlFor="flexible" className="text-sm">Flexible</Label>
          </div>
        </RadioGroup>

        {form.date_mode === "exact" ? (
          <div className="grid grid-cols-2 gap-3">
            <Input type="date" value={form.departure_date} onChange={(e) => update("departure_date", e.target.value)} required />
            <Input type="date" value={form.return_date} onChange={(e) => update("return_date", e.target.value)} required />
          </div>
        ) : (
          <Select value={form.flexible_window} onValueChange={(v) => update("flexible_window", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3_days">within 3 days</SelectItem>
              <SelectItem value="1_week">within 1 week</SelectItem>
              <SelectItem value="2_weeks">within 2 weeks</SelectItem>
              <SelectItem value="1_month">within 1 month</SelectItem>
              <SelectItem value="3_months">within 3 months</SelectItem>
              <SelectItem value="season_any">anytime this season</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <Button type="submit" className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-base font-semibold">
        Find Destinations
      </Button>
    </form>
  );
}