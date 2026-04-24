import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from '@/api/supabase';
import PullToRefresh from "@/components/PullToRefresh";
import { base44 } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, useMap, CircleMarker, useMapEvents } from "react-leaflet";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LocateFixed, Shuffle, Search, MapPin, Headphones, X, Map, LayoutGrid, Heart, ChevronUp, Clock, Play, Lock, TrendingUp } from "lucide-react";
import LocationPermissionPrompt from "@/components/LocationPermissionPrompt";
import ExploreGrid from "@/components/stories/ExploreGrid";
import { motion, AnimatePresence } from "framer-motion";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useAuth } from "@/components/AuthContext";
import GuestSignupModal from "@/components/GuestSignupModal";
import GuestUpgradeOverlay from "@/components/GuestUpgradeOverlay";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Minimal push-pin: circle head + thin needle
function makePin(color = "#ef4444", scale = 1, pulse = false) {
  const r = Math.round(5 * scale);   // circle radius
  const w = r * 2;
  const h = Math.round(14 * scale);  // total height (circle + needle)
  const needleW = Math.round(1.5 * scale);
  return new L.DivIcon({
    className: "",
    html: `<div style="position:relative;width:${w}px;height:${h}px">${pulse ? `<div style="position:absolute;top:0;left:0;width:${w}px;height:${w}px;border-radius:50%;background:${color};opacity:0.25;animation:ping 1.2s cubic-bezier(0,0,0.2,1) infinite"></div>` : ""}<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="${r}" cy="${r}" r="${r}" fill="${color}"/><polygon points="${r - needleW/2},${r + r * 0.5} ${r + needleW/2},${r + r * 0.5} ${r},${h}" fill="#5a6a7a"/></svg></div>`,
    iconSize: [w, h],
    iconAnchor: [r, h],
    popupAnchor: [0, -h],
  });
}

const PIN_RED = makePin("#ef4444");
const PIN_GRAY = makePin("#94a3b8");
const PIN_ACTIVE = makePin("#ef4444", 1.4, true);

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(m) {
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
}

function walkMinutes(m) {
  return Math.max(1, Math.round(m / 80));
}

function RecenterMap({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.flyTo([lat, lng], 15, { duration: 1.2 });
  }, [lat, lng, map]);
  return null;
}

// Closes pin preview when map is tapped
function MapClickHandler({ onMapClick }) {
  useMapEvents({ click: onMapClick });
  return null;
}

const INTEREST_CATEGORY_MAP = {
  history: ["monument", "museum", "landmark", "religious"],
  architecture: ["landmark", "bridge", "tower"],
  hidden_spots: ["hidden_spot"],
  food: ["other"],
  nature: ["park", "other"],
  art: ["museum", "other"],
  local_culture: ["square", "religious", "market"],
};

const DEFAULT_POS = { lat: 25.2854, lng: 51.5310 }; // Doha fallback

function calcHeroScore(loc, distanceM) {
  const maxDist = 5000;
  const hasImage = loc.image_url ? 1 : 0;
  const hasStory = (loc.quick_story || loc.mystery_teaser) ? 1 : 0;
  const hasAudio = (loc.quick_audio_url || loc.deep_audio_url) ? 1 : 0;
  const contentScore = (hasImage + hasStory + hasAudio) / 3;

  const rating = loc.avg_place_rating || 0;
  const listens = Math.min(loc.total_listens || 0, 200);
  const reviewScore = (rating / 5) * 0.7 + (listens / 200) * 0.3;

  const distScore = Math.max(0, 1 - distanceM / maxDist);

  const hasReviewData = rating > 0 || (loc.total_listens || 0) > 0;
  if (hasReviewData) {
    return reviewScore * 0.45 + distScore * 0.35 + contentScore * 0.20;
  } else {
    return distScore * 0.50 + contentScore * 0.50;
  }
}

