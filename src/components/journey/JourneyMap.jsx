import React, { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ─────────────────────────────────────────────────────────────────────────────
// VISUAL HIERARCHY
// Tier 1 (main):      MAIN_HIGHLIGHT, SUNSET_ANCHOR  — dominant, 40px
// Tier 2 (secondary): SECONDARY_HIGHLIGHT            — medium, 32px
// Tier 3 (quick):     QUICK_STOP, SCENIC_PASS        — light, 26px
// Tier 4 (support):   COFFEE/MEAL/REST/FUEL          — minimal, 22px
// Tier 5 (zone):      departure / arrival suggestions — distinct color, 22px
// ─────────────────────────────────────────────────────────────────────────────

const TIER = {
  main:      { size: 40, bg: "#1a5c45", border: "#0d3d2e", ring: "#4aac80", zOffset: 900 },
  sunset:    { size: 40, bg: "#c2610d", border: "#7a3905", ring: "#f0a060", zOffset: 900 },
  secondary: { size: 32, bg: "#2a7a60", border: "#155040", ring: "#6abf9a", zOffset: 700 },
  quick:     { size: 26, bg: "#546878", border: "#2e4455", ring: "#8aaabb", zOffset: 500 },
  support:   { size: 22, bg: "#7a6a5a", border: "#4a3a2a", ring: "#bba88a", zOffset: 300 },
  origin:    { size: 30, bg: "#1a5c45", border: "#0d3d2e", ring: "#4aac80", zOffset: 1100 },
  dest:      { size: 30, bg: "#c2610d", border: "#7a3905", ring: "#f0a060", zOffset: 1050 },
  arrival:   { size: 24, bg: "#1a5e7a", border: "#0c3a4d", ring: "#5ab0d0", zOffset: 400 },
  departure: { size: 20, bg: "#2d7a56", border: "#174030", ring: "#6abf9a", zOffset: 200 },
};

const ROLE_TO_TIER = {
  main_highlight:      "main",
  sunset_anchor:       "sunset",
  secondary_highlight: "secondary",
  scenic_pass:         "quick",
  quick_stop:          "quick",
  coffee_stop:         "support",
  meal_stop:           "support",
  rest_stop:           "support",
  fuel_stop:           "support",
  // legacy
  anchor:              "main",
  highlight:           "secondary",
  connector:           "quick",
};

const ROLE_LABEL = {
  main_highlight:      "Main highlight",
  sunset_anchor:       "Sunset stop",
  secondary_highlight: "Highlight",
  scenic_pass:         "Scenic pass",
  quick_stop:          "Quick stop",
  coffee_stop:         "Coffee",
  meal_stop:           "Meal",
  rest_stop:           "Rest",
  fuel_stop:           "Fuel",
  anchor:              "Main highlight",
  highlight:           "Highlight",
  connector:           "Stop",
};

const ROLE_EMOJI = {
  main:      "●",
  sunset:    "◐",
  secondary: "●",
  quick:     "·",
  support:   "·",
  origin:    "▲",
  dest:      "▼",
  arrival:   "◆",
  departure: "◇",
};

// ─── Icon factory — clean circle with pointer ─────────────────────────────────
function makeIcon(tierKey, active = false, pulse = false) {
  const t    = TIER[tierKey] || TIER.quick;
  const s    = t.size;
  const half = s / 2;
  const bg   = active ? t.ring : t.bg;
  const brd  = active ? `3px solid ${t.ring}` : `2px solid ${t.border}`;
  const shad = active
    ? `0 0 0 4px ${t.ring}44, 0 4px 16px rgba(0,0,0,0.5)`
    : `0 2px 8px rgba(0,0,0,0.28)`;
  const em   = ROLE_EMOJI[tierKey] || "●";
  const fs   = Math.round(s * 0.38);
  const tip  = Math.round(s * 0.20);

  const pulseHtml = pulse ? `<span style="
    position:absolute;inset:-7px;border-radius:50%;
    border:2px solid ${t.ring};opacity:0.7;
    animation:tp-ring 1.8s ease-out infinite;pointer-events:none;
  "></span>` : "";

  return L.divIcon({
    className: "",
    iconSize:    [s, s + tip + 2],
    iconAnchor:  [half, s + tip + 2],
    popupAnchor: [0, -(s + tip + 4)],
    html: `
      <style>@keyframes tp-ring{0%{transform:scale(1);opacity:.7}70%{transform:scale(1.6);opacity:0}100%{transform:scale(1.6);opacity:0}}</style>
      <div style="position:relative;display:inline-flex;flex-direction:column;align-items:center;">
        ${pulseHtml}
        <div style="
          width:${s}px;height:${s}px;border-radius:50%;
          background:${bg};border:${brd};
          display:flex;align-items:center;justify-content:center;
          font-size:${fs}px;color:#fff;font-weight:700;letter-spacing:0;
          box-shadow:${shad};
          transition:transform .18s,box-shadow .18s;
          transform:${active ? "scale(1.15)" : "scale(1)"};
          position:relative;
        ">${em}</div>
        <div style="
          width:0;height:0;
          border-left:${tip - 1}px solid transparent;
          border-right:${tip - 1}px solid transparent;
          border-top:${tip}px solid ${active ? t.ring : t.bg};
          margin-top:-1px;
        "></div>
      </div>`,
  });
}

// ─── Decode polyline: array of {lat,lng} objects or encoded string ─────────────
function decodePolyline(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(p => [p.lat ?? p[0], p.lng ?? p[1]]);
  let i = 0, lat = 0, lng = 0;
  const out = [];
  while (i < raw.length) {
    let s = 0, r = 0, b;
    do { b = raw.charCodeAt(i++) - 63; r |= (b & 0x1f) << s; s += 5; } while (b >= 0x20);
    lat += r & 1 ? ~(r >> 1) : r >> 1;
    s = 0; r = 0;
    do { b = raw.charCodeAt(i++) - 63; r |= (b & 0x1f) << s; s += 5; } while (b >= 0x20);
    lng += r & 1 ? ~(r >> 1) : r >> 1;
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}

// ─── Map helpers ──────────────────────────────────────────────────────────────
function FitBounds({ positions }) {
  const map = useMap();
  const key = positions.slice(0, 6).map(p => `${p[0].toFixed(3)},${p[1].toFixed(3)}`).join("|");
  useEffect(() => {
    if (!positions.length) return;
    const bounds = L.latLngBounds(positions);
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [52, 52], maxZoom: 14 });
  }, [key]);
  return null;
}

