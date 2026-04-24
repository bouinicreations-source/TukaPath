import { useEffect } from "react";

/**
 * Locks body scroll while the component is mounted.
 * Restores original overflow on cleanup.
 */
export default function useScrollLock() {
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);
}