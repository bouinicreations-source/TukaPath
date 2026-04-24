import React, { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from '@/api/supabase';
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { base44 } from "@/api/client";
import { Button } from "@/components/ui/button";
import { X, MapPin, LocateFixed, ChevronDown, ChevronUp, Upload, Image, CheckCircle2, Search, Plus } from "lucide-react";
import UnsplashImagePicker from "@/components/admin/UnsplashImagePicker";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const HIGHLIGHTS = [
  { id: "views", label: "🌄 Views" },
  { id: "quiet", label: "🤫 Quiet" },
  { id: "architecture", label: "🏛 Architecture" },
  { id: "history", label: "📜 History" },
  { id: "photo_spot", label: "📸 Photo Spot" },
  { id: "hidden_gem", label: "💎 Hidden Gem" },
  { id: "local_life", label: "🧭 Local Life" },
  { id: "free_entry", label: "✅ Free Entry" },
];

function DraggableMarker({ position, onMove }) {
  const markerRef = useRef(null);
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    marker.on("dragend", () => {
      const { lat, lng } = marker.getLatLng();
      onMove({ lat, lng });
    });
  }, [onMove]);
  return <Marker position={[position.lat, position.lng]} draggable ref={markerRef} />;
}

function MapTapHandler({ onTap }) {
  useMapEvents({ click: (e) => onTap({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
    const data = await res.json();
    const a = data.address || {};
    return {
      city: a.city || a.town || a.village || a.county || "",
      country: a.country || "",
    };
  } catch {
    return { city: "", country: "" };
  }
}

async function geocodeSearch(query) {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=4`);
  return res.json();
}

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function LocationSection({ pin, geo, onPinChange, onGeoChange }) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [geocoding, setGeocoding] = useState(false);

  const defaultPos = pin || { lat: 25.2854, lng: 51.531 };

  const handleGPS = () => {
    navigator.geolocation?.getCurrentPosition(async (pos) => {
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      onPinChange(p);
      setGeocoding(true);
      const g = await reverseGeocode(p.lat, p.lng);
      onGeoChange(g);
      setGeocoding(false);
      setOpen(true);
    });
  };

  const handlePinMove = useCallback(async (p) => {
    onPinChange(p);
    const g = await reverseGeocode(p.lat, p.lng);
    onGeoChange(g);
  }, [onPinChange, onGeoChange]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    const results = await geocodeSearch(searchQuery);
    setSearchResults(results);
  };

  const handleSearchSelect = async (r) => {
    const p = { lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
    onPinChange(p);
    const g = await reverseGeocode(p.lat, p.lon);
    onGeoChange({ city: g.city, country: g.country });
    setSearchResults([]);
    setSearchQuery("");
    setOpen(true);
  };

  const hasPin = !!pin;
  const label = hasPin
    ? (geo.city ? `${geo.city}${geo.country ? `, ${geo.country}` : ""}` : `${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`)
    : "Set location";

  return (
    <div className="space-y-3">
      {/* Location trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${
          hasPin
            ? "border-primary/30 bg-primary/5"
            : "border-dashed border-border hover:border-primary/40 bg-muted/30"
        }`}
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${hasPin ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          <MapPin className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${hasPin ? "text-foreground" : "text-muted-foreground"}`}>{label}</p>
          {hasPin && <p className="text-[11px] text-primary/70">Tap to adjust pin</p>}
          {!hasPin && <p className="text-[11px] text-muted-foreground/70">Tap to set on map</p>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-1">
              {/* GPS + Search row */}
              <div className="flex gap-2">
                <button
                  onClick={handleGPS}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
                >
                  <LocateFixed className="w-3.5 h-3.5" />
                  {geocoding ? "Detecting…" : "Use my location"}
                </button>
              </div>

              {/* Search */}
              <div className="flex gap-2">
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSearch(); }}
                  placeholder="Search for a place or address…"
                  className="flex-1 bg-muted/60 rounded-xl px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 ring-primary/20"
                />
                <button onClick={handleSearch} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/80">
                  <Search className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                  {searchResults.map((r, i) => (
                    <button key={i} onClick={() => handleSearchSelect(r)}
                      className="w-full text-left px-3 py-2.5 text-xs hover:bg-muted transition-colors border-b border-border last:border-0 line-clamp-1">
                      {r.display_name}
                    </button>
                  ))}
                </div>
              )}

              {/* Mini map */}
              <div className="rounded-2xl overflow-hidden border border-border shadow-sm" style={{ height: 200 }}>
                <MapContainer
                  center={[defaultPos.lat, defaultPos.lng]}
                  zoom={15}
                  className="h-full w-full"
                  zoomControl={false}
                  key={`${defaultPos.lat}-${defaultPos.lng}`}
                >
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                  <MapTapHandler onTap={handlePinMove} />
                  <DraggableMarker position={defaultPos} onMove={handlePinMove} />
                </MapContainer>
              </div>
              {hasPin && (
                <p className="text-[11px] text-center text-primary font-medium">📍 You're here — perfect</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function OptionalDetails({ data, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        {open ? "Hide optional details" : "Add optional details (year, best time, entry)"}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-3 pt-3">
              <div>
                <label className="text-[11px] text-muted-foreground font-medium block mb-1">Built year</label>
                <input
                  value={data.built_year || ""}
                  onChange={e => onChange("built_year", e.target.value)}
                  placeholder="e.g. 1910"
                  className="w-full bg-muted/60 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground font-medium block mb-1">Best time to visit</label>
                <input
                  value={data.crowd_timing || ""}
                  onChange={e => onChange("crowd_timing", e.target.value)}
                  placeholder="e.g. Early morning"
                  className="w-full bg-muted/60 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] text-muted-foreground font-medium block mb-1">Entry type</label>
                <div className="flex gap-2">
                  {["Free", "Paid", "Unknown"].map(opt => (
                    <button key={opt}
                      onClick={() => onChange("is_free", opt === "Free" ? true : opt === "Paid" ? false : null)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                        (opt === "Free" && data.is_free === true) || (opt === "Paid" && data.is_free === false)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function SuggestPlaceFlow({ onClose }) {
  const [pin, setPin] = useState(null);
  const [geo, setGeo] = useState({ city: "", country: "" });
  const [name, setName] = useState("");
  const [story, setStory] = useState("");
  const [highlights, setHighlights] = useState([]);
  const [imageUrl, setImageUrl] = useState(null);
  const [imageSourceType, setImageSourceType] = useState(null);
  const [imageConsent, setImageConsent] = useState(false);
  const [unsplashMeta, setUnsplashMeta] = useState({});
  const [extras, setExtras] = useState({});
  const [showUnsplash, setShowUnsplash] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef(null);
  const textareaRef = useRef(null);

  const changeExtra = (k, v) => setExtras(prev => ({ ...prev, [k]: v }));

  const toggleHighlight = (id) => {
    setHighlights(prev => prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id]);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setImageUrl(file_url);
    setImageSourceType("user_upload");
    setImageConsent(false);
    setUploading(false);
  };

  const handleUnsplashSelect = (img) => {
    setImageUrl(img.image_url);
    setImageSourceType("unsplash");
    setImageConsent(true);
    setUnsplashMeta({
      unsplash_photo_id: img.unsplash_photo_id,
      unsplash_photographer_name: img.image_photographer_name,
      unsplash_photographer_url: img.image_photographer_url,
    });
    setShowUnsplash(false);
  };

  const clearImage = () => {
    setImageUrl(null);
    setImageSourceType(null);
    setImageConsent(false);
    setUnsplashMeta({});
  };

  // Auto-resize textarea
  const handleStoryChange = (e) => {
    setStory(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const canSubmit = pin && name.trim() && (!imageUrl || imageSourceType === "unsplash" || imageConsent);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    let user = null;
    try { user = await supabase.auth.getUser().then(r => r.data.user); } catch {}
    await base44.entities.LocationSuggestion.create({
      suggested_name: name.trim(),
      suggested_description: story.trim() || null,
      category: highlights[0] || null,
      latitude: pin.lat,
      longitude: pin.lng,
      map_confirmed: true,
      city: geo.city,
      country: geo.country,
      image_url: imageUrl || null,
      image_source_type: imageSourceType || null,
      image_consent_approved: !!imageConsent,
      ...unsplashMeta,
      submitted_by_user_id: user?.id || null,
      submitted_by_email: user?.email || null,
      status: "pending",
    });
    setSubmitting(false);
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        className="bg-background w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl flex flex-col overflow-hidden shadow-2xl"
        style={{ maxHeight: "94dvh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 bg-muted-foreground/25 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0">
          <p className="text-base font-bold">Share a place</p>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-32">
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <div>
                  <p className="text-lg font-bold">You're amazing! 🙌</p>
                  <p className="text-sm text-muted-foreground mt-1.5">
                    <strong>{name}</strong> has been submitted for review.<br />We'll add it to the map soon.
                  </p>
                </div>
                <Button className="mt-2 rounded-xl px-6" onClick={onClose}>Done</Button>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 py-2">

                {/* 1. Location */}
                <LocationSection
                  pin={pin}
                  geo={geo}
                  onPinChange={setPin}
                  onGeoChange={setGeo}
                />

                {/* 2. Place Name */}
                <div>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Name this place…"
                    className="w-full bg-transparent text-xl font-bold placeholder:text-muted-foreground/50 outline-none border-b-2 border-border focus:border-primary pb-2 transition-colors"
                  />
                </div>

                {/* 3. Story */}
                <div className={`rounded-2xl border-2 transition-colors px-4 py-3 ${story ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30"}`}>
                  <textarea
                    ref={textareaRef}
                    value={story}
                    onChange={handleStoryChange}
                    placeholder="Why is this place worth visiting? Share what makes it special…"
                    rows={3}
                    className="w-full bg-transparent text-sm placeholder:text-muted-foreground/60 outline-none resize-none leading-relaxed"
                    style={{ minHeight: 72 }}
                  />
                </div>

                {/* 4. Highlights */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">What's great here?</p>
                  <div className="flex flex-wrap gap-2">
                    {HIGHLIGHTS.map(h => (
                      <button
                        key={h.id}
                        onClick={() => toggleHighlight(h.id)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                          highlights.includes(h.id)
                            ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
                            : "bg-card border-border text-muted-foreground hover:border-primary/40 hover:bg-primary/5"
                        }`}
                      >
                        {h.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Photo */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Photo</p>
                  {!imageUrl ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        className="flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all"
                      >
                        <Upload className="w-5 h-5 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">{uploading ? "Uploading…" : "Upload photo"}</span>
                      </button>
                      <button
                        onClick={() => setShowUnsplash(true)}
                        className="flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all"
                      >
                        <Image className="w-5 h-5 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Search Unsplash</span>
                      </button>
                    </div>
                  ) : (
                    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="relative rounded-2xl overflow-hidden">
                      <img src={imageUrl} alt="Preview" className="w-full h-44 object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                      <button
                        onClick={clearImage}
                        className="absolute top-2.5 right-2.5 w-7 h-7 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center"
                      >
                        <X className="w-3.5 h-3.5 text-white" />
                      </button>
                      {imageSourceType === "unsplash" && unsplashMeta.unsplash_photographer_name && (
                        <p className="absolute bottom-2 left-3 text-[10px] text-white/70">
                          📷 {unsplashMeta.unsplash_photographer_name} / Unsplash
                        </p>
                      )}
                    </motion.div>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                </div>

                {/* 6. Image consent */}
                <AnimatePresence>
                  {imageUrl && imageSourceType === "user_upload" && (
                    <motion.label
                      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={!!imageConsent}
                        onChange={e => setImageConsent(e.target.checked)}
                        className="mt-0.5 flex-shrink-0 accent-primary"
                      />
                      <span className="text-xs text-amber-800 leading-relaxed">
                        I confirm this photo is mine and I allow TukaPath to use it.
                      </span>
                    </motion.label>
                  )}
                </AnimatePresence>

                {/* 7. Optional details */}
                <OptionalDetails data={extras} onChange={changeExtra} />

              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sticky submit */}
        {!done && (
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-6 pt-3 bg-gradient-to-t from-background via-background/95 to-transparent">
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="w-full h-12 rounded-2xl text-base font-semibold shadow-lg"
            >
              {submitting ? "Sharing…" : "Share this place ✨"}
            </Button>
            {!pin && (
              <p className="text-center text-[11px] text-muted-foreground mt-2">Set a location to continue</p>
            )}
          </div>
        )}
      </motion.div>

      {showUnsplash && (
        <UnsplashImagePicker
          locationName={name || ""}
          city={geo.city || ""}
          country={geo.country || ""}
          onSelect={handleUnsplashSelect}
          onClose={() => setShowUnsplash(false)}
        />
      )}
    </div>
  );
}