function FlyTo({ position, zoom = 14 }) {
  const map = useMap();
  useEffect(() => {
    if (!position) return;
    map.flyTo(position, zoom, { animate: true, duration: 0.55 });
  }, [position?.join?.(",")]);
  return null;
}

// ─── Popup ────────────────────────────────────────────────────────────────────
function StopPopup({ stop }) {
  const roleKey  = (stop.stop_role || "default").toLowerCase().replace(/-/g, "_");
  const tierKey  = ROLE_TO_TIER[roleKey] || "quick";
  const t        = TIER[tierKey];
  const label    = ROLE_LABEL[roleKey] || "Stop";
  const lat      = stop.location?.latitude;
  const lng      = stop.location?.longitude;
  const isMain   = tierKey === "main" || tierKey === "sunset";
  const isSupport = tierKey === "support";

  return (
    <div style={{ minWidth: 160, maxWidth: 210, fontFamily: "system-ui,sans-serif" }}>
      <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 3, lineHeight: 1.3 }}>
        {stop.location?.name}
      </div>
      {stop.hook && (
        <p style={{ fontSize: 11, color: "#666", marginBottom: 6, lineHeight: 1.45 }}>{stop.hook}</p>
      )}
      <div style={{ display: "flex", gap: 5, marginBottom: 7, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{
          fontSize: 10, padding: "2px 7px", borderRadius: 99, fontWeight: 600,
          background: isMain ? "#ddf0e8" : isSupport ? "#f3ece4" : "#efefef",
          color: isMain ? t.bg : isSupport ? "#7a6a5a" : "#444",
        }}>{label}</span>
        {stop.dwell_minutes && (
          <span style={{ fontSize: 10, color: "#888" }}>{stop.dwell_minutes} min</span>
        )}
        {stop.route_label && stop.route_label !== "On route" && (
          <span style={{ fontSize: 10, color: "#b07a20" }}>{stop.route_label}</span>
        )}
      </div>
      {lat && lng && (
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
          target="_blank" rel="noopener noreferrer"
          style={{
            fontSize: 11, fontWeight: 600, color: t.bg,
            background: "#e8f5ee", border: `1px solid ${t.ring}`,
            padding: "3px 9px", borderRadius: 6,
            textDecoration: "none", display: "inline-block",
          }}
        >↗ Navigate</a>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function JourneyMap({
  stops = [],
  arrivalSuggestions = [],
  departureSuggestions = [],
  polyline = null,
  originLat = null,
  originLng = null,
  destLat = null,
  destLng = null,
  resultStatus = null,
  activeStopId = null,
  onMarkerClick = null,
  className = "",
  height = "320px",
}) {
  const markerRefs = useRef({});
  const lineCoords  = decodePolyline(polyline);

  const isArrivalOnly = resultStatus === "arrival_only";
  const isEmpty       = resultStatus === "empty";

  // Stops to render — never show anything for empty
  const visibleStops = isEmpty ? [] : isArrivalOnly ? [] : stops;

  // Arrivals always shown unless empty
  const visibleArrivals   = isEmpty ? [] : arrivalSuggestions;
  // Departures only for non-empty, non-arrival-only
  const visibleDepartures = isEmpty || isArrivalOnly ? [] : departureSuggestions;

  // Active stop (for FlyTo)
  const activeStop = activeStopId
    ? stops.find(s => (s.location?.id || s.location?.location_id) === activeStopId)
    : null;
  const activePos = activeStop?.location?.latitude != null
    ? [activeStop.location.latitude, activeStop.location.longitude]
    : null;

  // FitBounds seed
  const allPos = [
    ...(originLat && originLng ? [[originLat, originLng]] : []),
    ...visibleStops.filter(s => s.location?.latitude).map(s => [s.location.latitude, s.location.longitude]),
    ...(destLat && destLng ? [[destLat, destLng]] : []),
    ...(isArrivalOnly ? visibleArrivals.filter(s => s.location?.latitude).map(s => [s.location.latitude, s.location.longitude]) : []),
    ...(lineCoords.length > 4 ? [lineCoords[0], lineCoords[Math.floor(lineCoords.length / 2)], lineCoords[lineCoords.length - 1]] : lineCoords),
  ];
  const center = allPos[0] || [25.2854, 51.531];

  // Open popup on active change
  useEffect(() => {
    if (!activeStopId) return;
    const ref = markerRefs.current[activeStopId];
    if (ref) setTimeout(() => ref.openPopup?.(), 400);
  }, [activeStopId]);

  // Google Maps multi-stop handoff
  const openGoogleMaps = () => {
    if (visibleStops.length === 0 && visibleArrivals.length === 0) return;
    const waypoints = visibleStops
      .filter(s => s.location?.latitude)
      .sort((a, b) => (a._progress || 0) - (b._progress || 0))
      .map(s => `${s.location.latitude},${s.location.longitude}`);
    if (destLat && destLng) waypoints.push(`${destLat},${destLng}`);
    if (waypoints.length === 0) return;
    const dest = waypoints.pop();
    const origin = originLat && originLng ? `${originLat},${originLng}` : "";
    const url = origin
      ? `https://www.google.com/maps/dir/${origin}/${waypoints.join("/")}/${dest}`
      : `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
    window.open(url, "_blank");
  };

  // Legend items to render
  const hasSunset    = visibleStops.some(s => (s.stop_role || "").toLowerCase().includes("sunset"));
  const hasMain      = visibleStops.some(s => ["main_highlight", "anchor"].includes((s.stop_role || "").toLowerCase()));
  const hasSecondary = visibleStops.some(s => ["secondary_highlight", "highlight"].includes((s.stop_role || "").toLowerCase()));
  const hasQuick     = visibleStops.some(s => ["quick_stop", "scenic_pass", "connector"].includes((s.stop_role || "").toLowerCase()));
  const hasSupport   = visibleStops.some(s => ["coffee_stop", "meal_stop", "rest_stop", "fuel_stop"].includes((s.stop_role || "").toLowerCase()));
  const showLegend   = hasMain || hasSunset || hasSecondary || hasQuick || hasSupport || visibleArrivals.length > 0;

  return (
    <div
      style={{ height, borderRadius: "0.875rem", overflow: "hidden", position: "relative" }}
      className={`border border-border shadow-sm ${className}`}
    >
      <MapContainer
        center={center}
        zoom={9}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution="© OpenStreetMap © CARTO"
        />

        <FitBounds positions={allPos} />
        {activePos && <FlyTo position={activePos} zoom={14} />}

        {/* ── Route polyline ─────────────────────────────────────────── */}
        {lineCoords.length >= 2 && !isArrivalOnly && !isEmpty && (
          <>
            {/* Halo */}
            <Polyline positions={lineCoords} pathOptions={{ color: "#fff", weight: 8, opacity: 0.5 }} />
            {/* Main line — primary visual element */}
            <Polyline positions={lineCoords} pathOptions={{ color: "#1a5c45", weight: 4.5, opacity: 0.92 }} />
          </>
        )}

        {/* Dashed fallback when no polyline but stops exist */}
        {lineCoords.length < 2 && visibleStops.length >= 2 && (
          <Polyline
            positions={visibleStops
              .filter(s => s.location?.latitude)
              .sort((a, b) => (a._progress || 0) - (b._progress || 0))
              .map(s => [s.location.latitude, s.location.longitude])}
            pathOptions={{ color: "#1a5c45", weight: 2.5, opacity: 0.4, dashArray: "10 8" }}
          />
        )}

        {/* ── Origin ──────────────────────────────────────────────────── */}
        {originLat && originLng && !isEmpty && (
          <Marker position={[originLat, originLng]} icon={makeIcon("origin")} zIndexOffset={1100}>
            <Popup>
              <div style={{ fontWeight: 700, fontSize: 12 }}>Start</div>
              <a href={`https://www.google.com/maps?q=${originLat},${originLng}`}
                target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: "#1a5c45" }}>View on Maps</a>
            </Popup>
          </Marker>
        )}

        {/* ── Destination ─────────────────────────────────────────────── */}
        {destLat && destLng && !isEmpty && (
          <Marker position={[destLat, destLng]} icon={makeIcon("dest")} zIndexOffset={1050}>
            <Popup>
              <div style={{ fontWeight: 700, fontSize: 12 }}>Destination</div>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`}
                target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: "#c2610d" }}>Navigate here</a>
            </Popup>
          </Marker>
        )}

        {/* ── Route stop markers (hierarchy-tiered) ───────────────────── */}
        {visibleStops.map((stop, i) => {
          const lat = stop.location?.latitude;
          const lng = stop.location?.longitude;
          if (!lat || !lng) return null;

          const lid     = stop.location?.id || stop.location?.location_id || String(i);
          const roleKey = (stop.stop_role || "default").toLowerCase().replace(/-/g, "_");
          const tierKey = ROLE_TO_TIER[roleKey] || "quick";
          const isActive = lid === activeStopId;
          const isPulse  = isActive && (tierKey === "main" || tierKey === "sunset");

          return (
            <Marker
              key={lid}
              position={[lat, lng]}
              icon={makeIcon(tierKey, isActive, isPulse)}
              zIndexOffset={isActive ? 2000 : TIER[tierKey]?.zOffset || 500}
              ref={el => { if (el) markerRefs.current[lid] = el; }}
              eventHandlers={{ click: () => onMarkerClick?.(lid) }}
            >
              <Popup maxWidth={240}>
                <StopPopup stop={stop} />
              </Popup>
            </Marker>
          );
        })}

        {/* ── Departure suggestions — muted, distinct ─────────────────── */}
        {visibleDepartures.map((s, i) => {
          const lat = s.location?.latitude;
          const lng = s.location?.longitude;
          if (!lat || !lng) return null;
          return (
            <Marker key={`dep-${i}`} position={[lat, lng]} icon={makeIcon("departure")} zIndexOffset={200}>
              <Popup maxWidth={200}>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2 }}>{s.location?.name}</div>
                <div style={{ fontSize: 11, color: "#666" }}>Near your start</div>
              </Popup>
            </Marker>
          );
        })}

        {/* ── Arrival suggestions — teal, emphasized when arrival_only ── */}
        {visibleArrivals.map((s, i) => {
          const lat = s.location?.latitude;
          const lng = s.location?.longitude;
          if (!lat || !lng) return null;
          const sz = isArrivalOnly ? "secondary" : "arrival";
          return (
            <Marker key={`arr-${i}`} position={[lat, lng]} icon={makeIcon(sz)} zIndexOffset={isArrivalOnly ? 800 : 350}>
              <Popup maxWidth={200}>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2 }}>{s.location?.name}</div>
                <div style={{ fontSize: 11, color: "#666", marginBottom: 5 }}>Once you arrive</div>
                {lat && (
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 11, color: "#1a5e7a", fontWeight: 600 }}>↗ Navigate</a>
                )}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      {showLegend && (
        <div style={{
          position: "absolute", bottom: 10, left: 10, zIndex: 1000,
          background: "rgba(255,255,255,0.92)", backdropFilter: "blur(6px)",
          borderRadius: 8, padding: "5px 9px",
          fontSize: 10, lineHeight: 1.8, color: "#333",
          boxShadow: "0 1px 8px rgba(0,0,0,0.14)",
          pointerEvents: "none",
        }}>
          {(hasMain || hasSunset) && <div><span style={{ color: "#1a5c45", fontWeight: 700 }}>●</span> Main highlight</div>}
          {hasSecondary && <div><span style={{ color: "#2a7a60" }}>●</span> Highlight</div>}
          {hasQuick     && <div><span style={{ color: "#546878" }}>·</span> Quick stop</div>}
          {hasSupport   && <div style={{ opacity: 0.75 }}><span>·</span> Support stop</div>}
          {visibleArrivals.length > 0   && <div style={{ color: "#1a5e7a" }}>◆ At destination</div>}
          {visibleDepartures.length > 0 && <div style={{ color: "#2d7a56", opacity: 0.8 }}>◇ Near start</div>}
        </div>
      )}

      {/* ── Google Maps handoff button ──────────────────────────────────── */}
      {!isEmpty && (visibleStops.length > 0 || (isArrivalOnly && visibleArrivals.length > 0)) && (
        <button
          onClick={openGoogleMaps}
          style={{
            position: "absolute", bottom: 10, right: 10, zIndex: 1000,
            background: "#1a5c45", color: "#fff",
            border: "none", borderRadius: 8,
            padding: "6px 12px", fontSize: 11, fontWeight: 700,
            cursor: "pointer", boxShadow: "0 2px 10px rgba(0,0,0,0.22)",
            display: "flex", alignItems: "center", gap: 5,
          }}
        >
          <span style={{ fontSize: 12 }}>↗</span> Open in Maps
        </button>
      )}
    </div>
  );
}