export default function NearbyStories() {
  const [userPos, setUserPos] = useState(null);
  const [userPrefs, setUserPrefs] = useState(null);
  const [recenter, setRecenter] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [filter, setFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState("map");
  const [activePin, setActivePin] = useState(null); // location object
  const [sessionSeen, setSessionSeen] = useState(new Set()); // gray after tap
  const [activeCategory, setActiveCategory] = useState("all");
  const sheetRef = useRef(null);
  const dragStartY = useRef(0);
  const SHEET_COLLAPSED = 200; // px visible when collapsed
  const [sheetHeight, setSheetHeight] = useState(SHEET_COLLAPSED);
  const [isDragging, setIsDragging] = useState(false);

  const snapSheet = useCallback((targetExpanded) => {
    const vh = window.innerHeight;
    setSheetHeight(targetExpanded ? vh * 0.72 : SHEET_COLLAPSED);
  }, []);

  const sheetExpanded = sheetHeight > SHEET_COLLAPSED + 40;
  const [helperDismissed, setHelperDismissed] = useState(() => sessionStorage.getItem("tp_helper") === "1");
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [showGuestUpgrade, setShowGuestUpgrade] = useState(false);
  // Track first location clicked by guest
  const [guestFirstSeen, setGuestFirstSeen] = useState(null);
  const queryClient = useQueryClient();
  const { isGuest } = useAuth();

  const [locationPromptDone, setLocationPromptDone] = useState(() =>
    localStorage.getItem("tukapath_location_prompted") === "true"
  );

  const geocodeCity = async (query) => {
    if (!query.trim()) return;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`);
    const data = await res.json();
    if (data[0]) setRecenter({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
  };

  const { data: locations = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: () => base44.entities.Location.filter({ status: "active" }),
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ["favorites"],
    queryFn: () => base44.entities.Favorite.list(),
  });

  const requestLocation = () => {
    localStorage.setItem("tukapath_location_prompted", "true");
    setLocationPromptDone(true);
  };

  const denyLocation = () => {
    localStorage.setItem("tukapath_location_prompted", "true");
    setLocationPromptDone(true);
    setUserPos(DEFAULT_POS);
  };

  useEffect(() => {
    if (!locationPromptDone) return;
    // Hard fallback after 4s — ensures we never get stuck on spinner
    const hardFallback = setTimeout(() => setUserPos(prev => prev || DEFAULT_POS), 4000);

    const setFromIp = () =>
      fetch("https://ipapi.co/json/")
        .then(r => r.json())
        .then(d => setUserPos(prev => prev || { lat: d.latitude || DEFAULT_POS.lat, lng: d.longitude || DEFAULT_POS.lng }))
        .catch(() => setUserPos(prev => prev || DEFAULT_POS));

    navigator.geolocation?.getCurrentPosition(
      (pos) => { clearTimeout(hardFallback); setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      () => { setFromIp(); }
    );
    if (!navigator.geolocation) setFromIp();
    return () => clearTimeout(hardFallback);
  }, [locationPromptDone]);

  useEffect(() => {
    supabase.auth.getUser().then(r => r.data.user).then(u => { if (u) setUserPrefs(u); }).catch(() => {});
  }, []);

  // Nearby notifications
  useEffect(() => {
    if (!userPos || !userPrefs?.notify_nearby || !userPrefs?.location_access_enabled) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const check = () => {
      const nearby = locations.filter(loc => {
        const dist = getDistance(userPos.lat, userPos.lng, loc.latitude, loc.longitude);
        if (dist > 300 || !loc.has_story) return false;
        if (userPrefs.notify_interests && userPrefs.interests?.length > 0) {
          const cats = userPrefs.interests.flatMap(i => INTEREST_CATEGORY_MAP[i] || []);
          return cats.includes(loc.category);
        }
        return true;
      });
      if (nearby.length > 0) new Notification("TukaPath 📍", { body: `You're near ${nearby[0].name}`, icon: "/favicon.ico" });
    };
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [userPos, locations, userPrefs]);

  const isFavorite = (locId) => favorites.some(f => f.item_id === locId);

  const toggleFavorite = async (e, loc) => {
    e.stopPropagation();
    if (isGuest) { setShowGuestModal(true); return; }
    const existing = favorites.find(f => f.item_id === loc.id);
    if (existing) {
      await base44.entities.Favorite.delete(existing.id);
    } else {
      await base44.entities.Favorite.create({ item_type: "location", item_id: loc.id, item_name: loc.name, city: loc.city });
    }
    queryClient.invalidateQueries({ queryKey: ["favorites"] });
  };

  const filteredLocations = locations.filter((loc) => {
    const matchSearch = !searchQuery || loc.name?.toLowerCase().includes(searchQuery.toLowerCase()) || loc.city?.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchSearch) return false;
    if (filter === "stories") return loc.has_story;
    if (filter === "landmarks") return ["landmark", "monument", "statue", "tower", "bridge"].includes(loc.category);
    if (filter === "hidden") return loc.category === "hidden_spot";
    if (filter === "food") return loc.food_spots?.length > 0;
    return true;
  });

  const sortedLocations = userPos
    ? [...filteredLocations].sort((a, b) =>
        getDistance(userPos.lat, userPos.lng, a.latitude, a.longitude) -
        getDistance(userPos.lat, userPos.lng, b.latitude, b.longitude)
      )
    : filteredLocations;

  const handlePinClick = (loc) => {
    if (isGuest && guestFirstSeen && guestFirstSeen !== loc.id) {
      setShowGuestUpgrade(true);
      return;
    }
    setActivePin(loc);
    setSessionSeen(prev => new Set([...prev, loc.id]));
    setHelperDismissed(true);
    sessionStorage.setItem("tp_helper", "1");
    snapSheet(false);
    setRecenter({ lat: loc.latitude, lng: loc.longitude });
  };

  const dismissHelper = () => {
    setHelperDismissed(true);
    sessionStorage.setItem("tp_helper", "1");
  };

  if (!locationPromptDone) return <LocationPermissionPrompt onAllow={requestLocation} onDeny={denyLocation} />;

  if (!userPos) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-3">
            <div className="absolute inset-0 rounded-full border-4 border-muted" />
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-xs text-muted-foreground">Finding your location...</p>
        </div>
      </div>
    );
  }

  // Recently viewed: locations user tapped this session
  const recentlyViewed = [...sessionSeen]
    .map(id => locations.find(l => l.id === id))
    .filter(Boolean)
    .reverse()
    .slice(0, 8);

  const CHIPS = [
    { id: "all", label: "All" },
    { id: "nearby", label: "Nearby" },
    { id: "hidden", label: "Hidden gems" },
    { id: "audio", label: "Quick stops" },
    { id: "top", label: "Top rated" },
  ];

  const sheetLocations = sortedLocations.filter(loc => {
    if (activeCategory === "nearby") return userPos && getDistance(userPos.lat, userPos.lng, loc.latitude, loc.longitude) < 2000;
    if (activeCategory === "hidden") return loc.category === "hidden_spot";
    if (activeCategory === "audio") return !!(loc.quick_audio_url || loc.deep_audio_url);
    if (activeCategory === "top") return loc.total_listens > 10 || loc.avg_place_rating >= 4;
    return true;
  });

  if (viewMode === "explore") {
    return (
      <div className="flex flex-col" style={{ height: "calc(100vh - 5rem)" }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <div className="flex-1 flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
            <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search places or cities…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {searchQuery && <button onClick={() => setSearchQuery("")}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>}
          </div>
          <div className="flex items-center bg-muted rounded-xl p-1 shrink-0">
            <button onClick={() => setViewMode("map")} className="px-2.5 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground">
              <Map className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setViewMode("explore")} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-card shadow text-foreground">
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <PullToRefresh className="flex-1" onRefresh={() => queryClient.invalidateQueries({ queryKey: ["locations"] })}>
          <ExploreGrid locations={sortedLocations} userPos={userPos} />
        </PullToRefresh>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden" style={{ height: "calc(100vh - 5rem)" }}>

      {/* Always-visible top search bar */}
      <div className="relative z-[1000] bg-card border-b border-border px-3 py-2.5 flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
          <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") geocodeCity(searchQuery); }}
            placeholder="Search places or cities…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {searchQuery && <button onClick={() => setSearchQuery("")}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>}
        </div>
        <div className="flex items-center bg-muted rounded-xl p-1 shrink-0">
          <button onClick={() => setViewMode("map")} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-card shadow text-foreground">
            <Map className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setViewMode("explore")} className="px-2.5 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground">
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Subtle helper message */}
      <AnimatePresence>
        {!helperDismissed && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute top-[60px] inset-x-0 mx-auto w-fit z-[999] flex items-center justify-center gap-2 bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-full pointer-events-auto"
          >
            <div className="flex items-center justify-center gap-2">
  <span className="text-[11px] text-center">Tap a pin to explore</span>
  <button
    onClick={dismissHelper}
    className="opacity-70 hover:opacity-100 flex items-center justify-center"
  >
    <X className="w-3 h-3" />
  </button>
</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map fills full background behind the sheet */}
      <div className="absolute left-0 right-0 z-0" style={{ top: "53px", bottom: 0 }}>
        <MapContainer
          center={[userPos.lat, userPos.lng]}
          zoom={14}
          className="h-full w-full"
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            attribution=""
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          {recenter && <RecenterMap lat={recenter.lat} lng={recenter.lng} />}
          <MapClickHandler onMapClick={() => { setActivePin(null); }} />

          {userPos && (
            <CircleMarker center={[userPos.lat, userPos.lng]} radius={8}
              pathOptions={{ fillColor: "#3B82F6", fillOpacity: 0.9, color: "#ffffff", weight: 2.5 }} />
          )}

          {sortedLocations.map((loc) => {
            const isActive = activePin?.id === loc.id;
            const wasSeen = sessionSeen.has(loc.id);
            const icon = isActive ? PIN_ACTIVE : wasSeen ? PIN_GRAY : PIN_RED;
            return (
              <Marker key={loc.id} position={[loc.latitude, loc.longitude]} icon={icon}
                eventHandlers={{ click: () => handlePinClick(loc) }}
              />
            );
          })}
        </MapContainer>

        {/* Floating map controls */}
        <div className="absolute z-[500]" style={{ bottom: `${SHEET_COLLAPSED + 12}px`, right: "12px" }}>
          <div className="flex flex-col gap-2">
            <button onClick={() => { if (userPos) setRecenter({ lat: userPos.lat, lng: userPos.lng }); }}
              className="w-9 h-9 rounded-full bg-card shadow-md border border-border flex items-center justify-center">
              <LocateFixed className="w-4 h-4 text-foreground" />
            </button>
            <button onClick={() => {
              if (sortedLocations.length > 0) {
                const rand = sortedLocations[Math.floor(Math.random() * Math.min(sortedLocations.length, 10))];
                handlePinClick(rand);
              }
            }} className="w-9 h-9 rounded-full bg-primary shadow-md flex items-center justify-center">
              <Shuffle className="w-4 h-4 text-primary-foreground" />
            </button>
          </div>
        </div>

        {/* Floating glass preview card — hovers over map above sheet */}
        <AnimatePresence>
          {activePin && (() => {
            const dist = userPos ? getDistance(userPos.lat, userPos.lng, activePin.latitude, activePin.longitude) : 0;
            const fav = isFavorite(activePin.id);
            const secondaryLine = activePin.has_story ? "Story available" : (activePin.category ? activePin.category.replace(/_/g, " ") : null);
            return (
              <motion.div
                key={activePin.id}
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 16, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute left-3 right-3 z-[501]"
                style={{ bottom: `${SHEET_COLLAPSED + 10}px` }}
              >
                <Link
                  to={`/LocationDetail?id=${activePin.id}`}
                  onClick={(e) => {
                    if (isGuest && guestFirstSeen && guestFirstSeen !== activePin.id) { e.preventDefault(); setShowGuestUpgrade(true); return; }
                    if (isGuest && !guestFirstSeen) setGuestFirstSeen(activePin.id);
                  }}
                  className="block"
                >
                  <div
                    className="flex items-center gap-3 rounded-2xl px-3 py-3 border border-white/10"
                    style={{ background: "rgba(12,18,28,0.78)", backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)" }}
                  >
                    {activePin.image_url && (
                      <img src={activePin.image_url} alt={activePin.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 shadow-md" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-white truncate">{activePin.name}</p>
                      <p className="text-[11px] text-white/65 mt-0.5">{walkMinutes(dist)} min walk</p>
                      {secondaryLine && <p className="text-[10px] text-white/45 capitalize mt-0.5">{secondaryLine}</p>}
                    </div>
                    <button
                      onClick={(e) => { e.preventDefault(); toggleFavorite(e, activePin); }}
                      className="p-2 rounded-full flex-shrink-0"
                    >
                      <Heart className={`w-4 h-4 ${fav ? "fill-red-400 text-red-400" : "text-white/70"}`} />
                    </button>
                  </div>
                </Link>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>

      {/* Draggable bottom sheet */}
      <motion.div
        ref={sheetRef}
        animate={{ height: sheetHeight }}
        transition={isDragging ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 28 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.08}
        onDragStart={(e, info) => {
          setIsDragging(true);
          dragStartY.current = info.point.y;
        }}
        onDrag={(e, info) => {
          const delta = info.point.y - dragStartY.current;
          const vh = window.innerHeight;
          const next = Math.max(SHEET_COLLAPSED, Math.min(vh * 0.82, sheetHeight - delta * 0.92));
          setSheetHeight(next);
          dragStartY.current = info.point.y;
        }}
        onDragEnd={(e, info) => {
          setIsDragging(false);
          const vh = window.innerHeight;
          const velocity = info.velocity.y;
          if (velocity > 500) { snapSheet(false); return; }
          if (velocity < -500) { snapSheet(true); return; }
          snapSheet(sheetHeight > vh * 0.42);
        }}
        className="absolute bottom-0 left-0 right-0 z-[600] bg-card rounded-t-3xl shadow-2xl border-t border-border flex flex-col overflow-hidden"
        style={{ touchAction: "none" }}
      >
        {/* Drag handle */}
        <div className="w-full flex flex-col items-center pt-2.5 pb-1 flex-shrink-0 cursor-grab active:cursor-grabbing select-none" onPointerDown={() => {}}>
          <div className="w-10 h-1 bg-muted-foreground/25 rounded-full" />
          <div className="flex items-center justify-between w-full px-4 pt-1.5 pb-0.5">
            <span className="text-sm font-bold text-foreground">Explore around you</span>
            <motion.div animate={{ rotate: sheetExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            </motion.div>
          </div>
        </div>

        {/* Category chips */}
        <div className="flex gap-2 px-4 pb-2 overflow-x-auto flex-shrink-0 no-scrollbar">
          {CHIPS.map(chip => (
            <button
              key={chip.id}
              onClick={() => { setActiveCategory(chip.id); if (!sheetExpanded) snapSheet(true); }}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                activeCategory === chip.id
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-muted-foreground border-border hover:border-foreground/30"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        {sheetExpanded ? (
          <div className="flex-1 overflow-y-auto pb-6">
            {sheetLocations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No places in this category</p>
            ) : (() => {
              const scored = sheetLocations.map(loc => ({
                loc,
                score: calcHeroScore(loc, userPos ? getDistance(userPos.lat, userPos.lng, loc.latitude, loc.longitude) : 9999)
              }));
              scored.sort((a, b) => b.score - a.score);
              const hero = scored[0].loc;
              const rest = scored.slice(1).map(s => s.loc);
              const heroDist = userPos ? getDistance(userPos.lat, userPos.lng, hero.latitude, hero.longitude) : null;
              const heroLine = hero.mystery_teaser || hero.quick_story || hero.description || "";
              return (
                <>
                  <div className="px-4 pb-4">
                    <Link
                      to={`/LocationDetail?id=${hero.id}`}
                      onClick={(e) => { if (isGuest && guestFirstSeen && guestFirstSeen !== hero.id) { e.preventDefault(); setShowGuestUpgrade(true); } else if (isGuest && !guestFirstSeen) setGuestFirstSeen(hero.id); }}
                      className="group block rounded-[28px] overflow-hidden border border-white/40 bg-white/80 backdrop-blur-sm active:scale-[0.99] transition-all duration-300"
                    >
                      <div className="relative w-full h-52 bg-muted">
                        {hero.image_url
                          ? <img src={hero.image_url} alt={hero.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                          : <div className="w-full h-full flex items-center justify-center"><MapPin className="w-10 h-10 text-muted-foreground/30" /></div>}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/28 to-black/5" />
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <p className="text-white font-semibold text-[16px] tracking-tight leading-tight mb-1.5">{hero.name}</p>
                          {heroLine && <p className="text-white/80 text-[12.5px] leading-relaxed line-clamp-2 mb-2.5">{heroLine}</p>}
                          {heroDist !== null && <p className="text-white/70 text-[11px] font-medium tracking-tight">{walkMinutes(heroDist)} min walk</p>}
                        </div>
                      </div>
                    </Link>
                  </div>
                  {rest.length > 0 && (
                    <div className="px-4 grid grid-cols-2 gap-3">
                      {rest.map(loc => {
                        const dist = userPos ? getDistance(userPos.lat, userPos.lng, loc.latitude, loc.longitude) : null;
                        return (
                          <Link
                            key={loc.id}
                            to={`/LocationDetail?id=${loc.id}`}
                            onClick={(e) => { if (isGuest && guestFirstSeen && guestFirstSeen !== loc.id) { e.preventDefault(); setShowGuestUpgrade(true); } else if (isGuest && !guestFirstSeen) setGuestFirstSeen(loc.id); }}
                            className="block rounded-xl overflow-hidden border border-border/50 bg-card/70 backdrop-blur-sm active:scale-[0.98] transition-transform"
                          >
                            <div className="relative w-full h-28 bg-muted">
                              {loc.image_url
                                ? <img src={loc.image_url} alt={loc.name} className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center"><MapPin className="w-5 h-5 text-muted-foreground/30" /></div>}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-2.5">
                                <p className="text-white font-semibold text-xs leading-snug line-clamp-2">{loc.name}</p>
                                {dist !== null && <p className="text-white/60 text-[10px] mt-0.5">{walkMinutes(dist)} min walk</p>}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : (
          <div className="flex gap-3 px-4 pb-2 overflow-x-auto no-scrollbar">
            {sheetLocations.slice(0, 6).map(loc => {
              const dist = userPos ? getDistance(userPos.lat, userPos.lng, loc.latitude, loc.longitude) : 0;
              const hasAudio = !!(loc.quick_audio_url || loc.deep_audio_url);
              return (
                <button key={loc.id}
                  onClick={() => { handlePinClick(loc); }}
                  className="shrink-0 flex items-center gap-2 bg-muted/60 rounded-xl px-3 py-2 border border-border active:scale-[0.97] transition-transform"
                >
                  {loc.image_url && <img src={loc.image_url} alt={loc.name} className="w-8 h-8 rounded-lg object-cover" />}
                  <div className="text-left">
                    <p className="text-xs font-semibold line-clamp-1 max-w-[80px]">{loc.name}</p>
                    <div className="flex items-center gap-1">
                      {hasAudio && <Headphones className="w-2.5 h-2.5 text-primary" />}
                      <p className="text-[10px] text-muted-foreground">{walkMinutes(dist)} min</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </motion.div>

      <GuestSignupModal open={showGuestModal} onClose={() => setShowGuestModal(false)} />
      <GuestUpgradeOverlay open={showGuestUpgrade} onClose={() => setShowGuestUpgrade(false)} variant="blocked" />
    </div>
  );
}