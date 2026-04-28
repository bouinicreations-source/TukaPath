import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/client";
import ConciergeChat from "@/components/concierge/ConciergeChat";
import ConciergeJourneyView from "@/components/concierge/ConciergeJourneyView";

const STAGE_DELAYS = [0, 800, 1600, 2800, 4200, 5500];

export default function AIConcierge() {
  const [phase, setPhase]     = useState("chat");   // chat | building | journey
  const [error, setError]     = useState(null);
  const [journey, setJourney] = useState(null);
  const [stage, setStage]     = useState(0);
  const [building, setBuilding] = useState(false);
  const [refinements, setRefinements] = useState([]);
  const [refining, setRefining]       = useState(false);

  // Store the raw prompt + journeyState for the build call
  const buildDataRef = useRef({ prompt: "", journeyState: null });

  const stageTimersRef = useRef([]);
  const clearStageTimers = () => {
    stageTimersRef.current.forEach(t => clearTimeout(t));
    stageTimersRef.current = [];
  };

  // ── Called by ConciergeChat when user hits "Plan my journey" ───────────────
  // prompt = text string (backward compat), structuredPlan = full Part 10 object
  const handleBuild = async (prompt, structuredPlan) => {
    buildDataRef.current = { prompt, structuredPlan };
    setPhase("building");
    setStage(1);
    setBuilding(true);
    setError(null);

    const journeyState = structuredPlan?._journeyState || structuredPlan || {};

    clearStageTimers();
    [2, 3, 4, 5].forEach((s, i) => {
      const t = setTimeout(() => setStage(s), STAGE_DELAYS[i + 1]);
      stageTimersRef.current.push(t);
    });

    try {
      const res = await base44.functions.invoke("buildConciergeJourney", {
        user_input: prompt,
        existing_plan: structuredPlan?.plan_status === "ready" ? structuredPlan : undefined,
        stage_requested: "full",
        target_stop_count: structuredPlan?._targetStopCount || null,
        duration_days: journeyState?.duration_days || structuredPlan?.duration_days || null,
        // Pass anchor chain explicitly so worker does not re-parse incorrectly
        anchor_cities: journeyState?.anchors?.length > 0 ? journeyState.anchors : undefined,
        city_durations: journeyState?.city_durations?.length > 0 ? journeyState.city_durations : undefined,
      });
      const data = res;
      if (data?.journey) {
        const j = data.journey;
        const segs = j.segments || [];
        const totalKm = j.total_distance_km || 0;
        const durationDays = journeyState?.duration_days || structuredPlan?.duration_days || null;
        const MAX_KM_PER_DAY = 550;

        const needsMultiSeg = durationDays >= 2 || totalKm > MAX_KM_PER_DAY;
        const segFail = needsMultiSeg && segs.length < 2;
        const kmPerSeg = segs.length > 0 ? totalKm / segs.length : totalKm;
        const distFail = kmPerSeg > MAX_KM_PER_DAY;
        const totalStops = segs.reduce((s, seg) => s + (seg.stops || []).length, 0);
        const minStops = Math.max(2, (durationDays || 1) * 2);
        const stopFail = needsMultiSeg && totalStops < minStops;

        if (segFail || distFail || stopFail) {
          const failReason = segFail
            ? `Only ${segs.length} segment(s) returned for a ${Math.round(totalKm)}km trip. Must have at least 2.`
            : distFail
            ? `Daily distance ${Math.round(kmPerSeg)}km exceeds 550km limit. Must split into more legs.`
            : `Only ${totalStops} stops for a ${durationDays || 1}-day trip. Minimum is ${minStops}.`;

          const retryRes = await base44.functions.invoke("buildConciergeJourney", {
            user_input: prompt + `\n\nCRITICAL CONSTRAINTS: This is ${Math.round(totalKm)}km total. MUST have at least 2 segments (overnight required). MUST have at least ${minStops} stops total. Max 550km per day. Previous attempt failed: ${failReason}`,
            existing_plan: structuredPlan?.plan_status === "ready" ? structuredPlan : undefined,
            stage_requested: "full",
            duration_days: durationDays,
            anchor_cities: journeyState?.anchors?.length > 0 ? journeyState.anchors : undefined,
            city_durations: journeyState?.city_durations?.length > 0 ? journeyState.city_durations : undefined,
          });
          const retryData = retryRes; // worker returns JSON directly, no .data wrapper
          if (retryData?.journey) {
            clearStageTimers();
            setJourney(retryData.journey);
            setStage(6);
            setPhase("journey");
          } else {
            clearStageTimers();
            setError(retryData?.error || "Couldn't build the journey. Please try again.");
            setStage(0);
          }
        } else {
          clearStageTimers();
          setJourney(j);
          setStage(6);
          setPhase("journey");
        }
      } else {
        clearStageTimers();
        setError(data?.error || "Couldn't build the journey. Please try again.");
        setStage(0);
      }
    } catch (e) {
      clearStageTimers();
      setError(e.message || "Something went wrong. Please try again.");
      setStage(0);
    }
    setBuilding(false);
  };

  // ── Refinements (from journey view) ───────────────────────────────────────
  const handleRefine = async (refinement) => {
    const newRefinements = [...refinements, refinement];
    setRefinements(newRefinements);
    setRefining(true);


    // Compute adjusted stop count for density chips
    const currentTarget = buildDataRef.current.structuredPlan?._targetStopCount || null;
    let adjustedStopCount = currentTarget;
    if (refinement.key === "more_stops" && currentTarget) adjustedStopCount = Math.min(currentTarget + 3, 18);
    if (refinement.key === "fewer_stops" && currentTarget) adjustedStopCount = Math.max(currentTarget - 2, 2);

    try {
      const res = await base44.functions.invoke("buildConciergeJourney", {
        user_input: buildDataRef.current.prompt,
        existing_plan: buildDataRef.current.structuredPlan?.plan_status === "ready"
          ? buildDataRef.current.structuredPlan : undefined,
        existing_journey: journey,
        refinements: newRefinements,
        stage_requested: "full",
        target_stop_count: adjustedStopCount,
      });
      const data = res;
      if (data?.journey) setJourney(data.journey);
    } catch {}
    setRefining(false);
  };

  // ── Custom text refinement — routes back to chat with text pre-seeded ────
  const handleCustomRefine = (text) => {
    // Store the custom text in sessionStorage so ConciergeChat can pick it up
    sessionStorage.setItem("tp_concierge_refine_input", text);
    setPhase("chat");
  };

  const handleReset = () => {
    setPhase("chat");
    setJourney(null);
    setStage(0);
    setRefinements([]);
    setError(null);
    setBuilding(false);
    clearStageTimers();
  };

  return (
    <div className="max-w-lg mx-auto px-4 flex flex-col bg-muted/30" style={{ height: "calc(100dvh - 64px)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 py-5 flex-shrink-0">
        {phase === "chat" ? (
          <Link to="/Home">
            <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
        ) : (
          <button onClick={handleReset}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Concierge
          </h1>
          <p className="text-xs text-muted-foreground">
            {phase === "chat"     && "Let's plan your trip"}
            {phase === "building" && "Designing your journey…"}
            {phase === "journey"  && "Your journey is ready"}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">

          {/* CHAT (interview + recap) */}
          {phase === "chat" && (
            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="h-full">
              <ConciergeChat onBuild={handleBuild} building={building} error={error} />
            </motion.div>
          )}

          {/* BUILDING + JOURNEY */}
          {(phase === "building" || phase === "journey") && (
            <motion.div key="journey" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="h-full overflow-y-auto pb-28 no-scrollbar">
              {error ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                    <span className="text-destructive text-xl">!</span>
                  </div>
                  <p className="text-sm text-destructive font-medium">{error}</p>
                  <button
                    onClick={handleReset}
                    className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    Go back & try again
                  </button>
                </div>
              ) : (
                <ConciergeJourneyView
                  journey={journey}
                  stage={stage}
                  onRefine={handleRefine}
                  refining={refining}
                  onCustomRefine={handleCustomRefine}
                />
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}