/**
 * inputClassifier.js — Part 2 of TukaPath AI Concierge System
 *
 * Classifies every user input BEFORE parsing or LLM work.
 *
 * CLASS A — Journey data (parse normally)
 * CLASS B — Correction / clarification (parse only the corrected field)
 * CLASS C — Frustration / emotional (NEVER parse as journey data)
 * CLASS D — Trivial / ambiguous short input (treat as confirmation)
 * CLASS E — Meta-conversation (answer meta-question, re-offer state)
 */

// ── Class C — Frustration / emotional signals ─────────────────────────────────
const FRUSTRATION_PATTERNS = [
  /you'?re?\s+not\s+(picking|listening|understanding|hearing)/i,
  /i\s+already\s+(said|told|mentioned)/i,
  /that'?s?\s+(wrong|incorrect)/i,
  /stop\s+asking/i,
  /you\s+(ignored|missed)\s+(it|that|my)/i,
  /not\s+picking\s+up/i,
  /this\s+is\s+frustrating/i,
  /again\??$/i,
  /you\s+keep\s+asking/i,
  /how\s+many\s+times/i,
  /you('re)?\s+not\s+getting/i,
  /you\s+still\s+haven'?t/i,
];

// ── Class B — Correction signals ──────────────────────────────────────────────
const CORRECTION_PATTERNS = [
  /\bno\s+i\s+(meant|said)\b/i,
  /\b(am\s+)?not\s+(flying|driving|walking)/i,  // explicit negation of mode
  /\bi\s+said\s+\w/i,
  /\bchange\s+it\s+to\b/i,
  /\bactually[,\s]/i,
  /\bwait[,\s]+i\s+(meant|said)/i,
  /\bnot\s+\w+[,\s—]+\w/i,  // "not X, Y"
  /\bi\s+meant\b/i,
];

// ── Class D — Trivial / ambiguous single-word ────────────────────────────────
const TRIVIAL_PATTERNS = [
  /^(yes|no|ok|okay|fine|sure|yep|nope|yeah|yup|alright|sounds\s+good|correct|right|exactly)$/i,
];

// ── Class E — Meta-conversation ───────────────────────────────────────────────
const META_PATTERNS = [
  /^(what\s+can\s+you\s+do|how\s+does\s+this\s+work|what\s+is\s+this|help\b)/i,
  /\bwhat\s+do\s+you\s+mean\b/i,
  /\bcan\s+you\s+(explain|tell\s+me\s+more)\b/i,
];

/**
 * classifyInputClass(text)
 * Returns: "CLASS_A" | "CLASS_B" | "CLASS_C" | "CLASS_D" | "CLASS_E"
 *
 * CRITICAL RULE (Part 2):
 * "You're not picking up my initial thing" and similar are ALWAYS CLASS_C.
 * They are NEVER parsed as location data.
 */
export function classifyInputClass(text) {
  if (!text?.trim()) return "CLASS_D";
  const t = text.trim();

  // Class C — check first (highest priority)
  if (FRUSTRATION_PATTERNS.some(p => p.test(t))) return "CLASS_C";

  // Class D — trivial single-word confirmations
  if (TRIVIAL_PATTERNS.some(p => p.test(t))) return "CLASS_D";

  // Class E — meta-questions
  if (META_PATTERNS.some(p => p.test(t))) return "CLASS_E";

  // Class B — corrections
  if (CORRECTION_PATTERNS.some(p => p.test(t))) return "CLASS_B";

  // Class A — journey data (default)
  return "CLASS_A";
}

/**
 * getFrustrationResponse()
 * Returns a calm, empathetic response for Class C inputs.
 * Never parses the frustration as journey data.
 */
export function getFrustrationResponse(currentState) {
  const hasRoute = currentState?.origin || currentState?.destination;
  if (hasRoute) {
    const parts = [];
    if (currentState.origin)      parts.push(`from ${currentState.origin}`);
    if (currentState.destination) parts.push(`to ${currentState.destination}`);
    if (currentState.duration_days) parts.push(`${currentState.duration_days} days`);
    return `Here's what I have so far: ${parts.join(", ")}. What would you like to change?`;
  }
  return "My apologies — let's get this right. Tell me your route and I'll start fresh.";
}