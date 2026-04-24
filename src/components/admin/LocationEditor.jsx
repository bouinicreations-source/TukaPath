import React, { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Search, ChevronDown, ChevronUp,
  RefreshCw, Headphones, Save, EyeOff, Trash2, Copy,
  CheckCircle2, AlertCircle, Circle, Plane, ShieldCheck, X
} from "lucide-react";
import UnsplashImagePicker from "./UnsplashImagePicker";
import { toast } from "sonner";
import { base44 } from "@/api/client";
import { getAudioStatus } from "./LocationAudioManager";
import { useQuery } from "@tanstack/react-query";

const CATEGORIES = ["landmark", "statue", "monument", "hidden_spot", "museum", "park", "religious", "bridge", "tower", "square", "restaurant", "cafe", "hotel", "petrol_station", "other"];

const PLACE_TYPE_CODES = [
  { code: "ATT", label: "ATT — Attraction" },
  { code: "MUS", label: "MUS — Museum" },
  { code: "ART", label: "ART — Public Art" },
  { code: "BEA", label: "BEA — Beach" },
  { code: "NAT", label: "NAT — Nature" },
  { code: "CAF", label: "CAF — Café" },
  { code: "RES", label: "RES — Restaurant" },
  { code: "HOT", label: "HOT — Hotel" },
  { code: "BAR", label: "BAR — Bar" },
  { code: "BRN", label: "BRN — Brunch" },
  { code: "FUL", label: "FUL — Fuel / Petrol" },
  { code: "PAR", label: "PAR — Parking" },
  { code: "RST", label: "RST — Restroom" },
  { code: "OTH", label: "OTH — Other" },
];

const KNOWN_DOMAINS = [
  { pattern: "qm.org.qa", name: "Qatar Museums", url: "https://www.qm.org.qa" },
  { pattern: "visitqatar.com", name: "Visit Qatar", url: "https://www.visitqatar.com" },
  { pattern: "wikipedia.org", name: "Wikipedia", url: "https://www.wikipedia.org" },
  { pattern: "wikimedia.org", name: "Wikimedia Commons", url: "https://commons.wikimedia.org" },
];

function detectSourceFromUrl(url) {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    for (const entry of KNOWN_DOMAINS) {
      if (hostname.includes(entry.pattern.replace("www.", ""))) return { name: entry.name, url: entry.url };
    }
    const parts = hostname.split(".");
    const domain = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    return { name: domain.charAt(0).toUpperCase() + domain.slice(1), url: `https://${hostname}` };
  } catch { return null; }
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function CollapsibleSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-muted/30 hover:bg-muted/50 transition-colors text-sm font-medium"
      >
        {title}
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
}

