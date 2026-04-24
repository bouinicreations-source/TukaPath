import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { base44 } from "@/api/client";
import MissedOpportunityCard from "./MissedOpportunityCard";
import { trackJourneyEvent } from "@/lib/personalization";

/*
  MissedOpportunityEngine
  ────────────────────────
  - Runs once when journey becomes active (or on review phase)
  - Finds high-value nearby stops NOT in the journey
  - Surfaces max 1–2, one at a time
  - Respects skipped IDs (never re-shows)
  - Motorcycle: stricter filtering
*/

export default function MissedOpportunityEngine({
  routePoints,      // Array of {lat, lng, progress_score}
  existingStops,    // Array of stop objects (with location.id)
  mode,             // "drive" | "motorcycle" | "walk"
  routeDistKm,
  intentTags,
  onAddStop,        // (suggestion) => void — called when user accepts
  phase,            // "suggested" | "locked" | "active" — controls when engine fires
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [shownIds, setShownIds] = useState(new Set());
  const [skippedIds, setSkippedIds] = useState(new Set());
  const [activeSuggestion, setActiveSuggestion] = useState(null);
  const hasFired = useRef(false);

  // Fire when phase becomes "suggested" or "locked" — once per journey
  useEffect(() => {
    if (hasFired.current) return;
    if (!routePoints?.length || routePoints.length < 2) return;
    if (!['suggested', 'locked', 'active'].includes(phase)) return;

    hasFired.current = true;
    runDetection();
  }, [phase, routePoints]);

  const runDetection = async () => {
    try {
      const existingIds = (existingStops || [])
        .map(s => s.location?.id)
        .filter(Boolean);

      const res = await base44.functions.invoke("detectMissedOpportunities", {
        routePoints,
        userLat: null,
        userLng: null,
        existingStopIds: existingIds,
        alreadyShownIds: [...skippedIds],
        mode: mode || 'drive',
        routeDistKm: routeDistKm || 0,
        intentTags: intentTags || [],
      });

      if (!res?.data?.triggered || !res.data.suggestions?.length) return;

      const newSuggestions = res.data.suggestions.filter(s => !skippedIds.has(s.location.id));
      if (newSuggestions.length === 0) return;

      setSuggestions(newSuggestions);
      setShownIds(prev => {
        const next = new Set(prev);
        newSuggestions.forEach(s => next.add(s.location.id));
        return next;
      });

      // Show first suggestion after a short delay (feels more natural)
      setTimeout(() => {
        setActiveSuggestion(newSuggestions[0]);
      }, 1800);

    } catch {
      // Silent — this is an enhancement, not core flow
    }
  };

  const handleSkip = (locationId) => {
    setSkippedIds(prev => new Set([...prev, locationId]));
    setActiveSuggestion(null);

    // Show next suggestion after a pause (if any)
    const remaining = suggestions.filter(
      s => s.location.id !== locationId && !skippedIds.has(s.location.id)
    );
    if (remaining.length > 0) {
      setTimeout(() => setActiveSuggestion(remaining[0]), 2500);
    }

    // Update user profile (learning signal)
    const skipped = suggestions.find(s => s.location.id === locationId);
    trackJourneyEvent('missed_opportunity_skipped', {
      detour_minutes: skipped?.detour_minutes || 0,
      category: skipped?.location?.category || 'other',
    });
  };

  const handleAdd = (suggestion) => {
    setActiveSuggestion(null);
    setSkippedIds(prev => new Set([...prev, suggestion.location.id]));

    // Update user profile (learning signal)
    trackJourneyEvent('missed_opportunity_accepted', {
      detour_minutes: suggestion.detour_minutes || 0,
      category: suggestion.location?.category || 'other',
    });

    if (onAddStop) onAddStop(suggestion);
  };

  if (!activeSuggestion) return null;

  return (
    <AnimatePresence>
      <MissedOpportunityCard
        key={activeSuggestion.location.id}
        suggestion={activeSuggestion}
        onAdd={handleAdd}
        onSkip={handleSkip}
      />
    </AnimatePresence>
  );
}