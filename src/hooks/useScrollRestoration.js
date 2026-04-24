import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Saves and restores window scroll position per route path.
 * Place once in AppLayout (or similar wrapper).
 */
export default function useScrollRestoration() {
  const location = useLocation();
  const prevPath = useRef(null);

  useEffect(() => {
    const key = `tp_scroll_${location.pathname}`;

    // Restore saved position for this path
    const saved = sessionStorage.getItem(key);
    if (saved !== null) {
      requestAnimationFrame(() => window.scrollTo(0, parseInt(saved, 10)));
    } else {
      window.scrollTo(0, 0);
    }

    // Save position for previous path on route change
    return () => {
      sessionStorage.setItem(`tp_scroll_${location.pathname}`, String(window.scrollY));
    };
  }, [location.pathname]);
}