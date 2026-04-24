import React, { useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 64;

export default function PullToRefresh({ onRefresh, children, className = "" }) {
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef(null);
  const startY = useRef(0);
  const pulling = useRef(false);
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, THRESHOLD], [0, 1]);
  const rotate = useTransform(y, [0, THRESHOLD * 2], [0, 360]);

  const handleTouchStart = (e) => {
    const el = containerRef.current;
    if (!el || el.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  };

  const handleTouchMove = (e) => {
    if (!pulling.current || refreshing) return;
    const el = containerRef.current;
    if (!el || el.scrollTop > 0) { pulling.current = false; return; }
    const delta = Math.max(0, (e.touches[0].clientY - startY.current) * 0.4);
    if (delta > 0) {
      e.preventDefault();
      y.set(Math.min(delta, THRESHOLD * 1.5));
    }
  };

  const handleTouchEnd = async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (y.get() >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      await animate(y, THRESHOLD * 0.6, { duration: 0.15 });
      await onRefresh?.();
      setRefreshing(false);
    }
    await animate(y, 0, { duration: 0.3, ease: "easeOut" });
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Pull indicator */}
      <motion.div
        style={{ opacity }}
        className="absolute top-0 left-0 right-0 flex items-center justify-center z-10 pointer-events-none"
      >
        <motion.div
          style={{ y, rotate }}
          className="mt-1 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"
        >
          <RefreshCw className={`w-4 h-4 text-primary ${refreshing ? "animate-spin" : ""}`} />
        </motion.div>
      </motion.div>

      <motion.div
        ref={containerRef}
        style={{ y }}
        className="h-full overflow-y-auto"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </motion.div>
    </div>
  );
}