import React, { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import useScrollLock from "@/hooks/useScrollLock";

/**
 * Full-screen image viewer with Unsplash attribution.
 * images: array of { url, alt, photographer_name, photographer_url, source }
 * initialIndex: which image to show first
 */
export default function ImageViewer({ images = [], initialIndex = 0, onClose }) {
  useScrollLock();
  const [current, setCurrent] = React.useState(initialIndex);
  const img = images[current];

  const prev = () => setCurrent(c => Math.max(0, c - 1));
  const next = () => setCurrent(c => Math.min(images.length - 1, c + 1));

  React.useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!img) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black flex flex-col overscroll-none touch-none"
        onClick={onClose}
      >
        {/* Close button */}
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Image counter */}
        {images.length > 1 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-white/70 text-sm">
            {current + 1} / {images.length}
          </div>
        )}

        {/* Main image */}
        <div
          className="flex-1 flex items-center justify-center p-4"
          onClick={e => e.stopPropagation()}
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={current}
              src={img.url}
              alt={img.alt || ""}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </AnimatePresence>
        </div>

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              disabled={current === 0}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors disabled:opacity-30"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              disabled={current === images.length - 1}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors disabled:opacity-30"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Attribution bar */}
        <div
          className="flex-shrink-0 px-5 py-3 bg-black/60 backdrop-blur-sm text-center"
          onClick={e => e.stopPropagation()}
        >
          {img.source === "unsplash" && img.photographer_name ? (
            <p className="text-white/70 text-xs">
              Photo by{" "}
              <a href={img.photographer_url} target="_blank" rel="noopener noreferrer" className="text-white underline inline-flex items-center gap-0.5 hover:text-white/90">
                {img.photographer_name} <ExternalLink className="w-3 h-3" />
              </a>
              {" "}on{" "}
              <a href="https://unsplash.com?utm_source=tukapath&utm_medium=referral" target="_blank" rel="noopener noreferrer" className="text-white underline hover:text-white/90">
                Unsplash
              </a>
            </p>
          ) : (img.source_name || img.photographer_name) ? (
            <p className="text-white/70 text-xs">
              {img.photographer_name ? (
                <>Photo by{" "}
                  {img.photographer_url ? (
                    <a href={img.photographer_url} target="_blank" rel="noopener noreferrer" className="text-white underline hover:text-white/90">{img.photographer_name}</a>
                  ) : <span className="text-white">{img.photographer_name}</span>}
                  {img.source_name ? <> via{" "}</> : ""}
                </>
              ) : "Photo via "}
              {img.source_name && (
                img.source_url ? (
                  <a href={img.source_url} target="_blank" rel="noopener noreferrer" className="text-white underline inline-flex items-center gap-0.5 hover:text-white/90">
                    {img.source_name} <ExternalLink className="w-3 h-3" />
                  </a>
                ) : <span className="text-white">{img.source_name}</span>
              )}
            </p>
          ) : (
            <p className="text-white/40 text-xs">{img.alt || ""}</p>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}