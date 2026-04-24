import React, { useState, useEffect, useRef } from "react";
import { supabase } from '@/api/supabase';
import { base44 } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Upload, Clock, ChevronRight, Plus, Eye, GitBranch } from "lucide-react";

const JOURNEY_LOGIC_INITIAL = `/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TUKAPATH — JOURNEY LOGIC SPECIFICATION  v2.0
 * Module: journey_logic  |  Language: JavaScript
 * Status: ACTIVE
 *
 * This is the editable source of truth for the TukaPath journey engine.
 * Rules here will progressively replace hardcoded logic in buildJourney.js.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — ZONE ASSIGNMENT
// ─────────────────────────────────────────────────────────────────────────────

const ZONES = {
  /**
   * Each candidate location is classified into exactly one zone:
   *   ORIGIN_ZONE      — within origin radius of the start point
   *   CORRIDOR         — along the route axis, outside origin/destination zones
   *   DESTINATION_ZONE — within destination radius of the end point
   *
   * Destination-zone locations are EXCLUDED from the main route selection.
   * They are surfaced separately as "Arrival Suggestions" (see Section 11).
   */

  origin: {
    radius_km: "dynamic",  // see CORRIDOR.zoneRadiusKm()
    classification: "ORIGIN_ZONE",
  },

  destination: {
    radius_km: "dynamic",  // 15% of total route distance, min 5 km
    classification: "DESTINATION_ZONE",
    handling: "arrival_suggestions",  // never included in main route
  },

  corridor: {
    classification: "CORRIDOR",
    handling: "main_route_selection",
  },

  // Runtime classification function (pseudocode)
  classify(location, startPt, destPt, routeDistKm) {
    const distFromStart = haversineKm(location, startPt);
    const distFromDest  = haversineKm(location, destPt);
    const destZoneRadius = Math.max(routeDistKm * 0.15, 5);
    const originZoneRadius = Math.max(routeDistKm * 0.10, 3);

    if (distFromDest <= destZoneRadius)  return "DESTINATION_ZONE";
    if (distFromStart <= originZoneRadius) return "ORIGIN_ZONE";
    return "CORRIDOR";
  },
};


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — CORRIDOR RULES
// ─────────────────────────────────────────────────────────────────────────────

const CORRIDOR = {
  /**
   * Corridor width = maximum perpendicular distance a stop may sit
   * from the straight line between origin and destination.
   *
   * Width is distance-adaptive to avoid absurdly wide bands on short trips
   * and overly narrow bands on long journeys.
   */

  widthKm(routeDistKm, routeStyle) {
    let base;
    if      (routeDistKm < 100)  base = 10;
    else if (routeDistKm < 300)  base = 20;
    else if (routeDistKm < 700)  base = 35;
    else                          base = 50;

    const scenicMultiplier = routeStyle === "scenic" ? 1.5 : 1.0;
    return base * scenicMultiplier;
  },

  // Zone radii (used by ZONES.classify)
  zoneRadiusKm(routeDistKm) {
    return {
      origin:      Math.max(routeDistKm * 0.10, 3),
      destination: Math.max(routeDistKm * 0.15, 5),
    };
  },

  // Acceptance rules — ALL must pass
  acceptanceRules: [
    "stop.perpendicularDistanceFromAxis <= CORRIDOR.widthKm(routeDistKm, routeStyle)",
    "stop.zone === 'CORRIDOR'  (not DESTINATION_ZONE)",
    "forwardProgressionCheck passes  (see Section 3)",
    "loopBackCheck passes             (see Section 4)",
  ],
};


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — FORWARD PROGRESSION
// ─────────────────────────────────────────────────────────────────────────────

const FORWARD_PROGRESSION = {
  /**
   * Each selected stop must advance progress along the route axis.
   * Progress t = 0 (at origin) → 1 (at destination).
   *
   * Small regressions are allowed to accommodate slight zigzag
   * without triggering a false positive.
   */

  rule: "stop.progress >= previous_stop.progress - 0.05",

  tolerance: 0.05,  // 5% regression allowed

  check(stopProgress, previousProgress) {
    return stopProgress >= previousProgress - this.tolerance;
  },

  // For loop journeys (no destination), progress is measured from
  // the outward arc apex, not from the start point.
  loopProgressReference: "outward_arc_apex",
};


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — LOOP-BACK RULE
// ─────────────────────────────────────────────────────────────────────────────

const LOOP_BACK = {
  /**
   * Prevents stops that would require driving back along an already-driven
   * road segment, creating an out-and-back detour.
   *
   * Exception: destination-zone stops are exempt (see Section 11).
   */

  rejectThresholdKm: 15,

  rule: "reject stop if it sits within 15 km of any previously-traversed route segment, unless stop.zone === 'DESTINATION_ZONE'",

  check(stop, traversedSegments, destZoneExempt) {
    if (destZoneExempt && stop.zone === "DESTINATION_ZONE") return true;  // always accept
    const nearestTraversedKm = minDistanceToTraversedSegments(stop, traversedSegments);
    return nearestTraversedKm >= this.rejectThresholdKm;
  },

  // Practical approximation used at runtime:
  // if perp offset > 70% of distance-from-current → out-and-back → reject
  runtimeApproximation: "perpKm > distFromCurrent * 0.70 → reject",
};


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — STOP CLASSES
// ─────────────────────────────────────────────────────────────────────────────

const STOP_CLASSES = {
  /**
   * Every stop selected by the engine is assigned exactly one class.
   * Class determines time accounting, detour limits, and UI labeling.
   */

  A: {
    label: "Main Stop",
    visitDuration: "full dwell (from DWELL_DEFAULTS or user override)",
    timeWeight: 1.0,       // counted at 100% toward time budget
    detourLimit: null,     // no strict per-stop detour limit
    uiRole: ["anchor", "highlight"],
    notes: "High quality, has audio/story preferred. Top 2 by score.",
  },

  B: {
    label: "Quick Stop",
    visitDuration: { max_minutes: 20 },
    timeWeight: 0.5,       // counted at 50% toward time budget
    detourLimit: { each_direction_minutes: 5 },
    uiLabels: ["Quick stop", "See from outside", "Worth 20 min if you can"],
    uiRole: ["connector"],
    notes: "Lightweight stop that adds colour without derailing pace.",
  },

  C: {
    label: "Arrival Suggestion",
    visitDuration: "not constrained by route budget",
    timeWeight: 0,         // NOT counted toward route time
    handledBy: "arrival_suggestions",
    uiLabel: "Once you arrive",
    notes: "Stops inside destination zone. Shown after route ends.",
  },

  // Assignment logic
  assign(stop, rankedStops) {
    if (stop.zone === "DESTINATION_ZONE") return "C";
    const rank = rankedStops.indexOf(stop);
    if (rank <= 1) return "A";  // top 2 = Main Stops
    if (stop.dwell_minutes <= 20) return "B";  // short dwell = Quick Stop
    return "A";  // all others default to A
  },
};


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — TIME MODES
// ─────────────────────────────────────────────────────────────────────────────

const TIME_MODES = {
  /**
   * Controls how strictly the engine enforces the time budget.
   */

  fixed: {
    label: "Fixed",
    description: "User has set a specific time limit (e.g. 90 min, 3 hours).",
    tolerancePercent: 10,     // may go up to +10% over stated time
    bufferPercent: 10,        // reserve 10% of budget for transit uncertainty
    stopCountMax: null,       // derived from time + stop durations
    notes: "Strict. Reject any stop whose cost exceeds remaining * 0.85.",
  },

  full_day: {
    label: "Full Day",
    description: "User has a full day available (~480 min).",
    tolerancePercent: 20,
    bufferPercent: 15,
    stopCountRange: [3, 6],
    pacing: "relaxed",
    notes: "Prefer a curated 4–5 stop day over exhausting 8+ stop list.",
  },

  flexible: {
    label: "Flexible",
    description: "No time ceiling. User is not in a hurry.",
    tolerancePercent: null,
    bufferPercent: 0,
    stopCountMax: null,
    constraint: "realism only",  // stops must be reachable in a reasonable sequence
    notes: "Build the best possible journey regardless of clock.",
  },
};


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — DETOUR RULES
// ─────────────────────────────────────────────────────────────────────────────

const DETOUR_RULES = {
  /**
   * A detour is any travel that deviates from the direct corridor path.
   * Detours are measured as out-only distance (the return is implicit).
   */

  maxDetourMinutes: {
    standard: 15,
    scenic: 30,
  },

  // Hard constraints
  constraints: [
    "detour must stay within corridor width (CORRIDOR.widthKm)",
    "total detour time (out + return) must not exceed 2 × maxDetourMinutes",
    "no 30-min-out + 30-min-back loops permitted under any mode",
  ],

  // Class B quick stop override
  classBOverride: {
    each_direction_minutes: 5,
    note: "Class B stops have stricter detour limit regardless of mode",
  },

  check(stop, mode, stopClass) {
    const limit = stopClass === "B"
      ? this.classBOverride.each_direction_minutes
      : this.maxDetourMinutes[mode] || this.maxDetourMinutes.standard;
    return stop.detour_minutes <= limit;
  },
};


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8 — SEGMENT RULES
// ─────────────────────────────────────────────────────────────────────────────

const SEGMENT_RULES = {
  /**
   * A segment is the travel leg between two consecutive stops.
   * Segments that are too short or too long degrade the journey experience.
   */

  minSegmentMinutes: 8,

  tooShortAction: "merge or remove one of the stops (prefer the lower-quality one)",
  tooFarAction:   "attempt quick stop (Class B) insertion in the gap",

  idealRangeMinutes: { min: 8, max: 35 },

  check(segmentMinutes) {
    if (segmentMinutes < this.minSegmentMinutes) return "TOO_SHORT";
    if (segmentMinutes > this.idealRangeMinutes.max) return "TOO_FAR";
    return "OK";
  },
};


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9 — FALLBACK RULES
// ─────────────────────────────────────────────────────────────────────────────

const FALLBACK_RULES = {
  /**
   * When the dataset has insufficient stops in the requested area,
   * the engine must degrade gracefully rather than fail.
   *
   * Priority: quality over quantity.
   */

  principle: "fewer but stronger stops > many weak stops > no stops",

  steps: [
    {
      step: 1,
      action:       "Use standard corridor, full stop count",
      corridorMult: 1.0,
      stopCountMult: 1.0,
      message:      null,
    },
    {
      step: 2,
      action:       "Widen corridor by 1.5×",
      corridorMult: 1.5,
      stopCountMult: 1.0,
      message:      "Widened search area to find stops nearby.",
    },
    {
      step: 3,
      action:       "Widen corridor by 2.5×, reduce stops to 60%",
      corridorMult: 2.5,
      stopCountMult: 0.6,
      message:      "Matched with best available stops in this area.",
    },
    {
      step: 4,
      action:       "Maximum corridor, reduce stops to 40%",
      corridorMult: 4.0,
      stopCountMult: 0.4,
      message:      "Built with best available match. Some stop types not yet available here.",
    },
  ],

  hardConstraints: [
    "NEVER fabricate a stop",
    "NEVER return a stop outside the database",
    "ALWAYS surface partial_match_note when degraded",
    "If zero stops found after all steps → return error: no_stops",
  ],
};


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10 — USER-FACING LABELS
// ─────────────────────────────────────────────────────────────────────────────

const USER_LABELS = {
  /**
   * Labels shown on stop cards. Mapped from stop class and detour/time data.
   */

  stopTypeLabels: {
    quickStop:         "Quick stop",
    seeFromOutside:    "See from outside",
    worth20min:        "Worth 20 min if you can",
    onRoute:           "On route",
    detour:            "+{n} min detour",
  },

  // Mapping rule: select label based on class + detour data
  selectLabel(stop) {
    if (stop.class === "B" && stop.detour_minutes === 0) return this.stopTypeLabels.onRoute;
    if (stop.class === "B" && stop.detour_minutes <= 5)  return this.stopTypeLabels.quickStop;
    if (stop.class === "B" && stop.detour_minutes <= 10) return this.stopTypeLabels.worth20min;
    if (stop.class === "A" && stop.detour_minutes === 0) return this.stopTypeLabels.onRoute;
    return this.stopTypeLabels.detour.replace("{n}", stop.detour_minutes);
  },
};


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 11 — ARRIVAL-ZONE HANDLING
// ─────────────────────────────────────────────────────────────────────────────

const ARRIVAL_ZONE = {
  /**
   * Stops inside the destination zone are NOT part of the route.
   * They are surfaced after the route ends as contextual suggestions.
   */

  classification: "DESTINATION_ZONE",
  excludedFromRoute: true,
  uiSection: "Once you arrive",
  maxSuggestions: 3,
  sortBy: "quality DESC, distFromDestination ASC",

  // These are shown in a separate UI section after the confirmed route.
  // They do NOT count toward route time or stop budget.
  // They are selected from the top-scored locations within destination zone.

  select(candidates, destLat, destLng) {
    return candidates
      .filter(c => c.zone === "DESTINATION_ZONE")
      .sort((a, b) => b.quality - a.quality)
      .slice(0, this.maxSuggestions);
  },
};


// ─────────────────────────────────────────────────────────────────────────────
// RUNTIME EXECUTION ORDER
// ─────────────────────────────────────────────────────────────────────────────

const EXECUTION_ORDER = [
  "1. Classify all candidates → ZONES.classify()",
  "2. Separate DESTINATION_ZONE candidates → ARRIVAL_ZONE.select()",
  "3. Filter CORRIDOR candidates:",
  "     a. corridorWidth check        → CORRIDOR.widthKm()",
  "     b. forward progression check  → FORWARD_PROGRESSION.check()",
  "     c. loop-back check            → LOOP_BACK.check()",
  "4. Score remaining candidates      → SCORING constants",
  "5. Select stops by time mode       → TIME_MODES[mode]",
  "6. Validate segment gaps           → SEGMENT_RULES.check()",
  "7. Apply fallback if needed        → FALLBACK_RULES.steps",
  "8. Assign stop classes             → STOP_CLASSES.assign()",
  "9. Apply detour rules              → DETOUR_RULES.check()",
  "10. Apply user-facing labels       → USER_LABELS.selectLabel()",
  "11. Append arrival suggestions     → ARRIVAL_ZONE.select()",
];


// ─────────────────────────────────────────────────────────────────────────────
// SCORING CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const SCORING = {
  intentMatchMax:       40,  // points for full theme tag match
  qualityMax:           20,  // ratings + listens signal
  audioBonus:            8,  // has_audio
  storyBonus:            4,  // has_story only
  diversityPenalty:    -15,  // same category as previous stop
  idealSpacingBonus:    10,  // 8–35 min travel from prev stop
  tooClosePenalty:     -20,  // <2 min travel
  tooFarPenalty:       -15,  // >40 min travel
  scenicTagMax:         25,  // scenic mode: scenic tag pts (8pt/tag, capped)
  scenicIndoorPenalty: -10,  // scenic mode: museum/religious
  scenicClusterMax:      8,  // scenic mode: nearby scenic cluster bonus
};


// ─────────────────────────────────────────────────────────────────────────────
// DWELL DEFAULTS (minutes per category)
// ─────────────────────────────────────────────────────────────────────────────

const DWELL_DEFAULTS = {
  landmark:    20,
  statue:      10,
  monument:    15,
  hidden_spot: 20,
  museum:      45,
  park:        25,
  religious:   20,
  bridge:      10,
  tower:       25,
  square:      15,
  other:       15,
};
`;

