import React, { useState, useEffect } from "react";
import { base44 } from "@/api/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Route } from "lucide-react";
import { motion } from "framer-motion";
import JourneyInput from "@/components/journey/JourneyInput";
import JourneyStops from "@/components/journey/JourneyStops";
import JourneyConfirmed from "@/components/journey/JourneyConfirmed";
import JourneyActive from "@/components/journey/JourneyActive";
import { trackJourneyEvent, resolvePersonalizationWeights, getPersonalizationHint } from "@/lib/personalization";
import PersonalizationHint from "@/components/journey/PersonalizationHint";
import JourneyDebugPanel from "@/components/journey/JourneyDebugPanel";
import { useAuth } from "@/components/AuthContext";
import { applyJourneyGuardrails } from "@/lib/journeyGuardrails";

// States: draft → suggested → locked → active → completed

export default function RoutePlanner() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [phase, setPhase] = useState("draft");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [partialNote, setPartialNote] = useState(null);
  const [userPos, setUserPos] = useState(null);

  // Persistent form state (survives back navigation)
  const [formInputs, setFormInputs] = useState({
    description: "",
    startLoc: null,
    destLoc: null,
    timeMinutes: null,   // null = not set by user; backend infers from route
    paceMode: null,      // "fast" | "balanced" | "exploratory" | null
    mode: "drive",
    routeStyle: "standard",
    themes: [],
  });

  // Journey data from backend
  const [journey, setJourney] = useState(null);
  const [confirmedStops, setConfirmedStops] = useState([]);
  const [serviceLayer, setServiceLayer] = useState(null);
  const [sunsetAlignment, setSunsetAlignment] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [personalizationHint, setPersonalizationHint] = useState(null);

  // Load user profile for personalization
  useEffect(() => {
    base44.functions.invoke('getUserProfile', {}).then(res => {
      if (res?.data?.profile) {
        const p = res.data.profile;
        setUserProfile(p);
        setPersonalizationHint(getPersonalizationHint(p));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        // Fallback to IP
        fetch("https://ipapi.co/json/")
          .then(r => r.json())
          .then(d => setUserPos({ lat: d.latitude || 25.2854, lng: d.longitude || 51.5310 }))
          .catch(() => setUserPos({ lat: 25.2854, lng: 51.5310 }));
      }
    );
  }, []);

  const handleFormChange = (updates) => {
    setFormInputs(prev => ({ ...prev, ...updates }));
  };

  const handleBuild = async ({ description, startLoc, destLoc, timeMinutes, paceMode, mode, routeStyle, themes }) => {
    // Store form state before building
    setFormInputs({ description, startLoc, destLoc, timeMinutes, paceMode, mode, routeStyle, themes });
    setLoading(true);
    setError(null);
    try {
      // Validate coordinates before sending — prevent Europe/garbage jumps
      const startLat = typeof startLoc?.lat === "number" ? startLoc.lat : parseFloat(startLoc?.lat);
      const startLng = typeof startLoc?.lng === "number" ? startLoc.lng : parseFloat(startLoc?.lng);
      const destLat  = destLoc ? (typeof destLoc.lat === "number" ? destLoc.lat : parseFloat(destLoc.lat)) : null;
      const destLng  = destLoc ? (typeof destLoc.lng === "number" ? destLoc.lng : parseFloat(destLoc.lng)) : null;

      if (!startLat || !startLng || isNaN(startLat) || isNaN(startLng)) {
        setError("Please select a valid starting location.");
        setLoading(false);
        return;
      }
      if (destLoc && (isNaN(destLat) || isNaN(destLng) || !destLat || !destLng)) {
        setError("Please select a valid destination.");
        setLoading(false);
        return;
      }

      console.log("[Journey] coords →", { startLat, startLng, destLat, destLng });

      // Resolution proof — attach canonical place metadata to the journey request
      const resolvedOrigin = formInputs.startLoc ? {
        display_name:          formInputs.startLoc.display_name || formInputs.startLoc.name,
        canonical_name:        formInputs.startLoc.canonical_name || formInputs.startLoc.name,
        country:               formInputs.startLoc.country || null,
        place_kind:            formInputs.startLoc.place_kind || null,
        source_place_id:       formInputs.startLoc.source_place_id || null,
        resolution_confidence: formInputs.startLoc.resolution_confidence || null,
        user_confirmed:        formInputs.startLoc.user_confirmed || false,
      } : null;
      const resolvedDestination = destLoc ? {
        display_name:          destLoc.display_name || destLoc.name,
        canonical_name:        destLoc.canonical_name || destLoc.name,
        country:               destLoc.country || null,
        place_kind:            destLoc.place_kind || null,
        source_place_id:       destLoc.source_place_id || null,
        resolution_confidence: destLoc.resolution_confidence || null,
        user_confirmed:        destLoc.user_confirmed || false,
      } : null;

      // Safety: require minimum confidence before proceeding
      const originConf = formInputs.startLoc?.resolution_confidence ?? 100; // GPS/current-loc always ok
      const destConf   = destLoc?.resolution_confidence ?? 100;
      if (destLoc && destConf < 15 && !destLoc.user_confirmed) {
        setError("We couldn't confidently resolve your destination. Please select it from the dropdown.");
        setLoading(false);
        return;
      }

      // ── Multi-day detection: route to buildMultiDayJourney if signals present ──
      const multiDaySignals = [
        /hotel|hotels|stay|overnight|sleep|accommodation|lodge/i.test(description),
        /different cities|multiple cities|cities along/i.test(description),
        /not more than|max.*km|km.*each|per day|per leg|each time/i.test(description),
        /multi.?day|multiple days|road trip|long trip|few days|several days/i.test(description),
        /1 night|2 nights|3 nights|one night|two nights/i.test(description),
      ].filter(Boolean).length;
      const extractedMaxLeg = (() => {
        const m = description.match(/(\d{2,4})\s*(?:km|kilometers?|kilometres?)/i);
        return m ? parseInt(m[1]) : null;
      })();
      const isMultiDay = multiDaySignals >= 1 || (extractedMaxLeg && destLat);

      if (isMultiDay && destLat && destLng) {
        const mdRes = await base44.functions.invoke("buildMultiDayJourney", {
          description,
          startLat, startLng, destLat, destLng,
          startName: formInputs.startLoc?.canonical_name || formInputs.startLoc?.name || null,
          destName:  destLoc?.canonical_name || destLoc?.name || null,
          mode,
          themes,
          maxLegKm: extractedMaxLeg || 300,
          resolved_origin:      resolvedOrigin,
          resolved_destination: resolvedDestination,
        });
        if (mdRes.data?.error) {
          setError(mdRes.data.error || "Could not plan this trip.");
          setLoading(false);
          return;
        }
        const mdJourney = { ...mdRes.data, mode };
        setJourney(mdJourney);
        setPartialNote(mdJourney.partial_match_note || null);
        setPhase("suggested");
        setLoading(false);
        return;
      }

      const res = await base44.functions.invoke("buildJourneyV2", {
        description,
        startLat,
        startLng,
        timeMinutes,
        paceMode: paceMode || null,
        mode,
        routeStyle,
        destLat: destLat || null,
        destLng: destLng || null,
        destName: destLoc?.canonical_name || destLoc?.name || null,
        themes,
        resolved_origin:      resolvedOrigin,
        resolved_destination: resolvedDestination,
      });

      if (res.data?.error) {
        setError(res.data.message || "Could not build a journey. Try adjusting your input.");
        setLoading(false);
        return;
      }

      // ── Phase 8: Auto-fix quality layer ──────────────────────────────────
      let journeyData = res.data;
      try {
        const fixRes = await base44.functions.invoke("evaluateJourney", {
          journey_result: journeyData,
          input: { startLat, startLng, destLat, destLng, mode },
        });
        if (fixRes?.data?.fixed_journey) {
          journeyData = {
            ...fixRes.data.fixed_journey,
            _quality: fixRes.data.quality,
            _debug_quality: fixRes.data.debug_quality,
            // preserve fields that may not be in fixed_journey
            debug: res.data.debug,
          };
        }
      } catch {
        // Auto-fix failed silently — use original journey
      }

      // ── Phase 9: Output guardrails ────────────────────────────────────
      // Inject mode so guardrails can enforce venue class + mode consistency
      const { journey: guardedJourney } = applyJourneyGuardrails({ ...journeyData, mode });
      journeyData = guardedJourney;

      setJourney(journeyData);
      setPartialNote(journeyData?.partial_match_note || null);
      setPhase("suggested");

      // Track journey creation event — use post-fix stop count
      const stopCount = (journeyData?.main_stops?.length || 0) + (journeyData?.quick_stops?.length || 0);
      trackJourneyEvent('journey_created', {
        mode, pacing: paceMode || 'balanced', themes,
        stop_count: stopCount,
      });
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  const handleConfirm = (stops, sl, sa) => {
    setConfirmedStops(stops);
    if (sl) setServiceLayer(sl);
    if (sa) setSunsetAlignment(sa);
    setPhase("locked");
  };

  const handleBegin = (firstStop) => {
    setPhase("active");
    // Navigate to first stop
    const lat = firstStop?.location?.latitude;
    const lng = firstStop?.location?.longitude;
    if (lat && lng) {
      const isApple = /iPhone|iPad|iPod|Mac/.test(navigator.userAgent);
      const url = isApple
        ? `maps://maps.apple.com/?daddr=${lat},${lng}`
        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      window.open(url, "_blank");
    }
  };

  const handleReset = () => {
    setPhase("draft");
    setJourney(null);
    setConfirmedStops([]);
    setServiceLayer(null);
    setSunsetAlignment(null);
    setError(null);
    setPartialNote(null);
    // Also reset form inputs on explicit reset
    setFormInputs({
      description: "",
      startLoc: null,
      destLoc: null,
      timeMinutes: null,
      paceMode: null,
      mode: "drive",
      routeStyle: "standard",
      themes: [],
    });
  };

  const handleComplete = () => {
    // Track completion
    trackJourneyEvent('journey_completed', {
      stop_count: confirmedStops.length,
      journey_duration_min: journey?.route_metadata?.duration_minutes || 0,
    });
    setPhase("draft");
    setJourney(null);
    setConfirmedStops([]);
  };

  const goBack = () => {
    if (phase === "suggested") setPhase("draft");
    else if (phase === "locked") setPhase("suggested");
  };

  const PHASE_SUBTITLE = {
    draft: "Tell us what you feel like.",
    suggested: "Here's what we found.",
    locked: "All set.",
    active: "On your way.",
  };

  return (
    <div className="max-w-lg mx-auto px-5 py-6 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {phase === "draft" ? (
          <Link to="/Home">
            <Button variant="ghost" size="icon" className="rounded-full w-9 h-9">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
        ) : phase !== "active" ? (
          <Button variant="ghost" size="icon" className="rounded-full w-9 h-9" onClick={goBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
        ) : null}
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Route className="w-5 h-5 text-primary" /> Route
          </h1>
          <p className="text-xs text-muted-foreground">{PHASE_SUBTITLE[phase]}</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="mb-5 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-center"
        >
          <p className="text-sm text-destructive">{error}</p>
          <div className="flex gap-2 justify-center mt-3">
            <button onClick={() => setError(null)} className="text-xs text-muted-foreground hover:text-foreground underline">
              Try again
            </button>
          </div>
        </motion.div>
      )}

      {/* Partial match note */}
      {partialNote && !error && (
        <motion.div
          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="mb-5 p-3 rounded-xl bg-accent/10 border border-accent/20 flex items-start gap-2"
        >
          <span className="text-sm">ℹ️</span>
          <p className="text-xs text-foreground/70 leading-relaxed">{partialNote}</p>
          <button onClick={() => setPartialNote(null)} className="ml-auto text-muted-foreground/40 hover:text-muted-foreground flex-shrink-0">
            <span className="text-xs">✕</span>
          </button>
        </motion.div>
      )}

      {/* Phases */}
      {phase === "draft" && (
        <>
          <PersonalizationHint hint={personalizationHint} />
          <JourneyInput
            onBuild={handleBuild}
            userPos={userPos}
            loading={loading}
            formInputs={formInputs}
            onFormChange={handleFormChange}
            personalizationWeights={resolvePersonalizationWeights(userProfile)}
          />
        </>
      )}

      {phase === "suggested" && journey && isAdmin && (
        <JourneyDebugPanel journey={journey} />
      )}

      {phase === "suggested" && journey && (
        <JourneyStops
          journey={journey}
          onConfirm={handleConfirm}
          onBack={() => setPhase("draft")}
          originLat={formInputs.startLoc?.lat}
          originLng={formInputs.startLoc?.lng}
          destLat={formInputs.destLoc?.lat}
          destLng={formInputs.destLoc?.lng}
          mode={formInputs.mode}
        />
      )}

      {phase === "locked" && journey && (
        <JourneyConfirmed
          journey={journey}
          stops={confirmedStops}
          onBegin={handleBegin}
          onReset={handleReset}
          originLat={formInputs.startLoc?.lat}
          originLng={formInputs.startLoc?.lng}
          destLat={formInputs.destLoc?.lat}
          destLng={formInputs.destLoc?.lng}
          serviceLayer={serviceLayer}
          sunsetAlignment={sunsetAlignment}
          mode={formInputs.mode}
        />
      )}

      {phase === "active" && journey && (
        <JourneyActive
          journey={journey}
          stops={confirmedStops}
          onComplete={handleComplete}
          onReset={handleReset}
        />
      )}
    </div>
  );
}