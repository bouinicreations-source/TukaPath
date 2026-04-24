import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";

function getStorageKey(version) {
  return `tuka_onboarding_seen_v${version || "1"}`;
}

export default function OnboardingScreen({ onDone, isGuest }) {
  const [current, setCurrent] = useState(0);
  const [ready, setReady] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);

  const { data: settings = [], isSuccess: settingsLoaded } = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => base44.entities.SiteSettings.list(),
    staleTime: 60000,
  });

  const { data: allSlides = [], isSuccess: slidesLoaded } = useQuery({
    queryKey: ["onboarding-slides"],
    queryFn: () => base44.entities.OnboardingSlide.list("order"),
  });

  const getSetting = (key) => settings.find(s => s.key === key)?.value;

  const onboardingEnabled = getSetting("onboarding_enabled") === "true";
  const forceShow         = getSetting("onboarding_force_show") === "true";
  const version           = getSetting("onboarding_version") || "1";
  const storageKey        = getStorageKey(version);

  const contextKey = isGuest ? "guests" : "logged_in";

  // Build active sorted slide list
  const activeSlides = useMemo(() =>
    allSlides
      .filter(s =>
        s.enabled !== false &&
        s.image_url &&
        ((s.show_contexts?.length ? s.show_contexts : ["guests", "logged_in"]).includes(contextKey))
      )
      .sort((a, b) => (a.order || 0) - (b.order || 0)),
    [allSlides, contextKey]
  );

  useEffect(() => {
    if (!settingsLoaded || !slidesLoaded) return;

    if (!onboardingEnabled || activeSlides.length === 0) {
      onDone?.();
      return;
    }

    const alreadySeen = localStorage.getItem(storageKey) === "true";
    if (forceShow || !alreadySeen) {
      setShouldShow(true);
    } else {
      onDone?.();
    }

    setReady(true);
  }, [settingsLoaded, slidesLoaded, onboardingEnabled, forceShow, storageKey, activeSlides.length]);

  const finish = () => {
    localStorage.setItem(storageKey, "true");
    onDone?.();
  };

  const goToLogin = () => {
    localStorage.setItem(storageKey, "true");
    window.location.href = "/login";
  };

  if (!ready || !shouldShow || activeSlides.length === 0) return null;

  const slide = activeSlides[current];
  const isFinal = current === activeSlides.length - 1;

  const primaryLabel = slide.cta_primary_label || "Start exploring";
  const secondaryLabel = slide.cta_secondary_label || "Unlock full access";
  const nextLabel = slide.next_label || "Next";
  const skipLabel = slide.skip_label || "Skip";

  return (
    <div className="fixed inset-0 z-[9999] bg-black overflow-hidden">
      {/* Slide background */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0"
        >
          {slide.image_url && (
            <img
              src={slide.image_url}
              alt={`Slide ${current + 1}`}
              className="w-full h-full object-cover"
            />
          )}
          {/* Gradient overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
        </motion.div>
      </AnimatePresence>

      {/* Skip button — non-final slides only, if enabled */}
      {!isFinal && slide.show_skip !== false && (
        <button
          onClick={finish}
          className="absolute top-12 right-5 z-10 text-white/80 text-sm font-medium px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
        >
          {skipLabel}
        </button>
      )}

      {/* Text content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`text-${current}`}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="absolute bottom-0 left-0 right-0 px-7 pb-44 text-center"
        >
        </motion.div>
      </AnimatePresence>

      {/* Dot indicators */}
      {activeSlides.length > 1 && (
        <div className="absolute bottom-44 left-0 right-0 flex justify-center gap-2 z-10">
          {activeSlides.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === current ? "w-6 h-2 bg-white" : "w-2 h-2 bg-white/40"
              }`}
            />
          ))}
        </div>
      )}

      {/* Bottom controls */}
      <div className="absolute bottom-8 left-0 right-0 px-8 z-10 flex flex-col items-center gap-2.5">
        {isFinal ? (
          /* Final slide CTAs */
          <>
            <button
              onClick={finish}
              className="w-[86%] max-w-[290px] bg-white text-black font-semibold text-[15px] py-2.5 rounded-full shadow-md hover:bg-white/90 transition-colors"
            >
              {primaryLabel}
            </button>
            {slide.cta_secondary_enabled && (
              <button
                onClick={goToLogin}
                className="w-[86%] max-w-[290px] border border-white/35 text-white font-medium text-[14px] py-2.5 rounded-full backdrop-blur-sm hover:bg-white/10 transition-colors"
              >
                {secondaryLabel}
              </button>
            )}
          </>
        ) : (
          /* Non-final slide: Next button */
          slide.show_next !== false && (
            <button
              onClick={() => setCurrent(c => c + 1)}
              className="flex items-center justify-center gap-2 bg-white text-black font-semibold text-[15px] px-6 py-3 rounded-full shadow-md w-[70%] max-w-[220px] hover:bg-white/90 transition-colors"
            >
              {nextLabel} <ChevronRight className="w-4 h-4" />
            </button>
          )
        )}
      </div>
    </div>
  );
}