function GenerateAudioButton({ loc, type, onDone }) {
  const [loading, setLoading] = useState(false);
  if (!loc?.location_id) return <p className="text-xs text-muted-foreground">Save location first to generate audio.</p>;
  const voiceField = type === "quick" ? loc.quick_story_voice : loc.deep_story_voice;
  if (!voiceField?.trim()) return <p className="text-xs text-muted-foreground">Add voice script first.</p>;
  const status = getAudioStatus(loc, type);
  const isRegen = status !== "Missing";
  const handle = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("generateLocationAudio", { locationId: loc.location_id, storyType: type });
      if (res?.data?.error) throw new Error(res.data.error);
      toast.success("Audio generated");
      onDone?.();
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || "Generation failed");
    }
    setLoading(false);
  };
  return (
    <button
      type="button"
      onClick={handle}
      disabled={loading}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
        isRegen ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-primary/10 text-primary hover:bg-primary/20"
      } disabled:opacity-50`}
    >
      {loading ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : isRegen ? <RefreshCw className="w-3 h-3" /> : <Headphones className="w-3 h-3" />}
      {isRegen ? "Re-generate" : "Generate"} {type === "quick" ? "Short" : "Long"} Audio
    </button>
  );
}

// ── Completion checker ────────────────────────────────────────────────────────
function getTabCompletion(form) {
  return {
    basic: !!(form.name && form.city && form.country && form.latitude && form.longitude),
    story: !!(form.quick_story?.trim() && form.quick_story_voice?.trim()),
    media: !!(form.image_url?.trim()),
    audio: !!(form.quick_audio_url?.trim()),
  };
}

function TabStatusDot({ complete, partial }) {
  if (complete) return <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />;
  if (partial)  return <AlertCircle className="w-3 h-3 text-amber-500 flex-shrink-0" />;
  return <Circle className="w-3 h-3 text-muted-foreground/30 flex-shrink-0" />;
}

// ── Validate Data ─────────────────────────────────────────────────────────────
function validateLocation(form) {
  const issues = [];
  const ok = (label) => ({ label, status: "ok" });
  const warn = (label, detail) => ({ label, status: "warn", detail });
  const fail = (label, detail) => ({ label, status: "fail", detail });

  // Core fields
  if (!form.name?.trim())    issues.push(fail("Name", "Missing"));
  else                       issues.push(ok("Name"));
  if (!form.city?.trim())    issues.push(fail("City", "Missing"));
  else                       issues.push(ok("City"));
  if (!form.country?.trim()) issues.push(fail("Country", "Missing"));
  else                       issues.push(ok("Country"));
  const lat = parseFloat(form.latitude), lng = parseFloat(form.longitude);
  if (!lat || !lng || isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0))
    issues.push(fail("Coordinates", "Missing or zero"));
  else
    issues.push(ok("Coordinates"));

  // Classification
  if (!form.place_type_code) issues.push(warn("Place Type Code", "Not set — will default to OTH"));
  else                       issues.push(ok("Place Type Code: " + form.place_type_code));
  if (!form.record_layer)    issues.push(warn("Record Layer", "Not set"));
  else                       issues.push(ok("Record Layer: " + form.record_layer));

  // Description
  if (!form.description?.trim() && !form.quick_story?.trim())
    issues.push(warn("Description / Story", "Both empty — card will show no text"));
  else if (!form.description?.trim())
    issues.push(warn("Description", "Empty — falling back to Short Story on user card"));
  else
    issues.push(ok("Description"));

  // Story
  if (!form.quick_story?.trim())       issues.push(warn("Short Story Display", "Missing"));
  else                                  issues.push(ok("Short Story Display"));
  if (!form.quick_story_voice?.trim()) issues.push(warn("Short Story Voice", "Missing — audio cannot be generated"));
  else                                  issues.push(ok("Short Story Voice"));

  // Media
  const mediaReq = form.media_requirement || "preferred";
  if (!form.image_url?.trim()) {
    if (mediaReq === "required") issues.push(fail("Image", "Required but missing"));
    else                         issues.push(warn("Image", "Missing"));
  } else {
    issues.push(ok("Image"));
  }

  // Audio
  const hasVoice = !!form.quick_story_voice?.trim();
  if (hasVoice && !form.quick_audio_url?.trim())
    issues.push(warn("Short Audio", "Voice script exists but audio not generated"));
  else if (form.quick_audio_url?.trim())
    issues.push(ok("Short Audio"));

  return issues;
}

function ValidatePanel({ form, onClose }) {
  const issues = validateLocation(form);
  const fails = issues.filter(i => i.status === "fail");
  const warns = issues.filter(i => i.status === "warn");
  const oks   = issues.filter(i => i.status === "ok");

  const overallStatus = fails.length > 0 ? "error" : warns.length > 0 ? "warn" : "ok";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-background rounded-t-2xl border-t border-border p-5 pb-8 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`w-5 h-5 ${overallStatus === "ok" ? "text-green-500" : overallStatus === "warn" ? "text-amber-500" : "text-red-500"}`} />
            <h3 className="text-sm font-bold">
              {overallStatus === "ok" ? "All checks passed" : overallStatus === "warn" ? `${warns.length} warning${warns.length !== 1 ? "s" : ""}` : `${fails.length} error${fails.length !== 1 ? "s" : ""}`}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        <div className="space-y-1.5">
          {fails.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600 mb-1.5">Errors</p>
              {fails.map((i, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-100">
                  <X className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-red-700">{i.label}</p>
                    {i.detail && <p className="text-[10px] text-red-600">{i.detail}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {warns.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 mb-1.5">Warnings</p>
              {warns.map((i, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 border border-amber-100">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700">{i.label}</p>
                    {i.detail && <p className="text-[10px] text-amber-600">{i.detail}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {oks.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Passing</p>
              {oks.map((i, idx) => (
                <div key={idx} className="flex items-center gap-2 py-1 px-2">
                  <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">{i.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Nearest Airport (auto-detect) ─────────────────────────────────────────────
function NearestAirportSection({ form, onAirportDetected }) {
  const [detecting, setDetecting] = useState(false);

  const { data: airports = [] } = useQuery({
    queryKey: ["airports-list"],
    queryFn: () => base44.entities.Airport.list("-created_date", 9999),
    staleTime: 5 * 60 * 1000,
  });

  const detect = useCallback(() => {
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (!lat || !lng || isNaN(lat) || isNaN(lng) || airports.length === 0) {
      toast.error("Set valid coordinates and ensure airports are loaded.");
      return;
    }
    setDetecting(true);
    let nearest = null, minDist = Infinity;
    for (const ap of airports) {
      if (!ap.latitude || !ap.longitude) continue;
      const d = haversineKm(lat, lng, ap.latitude, ap.longitude);
      if (d < minDist) { minDist = d; nearest = ap; }
    }
    setDetecting(false);
    if (!nearest) { toast.error("No airports found in the database."); return; }
    const dist = Math.round(minDist);
    onAirportDetected({
      nearest_airport_name: nearest.airport_name,
      nearest_airport_iata: nearest.airport_iata,
      nearest_airport_latitude: nearest.latitude,
      nearest_airport_longitude: nearest.longitude,
      airport_distance_km: dist,
    });
    toast.success(`Nearest airport: ${nearest.airport_name} (${dist} km)`);
  }, [form.latitude, form.longitude, airports, onAirportDetected]);

  const hasAirport = form.nearest_airport_name || form.nearest_airport_iata;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Auto-detected from coordinates. {airports.length} airports in database.</p>
        <button
          type="button"
          onClick={detect}
          disabled={detecting}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          {detecting ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Refresh nearest airport
        </button>
      </div>

      {hasAirport ? (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
          <Plane className="w-4 h-4 text-primary flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">{form.nearest_airport_name}</p>
            <p className="text-xs text-muted-foreground">
              {form.nearest_airport_iata && <span className="font-mono mr-2">{form.nearest_airport_iata}</span>}
              {form.airport_distance_km && <span>{form.airport_distance_km} km away</span>}
            </p>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-muted/30 border border-dashed border-border text-xs text-muted-foreground text-center">
          No airport detected yet — click "Refresh" after setting coordinates.
        </div>
      )}
    </div>
  );
}

// ── Main Editor ───────────────────────────────────────────────────────────────
export default function LocationEditor({ location, locations = [], onSave, onCancel, onDelete, onDuplicate }) {
  const [showUnsplash, setShowUnsplash] = useState(false);
  const [showValidate, setShowValidate] = useState(false);
  const [saving, setSaving] = useState(false);
  const prevQuickRef = useRef({ voice: location?.quick_story_voice || "" });
  const prevDeepRef  = useRef({ voice: location?.deep_story_voice  || "" });

  const initialForm = location || {
    location_id: "", name: "", city: "", country: "", description: "",
    category: "landmark", latitude: 0, longitude: 0,
    built_year: "", architect_creator: "", original_purpose: "",
    evolution_over_time: "", why_it_matters_today: "",
    image_url: "", image_source: "manual", image_source_name: "",
    image_source_url: "", image_photographer_name: "", image_photographer_url: "",
    mystery_teaser: "", quick_story: "", deep_story: "",
    quick_story_voice: "", deep_story_voice: "",
    quick_audio_url: "", deep_audio_url: "",
    quick_audio_outdated: false, deep_audio_outdated: false,
    fun_fact: "", look_closely_tip: "", best_photo_spot: "", nearby_recommendation: "",
    is_free: true, credit_cost: 0, has_story: false,
    opening_hours: "", crowd_timing: "", nearest_metro: "",
    safety_note: "", local_etiquette: "", accessibility_note: "",
    typical_visit_duration: "", coffee_price_example: "",
    status: "active",
    hotel_booking_link: "", flight_booking_link: "", attraction_booking_link: "",
    nearest_airport_name: "", nearest_airport_iata: "",
    nearest_airport_latitude: "", nearest_airport_longitude: "", airport_distance_km: "",
    parent_location_id: "",
  };

  const [form, setForm] = useState(initialForm);
  const [isDirty, setIsDirty] = useState(false);

  const update = (key, val) => {
    setForm(f => {
      const next = { ...f, [key]: val };
      if (key === "quick_story_voice" && f.quick_audio_url && val !== prevQuickRef.current.voice) next.quick_audio_outdated = true;
      if (key === "deep_story_voice"  && f.deep_audio_url  && val !== prevDeepRef.current.voice)  next.deep_audio_outdated  = true;
      return next;
    });
    setIsDirty(true);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setSaving(true);
    await onSave(form);
    setIsDirty(false);
    setSaving(false);
  };

  const handleHide = () => {
    const next = form.status === "archived" ? "active" : "archived";
    const updated = { ...form, status: next };
    setForm(updated);
    setIsDirty(true);
    toast.info(next === "archived" ? "Marked as archived. Save to apply." : "Restored to active. Save to apply.");
  };

  const handleDelete = () => {
    if (!confirm(`Delete "${form.name}"? This cannot be undone.`)) return;
    onDelete?.(location?.id);
  };

  const handleDuplicate = () => {
    onDuplicate?.(form);
  };

  const completion = getTabCompletion(form);
  const potentialParents = locations.filter(l => l.id !== location?.id && l.name);

  const TAB_LABELS = [
    { id: "basic",    label: "Basic",    complete: completion.basic },
    { id: "story",    label: "Story",    complete: completion.story },
    { id: "media",    label: "Media",    complete: completion.media },
    { id: "audio",    label: "Audio",    complete: completion.audio },
    { id: "advanced", label: "Advanced", complete: null },
  ];

  return (
    <div className="relative pb-44">
      {/* Back + title */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={onCancel}
          className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold leading-tight truncate">
            {location ? (form.name || "Edit Location") : "New Location"}
          </h2>
          {form.location_id && <p className="text-[10px] font-mono text-muted-foreground">{form.location_id}</p>}
        </div>
        {isDirty && (
          <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full flex-shrink-0">
            Unsaved
          </span>
        )}
      </div>

      <Card className="p-4">
        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="basic" className="w-full">
            {/* Tab list with completion dots */}
            <TabsList className="w-full flex flex-wrap h-auto gap-1 mb-5 bg-muted/40 p-1 rounded-xl">
              {TAB_LABELS.map(t => (
                <TabsTrigger key={t.id} value={t.id} className="flex-1 flex items-center justify-center gap-1.5 capitalize text-xs py-2">
                  {t.complete === true  && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                  {t.complete === false && <AlertCircle  className="w-3 h-3 text-amber-500" />}
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ── BASIC ── */}
            <TabsContent value="basic" className="space-y-5">
              <div>
                <Label className="text-xs text-muted-foreground">Location ID (auto-assigned)</Label>
                <Input value={form.location_id || "(will be assigned on save)"} readOnly className="font-mono bg-muted/40 text-muted-foreground cursor-default mt-1.5 text-xs" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Name *</Label>
                  <Input className="mt-1.5 h-11" value={form.name} onChange={e => update("name", e.target.value)} required />
                </div>
                <div>
                  <Label className="text-xs">City *</Label>
                  <Input className="mt-1.5 h-11" value={form.city} onChange={e => update("city", e.target.value)} required />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Country *</Label>
                  <Input className="mt-1.5 h-11" value={form.country} onChange={e => update("country", e.target.value)} required />
                </div>
                <div>
                  <Label className="text-xs">Category</Label>
                  <Select value={form.category} onValueChange={v => update("category", v)}>
                    <SelectTrigger className="mt-1.5 h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Latitude *</Label>
                  <Input className="mt-1.5 h-11" type="number" step="any" value={form.latitude} onChange={e => update("latitude", parseFloat(e.target.value))} required />
                </div>
                <div>
                  <Label className="text-xs">Longitude *</Label>
                  <Input className="mt-1.5 h-11" type="number" step="any" value={form.longitude} onChange={e => update("longitude", parseFloat(e.target.value))} required />
                </div>
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Textarea className="mt-1.5 min-h-[80px]" value={form.description} onChange={e => update("description", e.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={form.status} onValueChange={v => update("status", v)}>
                    <SelectTrigger className="mt-1.5 h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Parent Location (optional)</Label>
                  <Select value={form.parent_location_id || "none"} onValueChange={v => update("parent_location_id", v === "none" ? "" : v)}>
                    <SelectTrigger className="mt-1.5 h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {potentialParents.map(l => <SelectItem key={l.id} value={l.id}>{l.name} — {l.city}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-5 pt-1">
                <div className="flex items-center gap-2.5">
                  <Checkbox checked={form.is_free} onCheckedChange={c => update("is_free", c)} id="free" className="w-5 h-5" />
                  <Label htmlFor="free" className="text-sm">Free Entry</Label>
                </div>
                <div className="flex items-center gap-2.5">
                  <Checkbox checked={form.has_story} onCheckedChange={c => update("has_story", c)} id="story" className="w-5 h-5" />
                  <Label htmlFor="story" className="text-sm">Has Story</Label>
                </div>
              </div>
              {!form.is_free && (
                <div>
                  <Label className="text-xs">Credit Cost</Label>
                  <Input className="mt-1.5 h-11" type="number" value={form.credit_cost} onChange={e => update("credit_cost", parseInt(e.target.value))} />
                </div>
              )}
            </TabsContent>

            {/* ── STORY ── */}
            <TabsContent value="story" className="space-y-5">
              <div>
                <Label className="text-xs">Mystery Teaser</Label>
                <Textarea className="mt-1.5 min-h-[72px]" value={form.mystery_teaser} onChange={e => update("mystery_teaser", e.target.value)} placeholder="Enticing hook…" />
              </div>
              <div>
                <Label className="text-xs">Short Story — Display</Label>
                <Textarea className="mt-1.5 min-h-[120px]" value={form.quick_story} onChange={e => update("quick_story", e.target.value)} placeholder="Shown on screen (60-90s read)" />
              </div>
              <div>
                <Label className="text-xs">Short Story — Voice Script <span className="text-primary text-[10px]">(used for audio)</span></Label>
                <Textarea className="mt-1.5 min-h-[120px]" value={form.quick_story_voice || ""} onChange={e => update("quick_story_voice", e.target.value)} placeholder="TTS-optimised narration…" />
                {form.quick_audio_outdated && <p className="text-[10px] text-amber-600 mt-1.5">⚠ Audio outdated — re-generate needed</p>}
              </div>
              <div>
                <Label className="text-xs">Long Story — Display</Label>
                <Textarea className="mt-1.5 min-h-[160px]" value={form.deep_story} onChange={e => update("deep_story", e.target.value)} placeholder="Shown on screen (2-4 min read)" />
              </div>
              <div>
                <Label className="text-xs">Long Story — Voice Script <span className="text-primary text-[10px]">(used for audio)</span></Label>
                <Textarea className="mt-1.5 min-h-[160px]" value={form.deep_story_voice || ""} onChange={e => update("deep_story_voice", e.target.value)} placeholder="TTS-optimised narration…" />
                {form.deep_audio_outdated && <p className="text-[10px] text-amber-600 mt-1.5">⚠ Audio outdated — re-generate needed</p>}
              </div>
              <div>
                <Label className="text-xs">Fun Fact</Label>
                <Textarea className="mt-1.5 min-h-[72px]" value={form.fun_fact} onChange={e => update("fun_fact", e.target.value)} />
              </div>
            </TabsContent>

            {/* ── MEDIA ── */}
            <TabsContent value="media" className="space-y-4">
              <div className="space-y-4 p-4 bg-muted/30 rounded-xl border border-border">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Location Image</p>
                  <button
                    type="button"
                    onClick={() => setShowUnsplash(true)}
                    className="text-xs px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-muted-foreground flex items-center gap-1.5"
                  >
                    <Search className="w-3.5 h-3.5" /> Search Unsplash
                  </button>
                </div>
                {form.image_url ? (
                  <div className="flex gap-4 items-start">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Thumbnail</p>
                      <img src={form.image_url} alt="" className="w-20 h-20 object-cover rounded-xl border border-border" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Card (4:5)</p>
                      <img src={form.image_url} alt="" className="w-16 h-20 object-cover rounded-xl border border-border" />
                    </div>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center border border-border">
                    <span className="text-[10px] text-muted-foreground">No image</span>
                  </div>
                )}
                <div>
                  <Label className="text-xs">Image URL</Label>
                  <Input
                    className="mt-1.5 text-xs h-10"
                    value={form.image_url || ""}
                    onChange={e => {
                      const url = e.target.value;
                      update("image_url", url);
                      update("image_source", "manual");
                      if (url && !form.image_source_name) {
                        const d = detectSourceFromUrl(url);
                        if (d) { update("image_source_name", d.name); update("image_source_url", d.url); }
                      }
                    }}
                    placeholder="https://…"
                  />
                </div>
                <span className={`text-[10px] px-2 py-1 rounded font-medium ${form.image_source === "unsplash" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {form.image_source === "unsplash" ? "Unsplash" : "Manual"}
                </span>
                {form.image_source === "unsplash" ? (
                  <p className="text-[10px] text-muted-foreground">
                    {form.image_photographer_name && <>Photo by <strong>{form.image_photographer_name}</strong> on Unsplash</>}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Source Name</Label>
                      <Input className="mt-1 h-9 text-xs" value={form.image_source_name || ""} onChange={e => update("image_source_name", e.target.value)} placeholder="e.g. Qatar Museums" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Source URL</Label>
                      <Input className="mt-1 h-9 text-xs" value={form.image_source_url || ""} onChange={e => update("image_source_url", e.target.value)} placeholder="https://…" />
                    </div>
                  </div>
                )}
              </div>
              {showUnsplash && (
                <UnsplashImagePicker
                  locationName={form.name} city={form.city} country={form.country}
                  onSelect={data => {
                    update("image_url", data.image_url);
                    update("image_source", data.image_source);
                    update("image_photographer_name", data.image_photographer_name);
                    update("image_photographer_url", data.image_photographer_url);
                    update("unsplash_photo_id", data.unsplash_photo_id || "");
                    update("image_source_name", "");
                    update("image_source_url", "");
                  }}
                  onClose={() => setShowUnsplash(false)}
                />
              )}
            </TabsContent>

            {/* ── AUDIO ── */}
            <TabsContent value="audio" className="space-y-5">
              <p className="text-xs text-muted-foreground">Audio is generated from the voice scripts on the Story tab.</p>
              <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Short Audio</p>
                  {form.quick_audio_outdated && <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">Outdated</span>}
                </div>
                {form.quick_audio_url && <audio controls src={form.quick_audio_url} className="w-full h-10" />}
                <div>
                  <Label className="text-xs">Audio URL (auto-set)</Label>
                  <Input className="mt-1.5 text-xs h-10" value={form.quick_audio_url || ""} onChange={e => update("quick_audio_url", e.target.value)} placeholder="https://…" />
                </div>
                <GenerateAudioButton loc={location} type="quick" onDone={() => {}} />
              </div>
              <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Long Audio</p>
                  {form.deep_audio_outdated && <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">Outdated</span>}
                </div>
                {form.deep_audio_url && <audio controls src={form.deep_audio_url} className="w-full h-10" />}
                <div>
                  <Label className="text-xs">Audio URL (auto-set)</Label>
                  <Input className="mt-1.5 text-xs h-10" value={form.deep_audio_url || ""} onChange={e => update("deep_audio_url", e.target.value)} placeholder="https://…" />
                </div>
                <GenerateAudioButton loc={location} type="deep" onDone={() => {}} />
              </div>
            </TabsContent>

            {/* ── ADVANCED ── */}
            <TabsContent value="advanced" className="space-y-3">
              <p className="text-xs text-muted-foreground">All optional. Expand sections as needed.</p>

              <CollapsibleSection title="Historical Details">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Built Year</Label><Input className="mt-1.5 h-11" value={form.built_year} onChange={e => update("built_year", e.target.value)} placeholder="e.g. 1889" /></div>
                  <div><Label className="text-xs">Architect / Creator</Label><Input className="mt-1.5 h-11" value={form.architect_creator} onChange={e => update("architect_creator", e.target.value)} /></div>
                </div>
                <div><Label className="text-xs">Original Purpose</Label><Textarea className="mt-1.5 min-h-[72px]" value={form.original_purpose} onChange={e => update("original_purpose", e.target.value)} /></div>
                <div><Label className="text-xs">Evolution Over Time</Label><Textarea className="mt-1.5 min-h-[72px]" value={form.evolution_over_time} onChange={e => update("evolution_over_time", e.target.value)} /></div>
                <div><Label className="text-xs">Why It Matters Today</Label><Textarea className="mt-1.5 min-h-[72px]" value={form.why_it_matters_today} onChange={e => update("why_it_matters_today", e.target.value)} /></div>
              </CollapsibleSection>

              <CollapsibleSection title="Tips & Suggestions">
                <div><Label className="text-xs">Look Closely Tip</Label><Textarea className="mt-1.5 min-h-[72px]" value={form.look_closely_tip} onChange={e => update("look_closely_tip", e.target.value)} /></div>
                <div><Label className="text-xs">Best Photo Spot</Label><Input className="mt-1.5 h-11" value={form.best_photo_spot} onChange={e => update("best_photo_spot", e.target.value)} /></div>
                <div><Label className="text-xs">Nearby Recommendation</Label><Input className="mt-1.5 h-11" value={form.nearby_recommendation} onChange={e => update("nearby_recommendation", e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Opening Hours</Label><Input className="mt-1.5 h-11" value={form.opening_hours} onChange={e => update("opening_hours", e.target.value)} placeholder="9am–5pm" /></div>
                  <div><Label className="text-xs">Visit Duration</Label><Input className="mt-1.5 h-11" value={form.typical_visit_duration} onChange={e => update("typical_visit_duration", e.target.value)} placeholder="30 min" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Nearest Metro</Label><Input className="mt-1.5 h-11" value={form.nearest_metro} onChange={e => update("nearest_metro", e.target.value)} /></div>
                  <div><Label className="text-xs">Safety Note</Label><Input className="mt-1.5 h-11" value={form.safety_note} onChange={e => update("safety_note", e.target.value)} /></div>
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="Booking Links">
                <p className="text-[10px] text-muted-foreground">Override global defaults for this location.</p>
                <div><Label className="text-xs">Hotel Booking Link</Label><Input className="mt-1.5 h-11" value={form.hotel_booking_link || ""} onChange={e => update("hotel_booking_link", e.target.value)} placeholder="https://…" /></div>
                <div><Label className="text-xs">Flight Booking Link</Label><Input className="mt-1.5 h-11" value={form.flight_booking_link || ""} onChange={e => update("flight_booking_link", e.target.value)} placeholder="https://…" /></div>
                <div><Label className="text-xs">Attraction / Tour Booking Link</Label><Input className="mt-1.5 h-11" value={form.attraction_booking_link || ""} onChange={e => update("attraction_booking_link", e.target.value)} placeholder="https://…" /></div>
              </CollapsibleSection>

              <CollapsibleSection title="🗂 Classification" defaultOpen>
                <p className="text-[11px] text-muted-foreground -mt-1">Controls engine layer, scoring, media & story generation.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Record Layer</Label>
                    <Select value={form.record_layer || "journey"} onValueChange={v => update("record_layer", v)}>
                      <SelectTrigger className="mt-1.5 h-10 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="journey">journey</SelectItem>
                        <SelectItem value="service">service</SelectItem>
                        <SelectItem value="hospitality">hospitality</SelectItem>
                        <SelectItem value="utility">utility</SelectItem>
                        <SelectItem value="transit">transit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Experience Class</Label>
                    <Select value={form.experience_class || "standard"} onValueChange={v => update("experience_class", v)}>
                      <SelectTrigger className="mt-1.5 h-10 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hero">hero</SelectItem>
                        <SelectItem value="standard">standard</SelectItem>
                        <SelectItem value="support">support</SelectItem>
                        <SelectItem value="functional">functional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Place Type Code</Label>
                  <Select value={form.place_type_code || ""} onValueChange={v => update("place_type_code", v)}>
                    <SelectTrigger className="mt-1.5 h-10 text-xs"><SelectValue placeholder="Select type…" /></SelectTrigger>
                    <SelectContent>
                      {PLACE_TYPE_CODES.map(t => <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-1">Used in new location IDs: TP_QAT_DOH_<strong>{form.place_type_code || "OTH"}</strong>_000001</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Media</Label>
                    <Select value={form.media_requirement || "preferred"} onValueChange={v => update("media_requirement", v)}>
                      <SelectTrigger className="mt-1.5 h-10 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="required">required</SelectItem>
                        <SelectItem value="preferred">preferred</SelectItem>
                        <SelectItem value="optional">optional</SelectItem>
                        <SelectItem value="none">none</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Story</Label>
                    <Select value={form.story_requirement || "light"} onValueChange={v => update("story_requirement", v)}>
                      <SelectTrigger className="mt-1.5 h-10 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">full</SelectItem>
                        <SelectItem value="light">light</SelectItem>
                        <SelectItem value="none">none</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Audio</Label>
                    <Select value={form.audio_requirement || "light"} onValueChange={v => update("audio_requirement", v)}>
                      <SelectTrigger className="mt-1.5 h-10 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">full</SelectItem>
                        <SelectItem value="light">light</SelectItem>
                        <SelectItem value="none">none</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="✈️ Nearest Airport (auto-detected)">
                <NearestAirportSection
                  form={form}
                  onAirportDetected={(airportData) => {
                    Object.entries(airportData).forEach(([k, v]) => update(k, v));
                  }}
                />
              </CollapsibleSection>
            </TabsContent>
          </Tabs>
        </form>
      </Card>

      {showValidate && <ValidatePanel form={form} onClose={() => setShowValidate(false)} />}

      {/* ── Sticky action bar ── */}
      <div className="fixed bottom-16 left-0 right-0 z-[60] bg-background/95 backdrop-blur-sm border-t border-border px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 h-11 bg-primary hover:bg-primary/90 font-semibold"
          >
            {saving
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><Save className="w-4 h-4 mr-1.5" /> {isDirty ? "Save changes" : "Save"}</>
            }
          </Button>
          <button
            type="button"
            onClick={() => setShowValidate(true)}
            title="Validate Data"
            className="w-11 h-11 rounded-xl border border-border bg-background hover:bg-muted flex items-center justify-center transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={handleHide}
            title={form.status === "archived" ? "Restore" : "Archive / Hide"}
            className="w-11 h-11 rounded-xl border border-border bg-background hover:bg-muted flex items-center justify-center transition-colors"
          >
            <EyeOff className="w-4 h-4 text-muted-foreground" />
          </button>
          {onDuplicate && (
            <button
              type="button"
              onClick={handleDuplicate}
              title="Duplicate"
              className="w-11 h-11 rounded-xl border border-border bg-background hover:bg-muted flex items-center justify-center transition-colors"
            >
              <Copy className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          {onDelete && location?.id && (
            <button
              type="button"
              onClick={handleDelete}
              title="Delete"
              className="w-11 h-11 rounded-xl border border-red-100 bg-background hover:bg-red-50 flex items-center justify-center transition-colors"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}