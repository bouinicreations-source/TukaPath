/**
 * intentClassifier.js
 * Fast deterministic intent classifier — no LLM needed.
 * Runs BEFORE the journey extraction pipeline.
 *
 * Returns: "FLIGHT_INTENT" | "JOURNEY_INTENT" | "HYBRID_INTENT" | "UNKNOWN"
 */

const FLIGHT_PATTERNS = [
  /\bfly(ing)?\b/i,
  /\bflight\b/i,
  /\bplane\b/i,
  /\bairport\b/i,
  /\bflying\s+from\b/i,
  /\bflying\s+to\b/i,
  /\btravel\s+(between|from)\b.*\b(country|countries|continent)\b/i,
  /\bbook\s+a\s+flight\b/i,
  /\bair\s+travel\b/i,
];

const JOURNEY_PATTERNS = [
  /\bdrive\b/i,
  /\bdriving\b/i,
  /\broad\s+trip\b/i,
  /\bscenic\b/i,
  /\bstops?\b/i,
  /\bexplore\b/i,
  /\broute\b/i,
  /\bcar\s+trip\b/i,
  /\bmotorbike\b/i,
  /\bwalk(ing)?\s+trip\b/i,
  /\bday\s+trip\b/i,
];

// Pairs that are geographically far apart — likely flight unless user says drive
const FAR_PAIRS = [
  ["doha", "london"], ["doha", "edinburgh"], ["doha", "paris"], ["doha", "rome"],
  ["doha", "berlin"], ["doha", "barcelona"], ["doha", "madrid"], ["doha", "amsterdam"],
  ["doha", "tokyo"], ["doha", "new york"], ["doha", "dubai"], ["doha", "cairo"],
  ["dubai", "london"], ["dubai", "edinburgh"], ["dubai", "paris"], ["dubai", "rome"],
  ["riyadh", "london"], ["riyadh", "paris"], ["riyadh", "amsterdam"],
  ["new york", "london"], ["new york", "paris"], ["new york", "tokyo"],
  ["los angeles", "london"], ["los angeles", "paris"], ["los angeles", "tokyo"],
  ["sydney", "london"], ["sydney", "dubai"], ["sydney", "new york"],
  ["toronto", "london"], ["toronto", "paris"],
  ["london", "new york"], ["london", "tokyo"], ["london", "sydney"],
  ["paris", "new york"], ["paris", "tokyo"],
  ["rome", "new york"], ["madrid", "new york"],
  ["edinburgh", "doha"], ["edinburgh", "dubai"],
];

function extractCities(text) {
  // Simple: extract capitalized words/phrases as potential city names
  const lower = text.toLowerCase();
  return lower;
}

function isFarPair(text) {
  const lower = text.toLowerCase();
  return FAR_PAIRS.some(([a, b]) => lower.includes(a) && lower.includes(b));
}

/**
 * classifyIntent(userText)
 * Returns { intent, origin, destination }
 * - intent: "FLIGHT_INTENT" | "JOURNEY_INTENT" | "HYBRID_INTENT" | "UNKNOWN"
 * - origin: extracted origin city (best-effort) or null
 * - destination: extracted destination city (best-effort) or null
 */
export function classifyIntent(userText) {
  const text = userText || "";

  const hasFlightSignal  = FLIGHT_PATTERNS.some(p => p.test(text));
  const hasJourneySignal = JOURNEY_PATTERNS.some(p => p.test(text));
  const hasFarPair       = isFarPair(text);

  // Extract rough origin/destination via "from X to Y" pattern
  let origin = null;
  let destination = null;

  const fromTo = text.match(/from\s+([A-Za-z\s]+?)\s+to\s+([A-Za-z\s]+?)(?:\s|$|[.,!?])/i);
  if (fromTo) {
    origin      = fromTo[1]?.trim() || null;
    destination = fromTo[2]?.trim() || null;
  }

  // Pure flight intent (flight signals present, no journey override)
  if (hasFlightSignal && !hasJourneySignal) {
    return { intent: "FLIGHT_INTENT", origin, destination };
  }

  // Far pair without explicit drive signal → flight intent
  if (hasFarPair && !hasJourneySignal) {
    return { intent: "FLIGHT_INTENT", origin, destination };
  }

  // Both signals → hybrid
  if (hasFlightSignal && hasJourneySignal) {
    return { intent: "HYBRID_INTENT", origin, destination };
  }

  // Far pair + drive signal → hybrid (flying there, driving after)
  if (hasFarPair && hasJourneySignal) {
    return { intent: "HYBRID_INTENT", origin, destination };
  }

  // Pure journey signal
  if (hasJourneySignal) {
    return { intent: "JOURNEY_INTENT", origin, destination };
  }

  return { intent: "UNKNOWN", origin, destination };
}