const JOURNEY_LOGIC_VERSION = 2;
const JOURNEY_LOGIC_NOTES = `v2.0 — Full specification: 11 sections covering Zone Assignment, Corridor Rules, Forward Progression, Loop-Back, Stop Classes (A/B/C), Time Modes, Detour Rules, Segment Rules, Fallback Rules, User Labels, Arrival Zone Handling. Execution order documented. Structured as executable JS module. Ready for progressive migration from buildJourney.js.`;


const LANGUAGE_COLORS = {
  JavaScript: "bg-yellow-100 text-yellow-800",
  TypeScript: "bg-blue-100 text-blue-800",
  "JSON Rules": "bg-green-100 text-green-800",
  "Plain Text Spec": "bg-slate-100 text-slate-700",
};

const STATUS_COLORS = {
  active: "bg-emerald-100 text-emerald-800",
  draft: "bg-amber-100 text-amber-700",
  archived: "bg-slate-100 text-slate-500",
};

export default function AdminLogicLab() {
  const [modules, setModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [versions, setVersions] = useState([]);
  const [editingVersion, setEditingVersion] = useState(null);
  const [viewingOld, setViewingOld] = useState(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [user, setUser] = useState(null);
  const [view, setView] = useState("list"); // list | editor | history | readonly
  const [syntaxError, setSyntaxError] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(r => r.data.user).then(setUser).catch(() => {});
    loadModules();
  }, []);

  const loadModules = async () => {
    const mods = await base44.entities.LogicModule.list("-updated_date");
    setModules(mods);
    // Seed journey_logic if missing
    if (mods.length === 0 || !mods.find(m => m.module_key === "journey_logic")) {
      await seedJourneyLogic(mods);
    }
  };

  const seedJourneyLogic = async (existing) => {
    const existingMod = existing.find(m => m.module_key === "journey_logic");

    if (existingMod) {
      // Module exists — check if v2 is already stored
      const vers = await base44.entities.LogicModuleVersion.filter({ module_id: existingMod.id });
      const hasV2 = vers.some(v => v.version_number >= JOURNEY_LOGIC_VERSION);
      if (hasV2) return; // already up to date

      // Archive current active
      const currentActive = vers.find(v => v.status === "active");
      if (currentActive) {
        await base44.entities.LogicModuleVersion.update(currentActive.id, { status: "archived" });
      }
      // Create v2 as active
      const ver = await base44.entities.LogicModuleVersion.create({
        module_id: existingMod.id,
        module_key: "journey_logic",
        version_number: JOURNEY_LOGIC_VERSION,
        language: "JavaScript",
        code_content: JOURNEY_LOGIC_INITIAL,
        status: "active",
        internal_notes: JOURNEY_LOGIC_NOTES,
        published_at: new Date().toISOString(),
        updated_by: "system",
      });
      await base44.entities.LogicModule.update(existingMod.id, {
        active_version_id: ver.id,
        active_version_number: JOURNEY_LOGIC_VERSION,
      });
      setModules(prev => prev.map(m => m.id === existingMod.id
        ? { ...m, active_version_id: ver.id, active_version_number: JOURNEY_LOGIC_VERSION }
        : m
      ));
      return;
    }

    // Module doesn't exist — create it with v2 active
    const mod = await base44.entities.LogicModule.create({
      module_key: "journey_logic",
      module_name: "Journey Logic",
      description: "Route engine rules: zones, corridor, scoring, stop classes, time modes, fallback. Editable source of truth for journey generation.",
      default_language: "JavaScript",
      active_version_number: 0,
    });
    const ver = await base44.entities.LogicModuleVersion.create({
      module_id: mod.id,
      module_key: "journey_logic",
      version_number: JOURNEY_LOGIC_VERSION,
      language: "JavaScript",
      code_content: JOURNEY_LOGIC_INITIAL,
      status: "active",
      internal_notes: JOURNEY_LOGIC_NOTES,
      published_at: new Date().toISOString(),
      updated_by: "system",
    });
    await base44.entities.LogicModule.update(mod.id, {
      active_version_id: ver.id,
      active_version_number: JOURNEY_LOGIC_VERSION,
    });
    setModules(prev => [...prev, { ...mod, active_version_id: ver.id, active_version_number: JOURNEY_LOGIC_VERSION }]);
  };

  const openModule = async (mod) => {
    setSelectedModule(mod);
    const vers = await base44.entities.LogicModuleVersion.filter({ module_id: mod.id });
    vers.sort((a, b) => b.version_number - a.version_number);
    setVersions(vers);
    setSyntaxError(null);
    
    // Priority: load active version from module.active_version_id, then latest draft, then latest any
    let toEdit = null;
    if (mod.active_version_id) {
      toEdit = vers.find(v => v.id === mod.active_version_id);
    }
    if (!toEdit) {
      toEdit = vers.find(v => v.status === "draft");
    }
    if (!toEdit && vers.length > 0) {
      toEdit = vers[0];
    }
    
    if (toEdit) {
      setEditingVersion({ ...toEdit });
    }
    setView("editor");
  };

  const validateCode = (code) => {
    try {
      new Function(code);
      return null;
    } catch (err) {
      return `Syntax error: ${err.message}`;
    }
  };

  const saveDraft = async () => {
    if (!editingVersion) return;
    
    // Validate before saving
    const error = validateCode(editingVersion.code_content);
    if (error) {
      setSyntaxError(error);
      return;
    }
    setSyntaxError(null);
    setSaving(true);
    try {
      if (editingVersion.id) {
        await base44.entities.LogicModuleVersion.update(editingVersion.id, {
          code_content: editingVersion.code_content,
          internal_notes: editingVersion.internal_notes,
          status: editingVersion.status === "archived" ? "archived" : "draft",
          updated_by: user?.email || "admin",
        });
      } else {
        const maxVer = versions.reduce((m, v) => Math.max(m, v.version_number), 0);
        const newVer = await base44.entities.LogicModuleVersion.create({
          module_id: selectedModule.id,
          module_key: selectedModule.module_key,
          version_number: maxVer + 1,
          language: editingVersion.language || selectedModule.default_language,
          code_content: editingVersion.code_content,
          internal_notes: editingVersion.internal_notes || "",
          status: "draft",
          updated_by: user?.email || "admin",
        });
        setEditingVersion(newVer);
      }
      const vers = await base44.entities.LogicModuleVersion.filter({ module_id: selectedModule.id });
      vers.sort((a, b) => b.version_number - a.version_number);
      setVersions(vers);
    } finally {
      setSaving(false);
    }
  };

  const publishVersion = async () => {
    if (!editingVersion?.id) { await saveDraft(); return; }
    
    // Validate before publishing
    const error = validateCode(editingVersion.code_content);
    if (error) {
      setSyntaxError(error);
      return;
    }
    setSyntaxError(null);
    setPublishing(true);
    try {
      // Step 1: Update LogicModule.active_version_id to establish the source of truth immediately
      await base44.entities.LogicModule.update(selectedModule.id, {
        active_version_id: editingVersion.id,
        active_version_number: editingVersion.version_number,
      });

      // Step 2: Demote ALL other 'active' versions for this module to 'archived'
      const allActive = versions.filter(v => v.status === "active" && v.id !== editingVersion.id);
      for (const old of allActive) {
        await base44.entities.LogicModuleVersion.update(old.id, { status: "archived" });
      }

      // Step 3: Promote the selected version to 'active'
      await base44.entities.LogicModuleVersion.update(editingVersion.id, {
        status: "active",
        version_number: editingVersion.version_number,
        published_at: new Date().toISOString(),
        updated_by: user?.email || "admin",
        code_content: editingVersion.code_content,
        internal_notes: editingVersion.internal_notes,
      });
      setEditingVersion(prev => ({ ...prev, status: "active" }));
      const vers = await base44.entities.LogicModuleVersion.filter({ module_id: selectedModule.id });
      vers.sort((a, b) => b.version_number - a.version_number);
      setVersions(vers);
    } finally {
      setPublishing(false);
    }
  };

  const newDraftFromActive = () => {
    const active = versions.find(v => v.status === "active");
    if (!active) return;
    const maxVer = versions.reduce((m, v) => Math.max(m, v.version_number), 0);
    setEditingVersion({
      module_id: selectedModule.id,
      module_key: selectedModule.module_key,
      version_number: maxVer + 1,
      language: active.language,
      code_content: active.code_content,
      internal_notes: "",
      status: "draft",
    });
    setView("editor");
  };

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-primary" /> Logic Lab
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Editable logic modules. Version-controlled. Safe to modify without redeployment.</p>
        </div>

        {modules.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto mb-4" />
            Loading modules…
          </div>
        ) : (
          <div className="space-y-3">
            {modules.map(mod => (
              <button key={mod.id} onClick={() => openModule(mod)}
                className="w-full flex items-start gap-4 p-4 bg-card border border-border rounded-xl hover:border-primary/30 hover:bg-primary/5 transition-all text-left group">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <GitBranch className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{mod.module_name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${LANGUAGE_COLORS[mod.default_language] || "bg-slate-100 text-slate-600"}`}>
                      {mod.default_language}
                    </span>
                    {mod.active_version_number > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                        v{mod.active_version_number} active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{mod.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground flex-shrink-0 mt-1" />
              </button>
            ))}
          </div>
        )}

        <div className="pt-2 border-t border-border text-xs text-muted-foreground">
          Upcoming modules: Audio Logic · Review Logic · Suggestion Moderation · Notification Logic
        </div>
      </div>
    );
  }

  // ── EDITOR VIEW ────────────────────────────────────────────────────────────
  if (view === "editor" || view === "readonly") {
    const isReadonly = view === "readonly";
    const displayVersion = isReadonly ? viewingOld : editingVersion;
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => { setView("list"); setSelectedModule(null); }}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold">{selectedModule?.module_name}</span>
              {displayVersion && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[displayVersion.status] || "bg-slate-100 text-slate-600"}`}>
                  {displayVersion.status}
                </span>
              )}
              {displayVersion?.version_number > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                  v{displayVersion.version_number}
                </span>
              )}
              {isReadonly && <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">read-only</span>}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{selectedModule?.description}</p>
          </div>
          <button onClick={() => setView("history")}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted px-3 py-1.5 rounded-lg transition-colors flex-shrink-0">
            <Clock className="w-3.5 h-3.5" /> History
          </button>
        </div>

        {/* Syntax error alert */}
        {syntaxError && !isReadonly && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <p className="text-xs text-destructive font-semibold mb-1">⚠ Syntax Error</p>
            <p className="text-xs text-destructive/80 font-mono">{syntaxError}</p>
          </div>
        )}

        {/* Code editor */}
        <div className={`rounded-xl border overflow-hidden ${syntaxError ? "border-destructive/30" : "border-border"}`}>
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700">
            <span className="text-[11px] text-slate-400 font-mono">{selectedModule?.module_key}.js</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${LANGUAGE_COLORS[displayVersion?.language] || "bg-slate-700 text-slate-300"}`}>
              {displayVersion?.language || selectedModule?.default_language}
            </span>
          </div>
          <textarea
            value={displayVersion?.code_content || ""}
            onChange={e => !isReadonly && setEditingVersion(prev => ({ ...prev, code_content: e.target.value }))}
            readOnly={isReadonly}
            spellCheck={false}
            className={`w-full bg-slate-950 text-slate-200 font-mono text-[12px] leading-relaxed p-4 resize-none focus:outline-none ${syntaxError ? "ring-1 ring-destructive/30" : ""}`}
            style={{ minHeight: "480px", fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace" }}
          />
        </div>

        {/* Version number */}
        {!isReadonly && (
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Version Number</label>
            <input
              type="number"
              step="0.1"
              value={editingVersion?.version_number || ""}
              onChange={e => setEditingVersion(prev => ({ ...prev, version_number: parseFloat(e.target.value) || 0 }))}
              className="w-32 px-3 py-2 rounded-xl bg-muted/50 border border-border text-sm font-mono focus:outline-none focus:border-primary/30"
            />
          </div>
        )}

        {/* Notes */}
        {!isReadonly && (
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Internal Notes</label>
            <textarea
              value={editingVersion?.internal_notes || ""}
              onChange={e => setEditingVersion(prev => ({ ...prev, internal_notes: e.target.value }))}
              placeholder="What changed in this version? Any known risks or migration notes?"
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:border-primary/30 resize-none"
              rows={3}
            />
          </div>
        )}

        {isReadonly && viewingOld?.internal_notes && (
          <div className="p-3 rounded-xl bg-muted/50 border border-border">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Notes for this version</p>
            <p className="text-xs text-muted-foreground">{viewingOld.internal_notes}</p>
          </div>
        )}

        {/* Actions */}
        {!isReadonly && (
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="rounded-xl flex items-center gap-2" onClick={saveDraft} disabled={saving}>
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving…" : "Save Draft"}
            </Button>
            <Button className="rounded-xl flex items-center gap-2 bg-primary hover:bg-primary/90" onClick={publishVersion} disabled={publishing}>
              <Upload className="w-3.5 h-3.5" />
              {publishing ? "Publishing…" : "Publish Active Version"}
            </Button>
          </div>
        )}

        {isReadonly && (
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="rounded-xl" onClick={() => setView("history")}>
              ← Back to History
            </Button>
            <Button className="rounded-xl" onClick={newDraftFromActive}>
              Branch from this version
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── HISTORY VIEW ────────────────────────────────────────────────────────────
  if (view === "history") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("editor")}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <span className="text-sm font-bold">{selectedModule?.module_name} — Version History</span>
            <p className="text-[11px] text-muted-foreground">{versions.length} version{versions.length !== 1 ? "s" : ""}</p>
          </div>
          <Button size="sm" variant="outline" className="ml-auto rounded-lg text-xs" onClick={newDraftFromActive}>
            <Plus className="w-3 h-3 mr-1" /> New Draft
          </Button>
        </div>

        <div className="space-y-2">
          {versions.map(ver => (
            <div key={ver.id}
              className="flex items-start gap-3 p-4 bg-card border border-border rounded-xl hover:border-primary/20 transition-all">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-bold">v{ver.version_number}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[ver.status] || ""}`}>
                    {ver.status}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${LANGUAGE_COLORS[ver.language] || "bg-slate-100 text-slate-600"}`}>
                    {ver.language}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {ver.updated_by && <span>by {ver.updated_by} · </span>}
                  {ver.updated_date ? new Date(ver.updated_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                  {ver.published_at && <span> · published {new Date(ver.published_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>}
                </p>
                {ver.internal_notes && (
                  <p className="text-[11px] text-foreground/60 mt-1 line-clamp-2">{ver.internal_notes}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                <button onClick={() => { setViewingOld(ver); setView("readonly"); }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                  <Eye className="w-3 h-3" /> View
                </button>
                <button onClick={() => { setEditingVersion({ ...ver }); setSyntaxError(null); setView("editor"); }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                  ✏️ Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}