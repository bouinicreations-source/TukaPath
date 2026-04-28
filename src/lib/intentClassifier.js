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

// Multi-leg signals — user has multiple cities and is planning what to DO there
// not asking for flight help
const MULTI_LEG_PATTERNS = [
  /\bthen\s+(to\s+)?[A-Z][a-z]+/,           // "then to London"
  /\bafter\s+(that|[A-Z][a-z]+)/,            // "after Amsterdam"
  /\b(first|then|next|finally)\b.*\b(day|night|week)\b/i,
  /\b\d+\s+days?\s+(in|at)\b/i,             // "3 days in Amsterdam"
  /\bstaying\s+in\b/i,
  /\bnight(s)?\s+in\b/i,
  /already\s+(have|got|booked)\s+(a\s+)?flight/i,
  /flights?\s+(are|is)\s+(booked|sorted|done)/i,
  /\bitinerary\b/i,
  /plan\s+(my\s+)?(time|trip|stay|visit)/i,
  /\btrain\s+from\b/i,                       // "train from Amsterdam to London"
  /\beurosta(r)?\b/i,                        // Eurostar
  /\bi\s+(do\s+not|don'?t)\s+need\s+(a\s+)?flight/i, // "I don't need a flight"
  /\bjust\s+want\s+(you\s+to\s+)?plan/i,    // "just want you to plan"
  /\bcoming\s+back\s+from\b/i,              // "coming back from London"
  /\bthen\s+[a-z]+\b/i,                     // "then London"
];

function countCities(text) {
  const cities = [
    "amsterdam", "london", "paris", "rome", "berlin", "barcelona",
    "madrid", "edinburgh", "dublin", "brussels", "vienna", "prague",
    "budapest", "lisbon", "athens", "doha", "dubai", "istanbul",
    "new york", "tokyo", "singapore", "bangkok", "sydney", "toronto",
    "birmingham", "manchester", "glasgow", "liverpool", "copenhagen",
    "stockholm", "oslo", "helsinki", "zurich", "geneva", "milan",
    "doh", "ams", "lhr", "lhr", "cdg", "jfk", // airport codes
  ];
  const lower = text.toLowerCase();
  return cities.filter(c => lower.includes(c)).length;
}

/**
 * classifyIntent(userText)
 * Returns { intent, origin, destination, cities }
 * - intent: "FLIGHT_INTENT" | "JOURNEY_INTENT" | "HYBRID_INTENT" | "MULTI_LEG_INTENT" | "UNKNOWN"
 * - origin: extracted origin city (best-effort) or null
 * - destination: extracted destination city (best-effort) or null
 * - cities: array of detected city names
 */
export function classifyIntent(userText) {
  const text = userText || "";

  const hasFlightSignal    = FLIGHT_PATTERNS.some(p => p.test(text));
  const hasJourneySignal   = JOURNEY_PATTERNS.some(p => p.test(text));
  const hasMultiLegSignal  = MULTI_LEG_PATTERNS.some(p => p.test(text));
  const hasFarPair         = isFarPair(text);
  const cityCount          = countCities(text);

  // Extract rough origin/destination via "from X to Y" pattern
  let origin = null;
  let destination = null;

  const fromTo = text.match(/from\s+([A-Za-z\s]+?)\s+to\s+([A-Za-z\s]+?)(?:\s|$|[.,!?])/i);
  if (fromTo) {
    origin      = fromTo[1]?.trim() || null;
    destination = fromTo[2]?.trim() || null;
  }

  // ── MULTI-LEG DETECTION (highest priority) ────────────────────────────────
  // 3+ cities mentioned = multi-city trip
  // OR 2 cities + any multi-leg signal = already has flights, wants experience planning
  // OR "then [city]" pattern = multi-leg
  const hasThenCity = /\bthen\s+(to\s+)?[a-z]+/i.test(text);
  if (cityCount >= 3 || (cityCount >= 2 && (hasMultiLegSignal || hasThenCity))) {
    return { intent: "MULTI_LEG_INTENT", origin, destination, cityCount };
  }

  // "Already have flights" signals override everything — user wants ground planning
  if (/already\s+(have|got|booked)\s+(a\s+)?flight|flights?\s+(are|is)\s+(booked|sorted)/i.test(text)) {
    return { intent: "MULTI_LEG_INTENT", origin, destination, cityCount };
  }

  // Pure flight intent (flight signals present, no journey override)
  if (hasFlightSignal && !hasJourneySignal) {
    return { intent: "FLIGHT_INTENT", origin, destination, cityCount };
  }

  // Far pair without explicit drive signal → flight intent
  if (hasFarPair && !hasJourneySignal && !hasMultiLegSignal) {
    return { intent: "FLIGHT_INTENT", origin, destination, cityCount };
  }

  // Both signals → hybrid
  if (hasFlightSignal && hasJourneySignal) {
    return { intent: "HYBRID_INTENT", origin, destination, cityCount };
  }

  // Far pair + drive signal → hybrid (flying there, driving after)
  if (hasFarPair && hasJourneySignal) {
    return { intent: "HYBRID_INTENT", origin, destination, cityCount };
  }

  // Pure journey signal
  if (hasJourneySignal) {
    return { intent: "JOURNEY_INTENT", origin, destination, cityCount };
  }

  return { intent: "UNKNOWN", origin, destination, cityCount };
}