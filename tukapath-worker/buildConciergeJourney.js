/**
 * buildConciergeJourney.js — TukaPath Journey Planner
 *
 * Converted from Base44/Deno to Cloudflare Worker module.
 * Key changes from original:
 *   1. OpenAI → Claude Sonnet (Anthropic API)
 *   2. Deno.serve → exported function
 *   3. base44.asServiceRole.entities → Supabase REST calls
 *   4. AbortSignal.timeout → manual timeout wrapper
 *
 * All planning logic is UNCHANGED from the original.
 */

const AVG_SPEED_KMH = 80;

// ── Timeout wrapper (Deno had AbortSignal.timeout, CF Workers need this) ─────
function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

// ── Supabase REST helper ──────────────────────────────────────────────────────
async function sbInsert(env, table, record) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    const e = await res.text();
    throw new Error(`Supabase INSERT ${table}: ${e}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

async function sbQuery(env, table, params = '') {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}${params}`, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase GET ${table}: ${res.status}`);
  return res.json();
}

// ── Geo utils ─────────────────────────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function decodePolyline(encoded) {
  const points = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

// ── Placeholder guard ─────────────────────────────────────────────────────────
const PLACEHOLDER_PATTERNS = [
  /\bcity\b/i, /\btown\b/i, /\bvillage\b/i, /\bplace\b/i,
  /lake city/i, /coast town/i, /art city/i, /scenic city/i,
  /\[.*?\]/, /<.*?>/,
];
function isPlaceholder(name) {
  if (!name || typeof name !== 'string') return true;
  if (name.trim().length < 2) return true;
  return PLACEHOLDER_PATTERNS.some(p => p.test(name));
}

// ── Claude API helper ─────────────────────────────────────────────────────────
// Replaces all openai.chat.completions.create() calls.
// Returns parsed JSON when json_mode=true, raw string otherwise.

async function claude(env, system, userMsg, { json_mode = false, max_tokens = 2000, temperature = 0.2 } = {}) {
  const fullSystem = json_mode
    ? `${system}\n\nCRITICAL: Respond with ONLY valid JSON. No markdown fences, no preamble, no explanation.`
    : system;

  const res = await withTimeout(fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens,
      system: fullSystem,
      messages: [{ role: 'user', content: userMsg }],
    }),
  }), 30000);

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(`Claude API ${res.status}: ${e?.error?.message || res.statusText}`);
  }

  const data = await res.json();
  const text = data.content?.map(b => b.text || '').join('') || '';

  if (json_mode) {
    try {
      const clean = text.replace(/```json\n?|```\n?/g, '').trim();
      return JSON.parse(clean);
    } catch {
      throw new Error(`Claude returned invalid JSON: ${text.slice(0, 200)}`);
    }
  }
  return text;
}

// ── Google Geocode ────────────────────────────────────────────────────────────
async function resolvePlace(nameText, GOOGLE_KEY) {
  if (!nameText?.trim() || !GOOGLE_KEY) return null;
  try {
    const params = new URLSearchParams({ address: nameText, key: GOOGLE_KEY, language: 'en' });
    const res = await withTimeout(fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`), 5000);
    const data = await res.json();
    if (data.status !== 'OK' || !data.results?.[0]) return null;
    const r = data.results[0];
    const loc = r.geometry.location;
    const getComp = (type) => r.address_components?.find(c => c.types.includes(type))?.long_name || null;
    const types = r.types || [];
    let confidence = 70;
    if (types.includes('locality') || types.includes('administrative_area_level_1')) confidence = 92;
    else if (types.includes('colloquial_area') || types.includes('natural_feature')) confidence = 80;
    return {
      canonical_name: r.formatted_address,
      display_name: getComp('locality') || getComp('administrative_area_level_1') || r.formatted_address,
      short_name: getComp('locality') || getComp('administrative_area_level_1') || nameText,
      country: getComp('country'),
      region: getComp('administrative_area_level_1'),
      city: getComp('locality') || getComp('postal_town'),
      lat: loc.lat, lng: loc.lng,
      place_type: types[0] || 'unknown',
      source_place_id: r.place_id || null,
      confidence,
    };
  } catch { return null; }
}

// ── Region resolution ─────────────────────────────────────────────────────────
async function resolveRegion(phrase, env) {
  if (!phrase?.trim()) return null;
  const GOOGLE_KEY = env.GOOGLE_PLACES_API_KEY;
  const direct = await resolvePlace(phrase, GOOGLE_KEY);
  if (direct && direct.confidence >= 60) {
    const towns = await fetchTownsNearRegion(direct.lat, direct.lng, phrase, GOOGLE_KEY);
    return { region_name: direct.display_name, canonical_name: direct.canonical_name, lat: direct.lat, lng: direct.lng, country: direct.country, confidence: direct.confidence, candidate_towns: towns, chosen_town: towns[0] || null };
  }
  try {
    const parsed = await claude(env,
      'You resolve vague geographic region phrases to real place names. Output ONLY valid JSON. Never invent place names.',
      `Resolve this region phrase to a real, specific place name that exists on Google Maps: "${phrase}"\nReturn: {"resolved_name": "Real Place Name, Country", "confidence": 0-100, "reason": "why this place"}`,
      { json_mode: true, max_tokens: 200 }
    );
    if (parsed.resolved_name && parsed.confidence > 50) {
      const geocoded = await resolvePlace(parsed.resolved_name, GOOGLE_KEY);
      if (geocoded) {
        const towns = await fetchTownsNearRegion(geocoded.lat, geocoded.lng, parsed.resolved_name, GOOGLE_KEY);
        return { region_name: geocoded.display_name, canonical_name: geocoded.canonical_name, lat: geocoded.lat, lng: geocoded.lng, country: geocoded.country, confidence: Math.min(geocoded.confidence, parsed.confidence), candidate_towns: towns, chosen_town: towns[0] || null, ai_interpreted: true };
      }
    }
  } catch {}
  return null;
}

async function fetchTownsNearRegion(lat, lng, regionHint, GOOGLE_KEY) {
  if (!GOOGLE_KEY) return [];
  try {
    const params = new URLSearchParams({ query: `towns near ${regionHint}`, type: 'locality', key: GOOGLE_KEY, location: `${lat},${lng}`, radius: '50000' });
    const res = await withTimeout(fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`), 5000);
    const data = await res.json();
    return (data.results || []).slice(0, 5).map(p => ({ name: p.name, lat: p.geometry?.location?.lat, lng: p.geometry?.location?.lng })).filter(t => t.name && t.lat && t.lng);
  } catch { return []; }
}

// ── AI Intent Engine (replaces buildStructuredPlan with GPT) ──────────────────
async function buildStructuredPlan(env, userInput, clarificationAnswer, refinements, existingPlan) {
  const isRefinement = !!existingPlan;
  const system = `You are TukaPath's AI Journey Brain V3.
Output ONLY valid JSON. Never prose. Never invent place names.

STRICT RULES:
1. Resolve all place names into canonical objects before planning.
2. Classify ALL constraints as HARD or SOFT.
3. Extract temporal anchors (sunset, overnight, max-km, stop-every-X) as hard constraints.
4. Ask 0–2 questions ONLY if missing origin/destination or constraint that changes entire route shape.
5. Never use placeholder names like "Lake City", "Coast Town". Use only real named places.
6. For overnight regions ("near the lakes"), set overnight_near_region to the vague phrase.
7. For multi-day trips, define segments with REAL city names only.
8. origin_exclusion_radius_km: no stops within this radius of origin.
9. route_character must be backed by actual geometry intent.
10. STOP DENSITY RULES — max_stops per segment: 1 day=4-5, 2 days=3-4/leg, 3 days=3-4/leg, 7+ days=4/leg, 14+ days=4/leg.
11. Mix stop types: always include main highlights + scenic stops + at least 1 experience stop per leg.
12. SEGMENT COUNT ENFORCEMENT: segment_count = max(2, ceil(duration_days/2)). 14 days → 7 segments min. NEVER only 1 segment for multi-day.
13. For trips >= 2 days: EVERY segment must have a named overnight_city.

JSON schema:
{"needs_clarification":false,"clarifying_question":null,"clarification_type":null,"confidence_level":"HIGH","trip_type":"DAY_TRIP|OVERNIGHT|MULTI_DAY","mode":"DRIVE|WALK|MIXED","route_character":"scenic|coastal|countryside|cultural|efficient|mixed","pacing":"fast|balanced|exploratory","origin_text":"exact place name","destination_text":"exact place name or null","origin_display":"short display name","destination_display":"short display name or null","summary_sentence":"Got it — [1 sentence]","temporal_anchors":{"catch_sunset":false,"catch_sunrise":false,"max_km_per_leg":null,"stop_every_hours":null,"overnight_near_region":null,"arrival_time_target":null,"departure_time_target":null},"hard_constraints":[{"type":"origin|destination|loop|overnight_region|max_km|stop_frequency|sunset","value":"...","reason":"..."}],"soft_constraints":[{"type":"scenic|coastal|countryside|cultural|coffee|family|relaxed|fast","value":"...","influence":"scoring"}],"origin_exclusion_radius_km":15,"segments":[{"leg_number":1,"start_city":"Real City Name","end_city":"Real City Name or null","overnight_city":"Real City Name or null","overnight_near_region":"vague phrase or null","overnight_city_reason":"why this city","route_character":"scenic","route_bias":"coastal road|countryside|null","max_stops":4,"stop_themes":["scenic","cultural"],"shaping_waypoints":[{"name":"Real place name","purpose":"coastal bias"}]}],"overnight_strategy":"hotel|camping|none","stop_strategy":"hero_only|balanced|dense","support_strategy":"auto|coffee_only|none","fallback_strategy":"widen_search|ask_question|partial","refinements_applied":[]}`;

  const userMsg = isRefinement
    ? `Existing plan: ${JSON.stringify(existingPlan)}\n\nUser refinement: ${(refinements || []).map(r => r.label || r.text).join(', ')}\n\nApply only partial updates. Return updated JSON with refinements_applied filled.`
    : `User request: "${userInput}"${clarificationAnswer ? `\nClarification: "${clarificationAnswer}"` : ''}`;

  return claude(env, system, userMsg, { json_mode: true, max_tokens: 3000, temperature: 0.2 });
}

// ── Shaping waypoints generator ───────────────────────────────────────────────
async function generateShapingWaypoints(env, plan, origin, dest) {
  const char = plan.route_character || 'scenic';
  const themes = (plan.soft_constraints || []).map(c => c.type).filter(Boolean);
  const needsBias = ['coastal', 'countryside', 'scenic'].includes(char);
  if (!needsBias || !origin || !dest) return [];
  try {
    const parsed = await claude(env,
      'You suggest real geographic waypoints to shape driving routes. Output ONLY valid JSON. Never invent place names.',
      `Route from ${origin.display_name} to ${dest.display_name}. Character: ${char}. Themes: ${themes.join(', ') || 'none'}. Give 1-3 REAL named places that would shape this route to be ${char}.\nReturn ONLY: {"waypoints":[{"name":"Real Place Name, Country","purpose":"${char} bias"}]}`,
      { json_mode: true, max_tokens: 300, temperature: 0.1 }
    );
    return (parsed.waypoints || []).filter(w => w.name && !isPlaceholder(w.name));
  } catch { return []; }
}

// ── Hero story generator ──────────────────────────────────────────────────────
async function generateHeroStory(env, name, city, country, category) {
  try {
    return await claude(env,
      'You write short, compelling travel stories. Be factual, vivid, and engaging. Output ONLY valid JSON.',
      `Write a quick travel story for: ${name}, ${city}, ${country} (category: ${category}).\nReturn: {"quick_story":"2-3 sentences, vivid and factual","mystery_teaser":"One intriguing hook sentence under 20 words","fun_fact":"One surprising fact"}`,
      { json_mode: true, max_tokens: 400, temperature: 0.7 }
    );
  } catch { return null; }
}

// ── Route shaping + truth check ───────────────────────────────────────────────
async function shapeRouteWithTruthCheck(plan, origin, dest, shapingWaypointCoords, GOOGLE_KEY) {
  if (!origin || !GOOGLE_KEY) return { routeData: null, verified_route_character: 'mixed', route_character_honest: false, truth_note: null };
  const mode = plan.mode === 'WALK' ? 'walking' : 'driving';
  const waypointStr = shapingWaypointCoords.slice(0, 8).map(w => `via:${w.lat},${w.lng}`).join('|');
  let routeData = null;
  try {
    const params = new URLSearchParams({ origin: `${origin.lat},${origin.lng}`, destination: dest ? `${dest.lat},${dest.lng}` : `${origin.lat},${origin.lng}`, mode, key: GOOGLE_KEY });
    if (waypointStr) params.set('waypoints', waypointStr);
    const res = await withTimeout(fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`), 10000);
    const data = await res.json();
    if (data.status === 'OK' && data.routes?.[0]) {
      const route = data.routes[0];
      const totalDist = route.legs.reduce((s, l) => s + (l.distance?.value || 0), 0);
      const totalDur  = route.legs.reduce((s, l) => s + (l.duration?.value || 0), 0);
      const polyline  = decodePolyline(route.overview_polyline?.points || '');
      routeData = { distance_km: totalDist / 1000, duration_minutes: totalDur / 60, polyline, shaped_by_waypoints: shapingWaypointCoords.length };
    }
  } catch {}
  const claimedChar = plan.route_character || 'mixed';
  let verified_route_character = claimedChar;
  let route_character_honest = true;
  let truth_note = null;
  if (!routeData?.polyline?.length) {
    verified_route_character = 'mixed';
    route_character_honest = false;
    truth_note = 'Route geometry unavailable — route character label cannot be verified.';
  } else if (claimedChar === 'coastal') {
    const hasCoastalWaypoint = shapingWaypointCoords.some(w => /coast|sea|bay|beach|shore|ocean|lake/i.test(w.purpose || w.name || ''));
    if (!hasCoastalWaypoint && shapingWaypointCoords.length === 0) {
      verified_route_character = 'mixed';
      route_character_honest = false;
      truth_note = 'Coastal routing was requested but no coastal waypoints were used.';
    }
  }
  return { routeData, verified_route_character, route_character_honest, truth_note };
}

// ── Drive blocks ──────────────────────────────────────────────────────────────
function buildDriveBlocks(routePoints, maxBlockMinutes, totalDistKm, totalDurMin) {
  if (!routePoints || routePoints.length < 2) return [];
  const avgSpeed = (totalDistKm > 0 && totalDurMin > 0) ? (totalDistKm / totalDurMin) * 60 : AVG_SPEED_KMH;
  const maxBlockKm = (maxBlockMinutes / 60) * avgSpeed;
  const blocks = [];
  let blockStart = 0, blockKm = 0;
  for (let i = 1; i < routePoints.length; i++) {
    blockKm += haversineKm(routePoints[i-1].lat, routePoints[i-1].lng, routePoints[i].lat, routePoints[i].lng);
    const isLast = i === routePoints.length - 1;
    if (blockKm >= maxBlockKm || isLast) {
      const mid = Math.floor((blockStart + i) / 2);
      blocks.push({ block_number: blocks.length + 1, start_progress: blockStart / routePoints.length, end_progress: i / routePoints.length, midpoint: routePoints[mid] || routePoints[i], distance_km: Math.round(blockKm * 10) / 10, estimated_minutes: Math.round((blockKm / avgSpeed) * 60), anchor_stop: null, support_stop: null, scenic_stop: null });
      blockStart = i;
      blockKm = 0;
    }
  }
  return blocks;
}

function estimateSunsetTime(lat, lng) {
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  const latRad = lat * Math.PI / 180;
  const declination = 0.4093 * Math.sin((2 * Math.PI / 365) * dayOfYear - 1.405);
  const cosH = Math.min(1, Math.max(-1, -Math.tan(latRad) * Math.tan(declination)));
  const sunsetUTC = 12 + (Math.acos(cosH) * 180 / Math.PI) / 15;
  const local = sunsetUTC + lng / 15;
  return { hour: Math.floor(local) % 24, minute: Math.round((local % 1) * 60) };
}

// ── Stop quality ──────────────────────────────────────────────────────────────
const WEAK_CATEGORIES = new Set(['square', 'other', 'statue']);
const STRONG_CATEGORIES = new Set(['landmark', 'hidden_spot', 'park', 'bridge', 'tower', 'museum', 'monument', 'religious']);
const THEME_TAGS = { scenic: ['landmark','hidden_spot','park','bridge','tower'], cultural: ['museum','monument','religious','square'], coastal: ['bridge','landmark','park','hidden_spot'], history: ['monument','religious','museum'], art: ['museum','landmark'], nature: ['park','hidden_spot','landmark'] };
const MIN_SUITABILITY = 30;

function computeSuitability(loc, themes, routeCharacter) {
  const cat = loc.category || 'other';
  let score = STRONG_CATEGORIES.has(cat) ? 30 : WEAK_CATEGORIES.has(cat) ? 5 : 15;
  const themeHit = (themes || []).some(t => (THEME_TAGS[t] || []).includes(cat));
  const routeHit = (THEME_TAGS[routeCharacter] || []).includes(cat);
  if (themeHit) score += 25; else if (routeHit) score += 15;
  const worthMap = { hero: 20, worth_stop: 15, conditional: 8, background_only: 2, ignore: -20 };
  score += (worthMap[loc.visit_worthiness] ?? 5);
  if (loc.record_state === 'enriched') score += 15; else if (loc.record_state === 'curated') score += 8;
  if (loc.has_story) score += 5;
  if (loc.experience_class === 'hero') score += 10; else if (loc.experience_class === 'standard') score += 5;
  if (loc.visit_worthiness === 'ignore') score = 0;
  return Math.max(0, Math.min(100, score));
}

// ── Stop selection from DB ────────────────────────────────────────────────────
async function fetchCorridorStops(env, routePoints, seg, originLat, originLng, destLat, destLng, totalDistKm, themes, originExclusionKm, usedStopNames, routeCharacter) {
  if (!routePoints?.length) return { stops: [], weakRejectedCount: 0, fallbackUsed: false };
  const svcCategories = new Set(['restaurant', 'cafe', 'petrol_station', 'hotel']);
  const worthScore = { hero: 5, worth_stop: 4, conditional: 3, background_only: 1, ignore: -1 };

  const runQuery = async (corridorKm) => {
    const lats = routePoints.map(p => p.lat);
    const lngs = routePoints.map(p => p.lng);
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const padLat = corridorKm / 111;
    const padLng = corridorKm / (111 * Math.max(Math.cos(midLat * Math.PI / 180), 0.1));
    const minLat = Math.min(...lats) - padLat;
    const maxLat = Math.max(...lats) + padLat;
    const minLng = Math.min(...lngs) - padLng;
    const maxLng = Math.max(...lngs) + padLng;

    // Query Supabase locations table with bounding box
    const params = `?status=eq.active&visible_to_users=eq.true&latitude=gte.${minLat}&latitude=lte.${maxLat}&longitude=gte.${minLng}&longitude=lte.${maxLng}&select=*`;
    const candidates = await sbQuery(env, 'locations', params).catch(() => []);

    let weakRejected = 0;
    const eligible = candidates.filter(loc => {
      if (!loc.latitude || !loc.longitude) return false;
      if (usedStopNames.has((loc.name || '').toLowerCase())) return false;
      if (haversineKm(loc.latitude, loc.longitude, originLat, originLng) < originExclusionKm) return false;
      const inCorridor = routePoints.some(pt => haversineKm(pt.lat, pt.lng, loc.latitude, loc.longitude) < corridorKm);
      if (!inCorridor) return false;
      if (svcCategories.has(loc.category)) return false;
      if (destLat && destLng && haversineKm(loc.latitude, loc.longitude, destLat, destLng) < 8) return false;
      const suitability = computeSuitability(loc, themes, routeCharacter || 'scenic');
      if (suitability < MIN_SUITABILITY) { weakRejected++; return false; }
      loc._suitability = suitability;
      return true;
    });

    const scored = eligible.map(loc => {
      let score = (worthScore[loc.visit_worthiness] || 0) * 20;
      score += (loc.experience_class === 'hero' ? 30 : loc.experience_class === 'standard' ? 15 : 0);
      score += (loc.record_state === 'enriched' ? 10 : loc.record_state === 'curated' ? 5 : 0);
      score += (loc.has_story ? 8 : 0);
      score += (loc._suitability || 0) * 0.5;
      for (const theme of (themes || [])) { if ((THEME_TAGS[theme] || []).includes(loc.category || 'other')) score += 12; }
      const segMidProgress = ((seg.start_progress || 0) + (seg.end_progress || 1)) / 2;
      const targetPt = routePoints[Math.floor(segMidProgress * routePoints.length)] || routePoints[Math.floor(routePoints.length / 2)];
      score += Math.max(0, 25 - haversineKm(loc.latitude, loc.longitude, targetPt.lat, targetPt.lng));
      let bestProgress = 0, bestDist = Infinity;
      for (let i = 0; i < routePoints.length; i++) {
        const d = haversineKm(routePoints[i].lat, routePoints[i].lng, loc.latitude, loc.longitude);
        if (d < bestDist) { bestDist = d; bestProgress = i / routePoints.length; }
      }
      loc._progress = bestProgress;
      return { loc, score };
    }).filter(s => s.score > 0);

    scored.sort((a, b) => b.score - a.score);
    return { results: scored.slice(0, (seg.max_stops || 5) * 2).map(s => s.loc), weakRejected };
  };

  try {
    const BASE_CORRIDOR_KM = Math.max(20, Math.min(80, totalDistKm * 0.12));
    const first = await runQuery(BASE_CORRIDOR_KM);
    if (first.results.length > 0) return { stops: first.results, weakRejectedCount: first.weakRejected, fallbackUsed: false };
    const second = await runQuery(BASE_CORRIDOR_KM * 1.5);
    return { stops: second.results, weakRejectedCount: first.weakRejected + second.weakRejected, fallbackUsed: second.results.length > 0 };
  } catch { return { stops: [], weakRejectedCount: 0, fallbackUsed: false }; }
}

// ── Corridor enrichment from Google Places ────────────────────────────────────
const HERO_PLACE_TYPES = new Set(['museum','art_gallery','church','mosque','synagogue','hindu_temple','tourist_attraction','natural_feature','park','zoo','aquarium','amusement_park','stadium','university','library']);
const MIN_LOCATIONS_PER_LEG = 3;

function classifyGooglePlace(place) {
  return (place.types || []).some(t => HERO_PLACE_TYPES.has(t)) ? 'hero' : 'card';
}

function mapGoogleTypeToCategory(types = []) {
  if (types.includes('museum') || types.includes('art_gallery')) return 'museum';
  if (types.includes('church') || types.includes('mosque') || types.includes('synagogue')) return 'religious';
  if (types.includes('park') || types.includes('natural_feature')) return 'park';
  if (types.includes('restaurant') || types.includes('food')) return 'restaurant';
  if (types.includes('cafe')) return 'cafe';
  if (types.includes('bar')) return 'bar';
  if (types.includes('tourist_attraction')) return 'landmark';
  return 'landmark';
}

async function enrichCorridorFromGooglePlaces(env, segPts, segDistKm, themes, routeCharacter, corridorKm) {
  const GOOGLE_KEY = env.GOOGLE_PLACES_API_KEY;
  if (!GOOGLE_KEY || !segPts?.length) return [];
  const lats = segPts.map(p => p.lat);
  const lngs = segPts.map(p => p.lng);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const themeKeywords = { scenic: 'tourist attraction viewpoint', cultural: 'museum historic site', coastal: 'beach waterfront', history: 'historic castle monument', art: 'art gallery museum', nature: 'national park nature reserve', food: 'restaurant local food' };
  const keyword = (themes || []).map(t => themeKeywords[t] || '').filter(Boolean).join(' ') || 'tourist attraction';

  let googleResults = [];
  try {
    const params = new URLSearchParams({ query: keyword, location: `${midLat},${midLng}`, radius: String(Math.min(50000, corridorKm * 1000)), key: GOOGLE_KEY });
    const res = await withTimeout(fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`), 8000);
    const data = await res.json();
    googleResults = (data.results || []).filter(p => (p.rating || 0) >= 3.8 && (p.user_ratings_total || 0) >= 10).slice(0, 20);
  } catch { return []; }

  const inCorridor = googleResults.filter(p => {
    const pLat = p.geometry?.location?.lat;
    const pLng = p.geometry?.location?.lng;
    if (!pLat || !pLng) return false;
    return segPts.some(pt => haversineKm(pt.lat, pt.lng, pLat, pLng) < corridorKm);
  });

  // Check existing in DB by place_id
  const placeIds = inCorridor.map(p => p.place_id).filter(Boolean);
  let existingByPlaceId = new Set();
  if (placeIds.length > 0) {
    try {
      const existing = await sbQuery(env, `locations?source_place_id=in.(${placeIds.join(',')})&select=source_place_id`);
      (Array.isArray(existing) ? existing : []).forEach(loc => { if (loc.source_place_id) existingByPlaceId.add(loc.source_place_id); });
    } catch {}
  }

  const savedLocations = [];
  await Promise.all(inCorridor.map(async (p) => {
    if (existingByPlaceId.has(p.place_id)) return;
    const pLat = p.geometry?.location?.lat;
    const pLng = p.geometry?.location?.lng;
    const locationType = classifyGooglePlace(p);
    const category = mapGoogleTypeToCategory(p.types || []);
    const city = p.vicinity || '';
    const country = '';
    let storyData = null;
    if (locationType === 'hero') storyData = await generateHeroStory(env, p.name, city, country, category);

    const locationRecord = {
      name: p.name, normalized_name: (p.name || '').toLowerCase().trim().replace(/[^a-z0-9\s]/g, ''),
      city, country, latitude: pLat, longitude: pLng, category,
      formatted_address: p.formatted_address || p.vicinity || null,
      source_name: 'google', source_place_id: p.place_id || null,
      source_rating: p.rating || null, source_review_count: p.user_ratings_total || null,
      record_layer: locationType === 'hero' ? 'journey' : 'service',
      experience_class: locationType === 'hero' ? 'standard' : 'support',
      visit_worthiness: locationType === 'hero' ? 'worth_stop' : 'conditional',
      record_state: locationType === 'hero' && storyData ? 'curated' : 'raw',
      source: 'on_demand_api', status: 'active', visible_to_users: true, generated_on_demand: true,
      quick_story: storyData?.quick_story || null, mystery_teaser: storyData?.mystery_teaser || null,
      fun_fact: storyData?.fun_fact || null, has_story: !!(storyData?.quick_story),
      last_ingested_at: new Date().toISOString(),
    };
    try {
      const saved = await sbInsert(env, 'locations', locationRecord);
      saved._suitability = locationType === 'hero' ? 65 : 35;
      saved._google_type = locationType;
      saved._from_enrichment = true;
      savedLocations.push(saved);
    } catch {}
  }));

  return savedLocations;
}

// ── Hotels ────────────────────────────────────────────────────────────────────
async function fetchHotelsForCity(cityName, GOOGLE_KEY) {
  if (!GOOGLE_KEY || !cityName || isPlaceholder(cityName)) return [];
  try {
    const params = new URLSearchParams({ query: `hotels in ${cityName}`, type: 'lodging', key: GOOGLE_KEY });
    const res = await withTimeout(fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`), 5000);
    const data = await res.json();
    return (data.results || []).filter(p => (p.rating || 0) >= 3.5 && (p.user_ratings_total || 0) >= 20).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 4).map(p => ({
      name: p.name, city: cityName, rating: p.rating || null, price_level: p.price_level || null,
      address: p.formatted_address || null,
      booking_url: `https://www.booking.com/search.html?ss=${encodeURIComponent(p.name + ' ' + cityName)}`,
      lat: p.geometry?.location?.lat || null, lng: p.geometry?.location?.lng || null,
    }));
  } catch { return []; }
}

// ── Assign stops to blocks ────────────────────────────────────────────────────
function assignStopsToBlocks(driveBlocks, stops, usedStopNames) {
  return driveBlocks.map(block => {
    const inBlock = stops.filter(s => {
      if (usedStopNames.has((s.name || '').toLowerCase())) return false;
      const prog = s._progress ?? 0.5;
      return prog >= block.start_progress && prog <= block.end_progress;
    });
    const anchor  = inBlock.find(s => ['landmark','hidden_spot','monument','museum','tower','bridge','park','religious'].includes(s.category)) || inBlock[0] || null;
    const support = inBlock.find(s => s !== anchor && ['cafe','restaurant','petrol_station'].includes(s.category)) || null;
    const scenic  = inBlock.find(s => s !== anchor && s !== support) || null;
    if (anchor)  usedStopNames.add((anchor.name  || '').toLowerCase());
    if (support) usedStopNames.add((support.name || '').toLowerCase());
    if (scenic)  usedStopNames.add((scenic.name  || '').toLowerCase());
    return { ...block, anchor_stop: anchor, support_stop: support, scenic_stop: scenic };
  });
}

// ── Validation gate ───────────────────────────────────────────────────────────
function validateSegment(driveBlocks, orderedStops, maxBlockMinutes, segDistKm, maxLegKm) {
  const violations = [];
  const seen = new Set();
  for (const block of driveBlocks) {
    if (block.estimated_minutes > maxBlockMinutes * 1.15) violations.push({ rule: 'max_drive_time_exceeded', block: block.block_number, minutes: block.estimated_minutes, limit: maxBlockMinutes });
  }
  for (const stop of orderedStops) {
    const id = (stop.location?.name || '').toLowerCase();
    if (id && seen.has(id)) violations.push({ rule: 'duplicate_stop', stop: stop.location?.name });
    if (id) seen.add(id);
    if (stop.location?.name && isPlaceholder(stop.location.name)) violations.push({ rule: 'placeholder_stop_name', stop: stop.location.name });
  }
  for (let i = 1; i < orderedStops.length; i++) {
    const prev = orderedStops[i-1]._progress ?? null;
    const curr = orderedStops[i]._progress ?? null;
    if (prev !== null && curr !== null && curr < prev - 0.02) violations.push({ rule: 'backward_progression', stop: orderedStops[i].location?.name || '', prev, curr });
  }
  if (maxLegKm && segDistKm > parseFloat(maxLegKm) * 1.1) violations.push({ rule: 'max_km_exceeded', segment_km: segDistKm, limit: maxLegKm });
  return { valid: violations.length === 0, violations };
}

// ── Build stop object ─────────────────────────────────────────────────────────
function buildStopObject(loc, blockNumber, roleInBlock, legNumber, progress) {
  const role = roleInBlock === 'anchor' ? 'main_highlight' : roleInBlock === 'support' ? 'support_stop' : 'scenic_stop';
  const confidence = loc.experience_class === 'hero' ? 'HIGH' : loc.record_state === 'enriched' ? 'HIGH' : loc.record_state === 'curated' ? 'MEDIUM' : 'LOW';
  return { location: loc, stop_role: role, why_included: loc.mystery_teaser || loc.quick_story || `${loc.name} is a ${loc.category || 'notable place'} along this route.`, confidence, confidence_reason: loc.experience_class === 'hero' ? 'hero landmark' : `${loc.record_state || 'route-based'} match`, db_backed: true, hook: loc.mystery_teaser || loc.quick_story || loc.name, dwell_minutes: role === 'main_highlight' ? 40 : role === 'scenic_stop' ? 20 : 15, _block: blockNumber, _role_in_block: roleInBlock, _leg: legNumber, _progress: progress };
}

// ── Duration / segment utilities ──────────────────────────────────────────────
function normalizeDurationDays(userInput, existingDays) {
  if (existingDays) return existingDays;
  if (!userInput) return null;
  const v = String(userInput).toLowerCase();
  if (/fortnight|two\s+weeks?/i.test(v)) return 14;
  if (/\bone\s+week\b|\ba\s+week\b|\bweek\b/i.test(v) && !/\d/.test(v)) return 7;
  if (/weekend/i.test(v)) return 2;
  if (/a\s+couple\s+(of\s+)?days?|couple\s+(of\s+)?days?/i.test(v)) return 2;
  if (/a\s+few\s+days?|few\s+days?/i.test(v)) return 3;
  if (/\ba\s+month\b|\bone\s+month\b/i.test(v)) return 30;
  const mo = v.match(/(\d+)\s*months?/); if (mo) return parseInt(mo[1]) * 30;
  const wm = v.match(/(\d+(?:\.\d+)?)\s*weeks?/); if (wm) return Math.round(parseFloat(wm[1]) * 7);
  const dm = v.match(/(\d+(?:\.\d+)?)\s*days?/);  if (dm) return parseFloat(dm[1]);
  return null;
}

function computeRequiredSegmentCount(durationDays) {
  if (!durationDays || durationDays < 2) return 1;
  return Math.max(2, Math.ceil(durationDays / 2));
}

function computeMaxStopsPerLeg(plan, legCount) {
  const days = plan?.duration_days || null;
  const tripType = (plan?.trip_type || '').toUpperCase();
  const totalStops = days >= 14 ? Math.max(28, days * 2) : days >= 7 ? Math.max(14, days * 2) : days >= 4 ? Math.max(10, days * 2) : days === 3 ? 10 : days === 2 ? 7 : days === 1 ? 5 : tripType === 'MULTI_DAY' ? 10 : tripType === 'OVERNIGHT' ? 5 : 4;
  return Math.max(3, Math.ceil(totalStops / Math.max(legCount, 1)));
}

function validatePlannerOutput(durationDays, segmentCount, stopCount) {
  if (!durationDays) return { valid: true, reason: null };
  const requiredSegs = computeRequiredSegmentCount(durationDays);
  if (durationDays >= 2 && segmentCount < 2) return { valid: false, reason: `duration_days=${durationDays} requires segment_count>=${requiredSegs}, got ${segmentCount}` };
  if (durationDays >= 3 && stopCount < 4) return { valid: false, reason: `duration_days=${durationDays} requires stop_count>=4, got ${stopCount}` };
  if (durationDays >= 7 && stopCount < 8) return { valid: false, reason: `duration_days=${durationDays} requires stop_count>=8, got ${stopCount}` };
  if (durationDays >= 14 && stopCount < 15) return { valid: false, reason: `duration_days=${durationDays} requires stop_count>=15, got ${stopCount}` };
  return { valid: true, reason: null };
}

function autoGenerateSegments(plan, durationDays, requiredCount) {
  const origin = plan.origin_display || plan.origin_text || '';
  const dest   = plan.destination_display || plan.destination_text || origin;
  const segs = [];
  for (let i = 0; i < requiredCount; i++) {
    segs.push({ leg_number: i + 1, start_city: i === 0 ? origin : null, end_city: i === requiredCount - 1 ? dest : null, overnight_city: i === requiredCount - 1 ? dest : null, overnight_near_region: null, overnight_city_reason: 'auto-generated segment', route_character: plan.route_character || 'scenic', route_bias: null, max_stops: 4, stop_themes: (plan.soft_constraints || []).map(c => c.type).filter(Boolean), shaping_waypoints: [], start_progress: i / requiredCount, end_progress: (i + 1) / requiredCount });
  }
  return segs;
}

// ── MAIN EXPORTED FUNCTION ────────────────────────────────────────────────────

export async function buildConciergeJourney(body, env, user) {
  const GOOGLE_KEY = env.GOOGLE_PLACES_API_KEY;

  const debug = {
    resolved_origin: null, resolved_destination: null, resolved_region_anchors: [],
    chosen_overnight_cities: [], route_theme_applied: false, route_character_verified: null,
    route_character_honest: null, truth_note: null, leg_count: 0, stop_count_per_leg: {},
    validation_passed: true, rejected_candidates_count: 0, all_violations: [],
    journey_saved: false, saved_journey_id: null, saved_leg_count: 0, saved_stop_count: 0,
    weak_stop_candidates_rejected: 0, fallback_used: false, corridor_enrichments: 0,
    enriched_locations_saved: 0, normalized_duration_days: null, pre_planner_trip_type: null,
    planner_segment_count: null, planner_stop_count: null, planner_validation_status: null,
    planner_validation_fail_reason: null, segment_enforcement_triggered: false, segment_enforcement_reason: null,
  };

  const jsonRes = (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });

  try {
    const { user_input, clarification_answer, refinements, existing_plan, duration_days, stage_requested = 'full' } = body;
    if (!user_input && !existing_plan) return jsonRes({ error: 'user_input is required' }, 400);

    // ── STEP 1: Plan construction ─────────────────────────────────────────────
    let plan;
    const frontendPlan = (existing_plan?.plan_status === 'ready') ? existing_plan : null;
    if (frontendPlan && duration_days) frontendPlan.duration_days = duration_days;

    if (frontendPlan && !refinements?.length) {
      const softConstraints = frontendPlan.soft_constraints || [];
      const hardConstraints = frontendPlan.hard_constraints || [];
      const temporalAnchors = frontendPlan.temporal_anchors || {};
      plan = {
        needs_clarification: false, confidence_level: frontendPlan.confidence_level || 'HIGH',
        trip_type: frontendPlan.trip_type || 'POINT_TO_POINT', mode: frontendPlan.mode || 'DRIVE',
        route_character: frontendPlan.route_character || 'scenic', pacing: frontendPlan.pacing || 'balanced',
        origin_text: frontendPlan.origin || null,
        destination_text: frontendPlan.trip_type === 'LOOP' ? (frontendPlan.origin || null) : (frontendPlan.destination || null),
        origin_display: frontendPlan.origin_display || frontendPlan.origin || null,
        destination_display: frontendPlan.destination_display || frontendPlan.destination || null,
        summary_sentence: user_input || null, temporal_anchors: temporalAnchors,
        hard_constraints: hardConstraints, soft_constraints: softConstraints,
        segments: (frontendPlan.segments || []).map((seg, idx) => ({
          leg_number: seg.leg_number || (idx + 1), start_city: seg.start_city || frontendPlan.origin_display || null,
          end_city: seg.end_city || frontendPlan.destination_display || null, overnight_city: seg.overnight_city || null,
          overnight_near_region: seg.overnight_near_region || temporalAnchors.overnight_near_region || null,
          route_character: seg.route_character || frontendPlan.route_character || 'scenic', route_bias: null,
          max_stops: computeMaxStopsPerLeg({ ...frontendPlan, duration_days: frontendPlan.duration_days || duration_days }, (frontendPlan.segments || []).length || 1),
          stop_themes: seg.stop_themes || softConstraints.map(c => c.type).filter(Boolean),
          shaping_waypoints: [], start_progress: seg.start_progress ?? (idx / (frontendPlan.segments?.length || 1)),
          end_progress: seg.end_progress ?? ((idx + 1) / (frontendPlan.segments?.length || 1)),
        })),
        origin_exclusion_radius_km: 15, refinements_applied: [], assumptions: frontendPlan.assumptions || [],
      };
    } else {
      plan = await buildStructuredPlan(env, user_input, clarification_answer, refinements, existing_plan);
    }

    if (plan.needs_clarification) return jsonRes({ phase: 'clarification', plan });
    if (stage_requested === 'plan_only') return jsonRes({ phase: 'confirmation', plan });

    // ── SEGMENT COUNT ENFORCEMENT ─────────────────────────────────────────────
    const planDurationDays = duration_days || plan.duration_days || normalizeDurationDays(user_input, null);
    const requiredSegCount = computeRequiredSegmentCount(planDurationDays);
    const returnedSegCount = (plan.segments || []).length;

    if (planDurationDays >= 2 && returnedSegCount < requiredSegCount && !frontendPlan) {
      debug.segment_enforcement_triggered = true;
      debug.segment_enforcement_reason = `Got ${returnedSegCount} segments, needed ${requiredSegCount} for ${planDurationDays} days`;
      const enforcement = `\n\nCRITICAL: This trip is ${planDurationDays} days. You MUST return exactly ${requiredSegCount} segments. Each segment needs a REAL named overnight_city. Do NOT return fewer segments.`;
      const retryPlan = await buildStructuredPlan(env, (user_input || '') + enforcement, clarification_answer, refinements, null);
      if ((retryPlan.segments || []).length >= requiredSegCount) {
        Object.assign(plan, retryPlan);
      } else {
        plan.segments = autoGenerateSegments(plan, planDurationDays, requiredSegCount);
      }
    }

    if (planDurationDays && !plan.duration_days) plan.duration_days = planDurationDays;

    // ── STEP 2: Resolve origin + destination ──────────────────────────────────
    const [resolvedOrigin, resolvedDest] = await Promise.all([
      plan.origin_text ? resolvePlace(plan.origin_text, GOOGLE_KEY) : Promise.resolve(null),
      plan.destination_text ? resolvePlace(plan.destination_text, GOOGLE_KEY) : Promise.resolve(null),
    ]);

    if (!resolvedOrigin) return jsonRes({ error: 'Could not resolve origin location. Please be more specific.' }, 400);
    const origin = resolvedOrigin;
    const dest   = resolvedDest;

    // ── STEP 3: Constraints ───────────────────────────────────────────────────
    const temporalAnchors = plan.temporal_anchors || {};
    const hardConstraints = plan.hard_constraints || [];
    const softConstraints = plan.soft_constraints || [];
    const maxLegKm = temporalAnchors.max_km_per_leg || hardConstraints.find(c => c.type === 'max_km')?.value || null;
    const stopEveryHours = temporalAnchors.stop_every_hours || hardConstraints.find(c => c.type === 'stop_frequency')?.value || null;
    const catchSunset = !!(temporalAnchors.catch_sunset || hardConstraints.some(c => c.type === 'sunset'));
    const isMotorbike = (plan.mode || '').toUpperCase() === 'MOTORBIKE';
    const maxBlockMinutes = stopEveryHours ? Math.min(120, parseFloat(stopEveryHours) * 60) : isMotorbike ? 90 : plan.pacing === 'fast' ? 150 : plan.pacing === 'exploratory' ? 75 : 120;
    const originExclusionKm = plan.origin_exclusion_radius_km || 15;

    // ── STEP 4: Region + segment resolution ──────────────────────────────────
    const resolvedDurationDays = planDurationDays || duration_days || plan?.duration_days || null;
    const rawPlanSegments = plan.segments?.length > 0 ? plan.segments : null;
    const planSegments = rawPlanSegments || (resolvedDurationDays >= 2
      ? autoGenerateSegments(plan, resolvedDurationDays, computeRequiredSegmentCount(resolvedDurationDays))
      : [{ leg_number: 1, start_city: plan.origin_display, end_city: plan.destination_display || plan.origin_display, overnight_city: plan.trip_type !== 'DAY_TRIP' ? plan.destination_display : null, overnight_near_region: temporalAnchors.overnight_near_region || null, route_character: plan.route_character, route_bias: null, max_stops: computeMaxStopsPerLeg({ ...(frontendPlan || plan), duration_days: resolvedDurationDays }, 1), stop_themes: softConstraints.map(c => c.type).filter(Boolean), shaping_waypoints: [], start_progress: 0, end_progress: 1 }]);

    const totalSegs = planSegments.length;
    planSegments.forEach((seg, idx) => {
      if (seg.start_progress == null) seg.start_progress = idx / totalSegs;
      if (seg.end_progress   == null) seg.end_progress   = (idx + 1) / totalSegs;
    });

    const resolvedSegments_meta = [];
    for (const seg of planSegments) {
      let overnightCity = null;
      let regionAnchor  = null;
      const regionPhrase = seg.overnight_near_region || temporalAnchors.overnight_near_region || null;
      if (regionPhrase) {
        const regionResult = await resolveRegion(regionPhrase, env);
        if (regionResult) {
          regionAnchor = regionResult;
          debug.resolved_region_anchors.push({ phrase: regionPhrase, resolved: regionResult.region_name, towns: regionResult.candidate_towns.map(t => t.name) });
          overnightCity = regionResult.chosen_town?.name || regionResult.region_name;
        }
      } else if (seg.overnight_city && !isPlaceholder(seg.overnight_city)) {
        const verified = await resolvePlace(seg.overnight_city, GOOGLE_KEY);
        overnightCity = verified ? (verified.display_name || seg.overnight_city) : null;
      }
      if (overnightCity && regionAnchor && !regionAnchor.candidate_towns?.some(t => t.name === overnightCity)) {
        overnightCity = regionAnchor.candidate_towns?.[0]?.name || null;
      }
      if (overnightCity) debug.chosen_overnight_cities.push(overnightCity);
      resolvedSegments_meta.push({ ...seg, overnight_city_resolved: overnightCity, region_anchor: regionAnchor });
    }

    // ── STEP 5: Shaping waypoints ─────────────────────────────────────────────
    const shapingWaypointCoords = [];
    for (const seg of resolvedSegments_meta) {
      for (const wp of seg.shaping_waypoints || []) {
        if (wp.name && !isPlaceholder(wp.name)) {
          const geo = await resolvePlace(wp.name, GOOGLE_KEY);
          if (geo) shapingWaypointCoords.push({ lat: geo.lat, lng: geo.lng, name: wp.name, purpose: wp.purpose });
        }
      }
    }
    let dedupedWaypoints = shapingWaypointCoords.filter((wp, i) => !shapingWaypointCoords.slice(0, i).some(prev => haversineKm(wp.lat, wp.lng, prev.lat, prev.lng) < 20));

    if (frontendPlan && dedupedWaypoints.length === 0 && dest) {
      const generated = await generateShapingWaypoints(env, plan, origin, dest);
      if (generated.length > 0) {
        const geocoded = await Promise.all(generated.map(async w => {
          const geo = await resolvePlace(w.name, GOOGLE_KEY);
          return geo ? { lat: geo.lat, lng: geo.lng, name: w.name, purpose: w.purpose } : null;
        }));
        dedupedWaypoints = geocoded.filter(Boolean);
      }
    }

    // ── STEP 6: Route shaping ─────────────────────────────────────────────────
    const { routeData, verified_route_character, route_character_honest, truth_note } = await shapeRouteWithTruthCheck(plan, origin, dest, dedupedWaypoints, GOOGLE_KEY);
    debug.route_theme_applied = dedupedWaypoints.length > 0;
    debug.route_character_verified = verified_route_character;
    debug.route_character_honest = route_character_honest;
    debug.truth_note = truth_note;

    const routePoints = routeData?.polyline || (dest ? [{ lat: origin.lat, lng: origin.lng }, { lat: (origin.lat + dest.lat) / 2, lng: (origin.lng + dest.lng) / 2 }, { lat: dest.lat, lng: dest.lng }] : [{ lat: origin.lat, lng: origin.lng }]);
    const totalDistKm = routeData?.distance_km || (dest ? haversineKm(origin.lat, origin.lng, dest.lat, dest.lng) : 0);
    const totalDurMin = routeData?.duration_minutes || totalDistKm / AVG_SPEED_KMH * 60;
    const sunsetInfo = estimateSunsetTime(dest?.lat || origin.lat, dest?.lng || origin.lng);

    // ── STEP 7: Per-leg processing (parallel) ─────────────────────────────────
    debug.leg_count = resolvedSegments_meta.length;
    const usedStopNamesGlobal = new Set();
    const finalSegments = [];

    const segGeometry = resolvedSegments_meta.map((seg, si) => {
      const segStart = seg.start_progress ?? (si / resolvedSegments_meta.length);
      const segEnd   = seg.end_progress   ?? ((si + 1) / resolvedSegments_meta.length);
      const segPts   = routePoints.slice(Math.floor(segStart * routePoints.length), Math.floor(segEnd * routePoints.length) + 1);
      return { segStart, segEnd, segPts, segDistKm: totalDistKm * (segEnd - segStart), segDurMin: totalDurMin * (segEnd - segStart), segOri: segPts[0] || { lat: origin.lat, lng: origin.lng }, segDst: segPts[segPts.length - 1] || (dest ? { lat: dest.lat, lng: dest.lng } : (segPts[0] || { lat: origin.lat, lng: origin.lng })) };
    });

    const firstPassResults = await Promise.all(resolvedSegments_meta.map(async (seg, si) => {
      const { segStart, segEnd, segPts, segDistKm, segOri, segDst } = segGeometry[si];
      return fetchCorridorStops(env, segPts, { ...seg, start_progress: segStart, end_progress: segEnd }, segOri.lat, segOri.lng, segDst.lat, segDst.lng, segDistKm, seg.stop_themes || [], originExclusionKm, new Set(), verified_route_character);
    }));

    const enrichmentResults = await Promise.all(resolvedSegments_meta.map(async (seg, si) => {
      const { segPts, segDistKm } = segGeometry[si];
      if (firstPassResults[si].stops.length < MIN_LOCATIONS_PER_LEG) {
        const BASE_CORRIDOR_KM = Math.max(20, Math.min(80, segDistKm * 0.12));
        return enrichCorridorFromGooglePlaces(env, segPts, segDistKm, seg.stop_themes || [], verified_route_character, BASE_CORRIDOR_KM);
      }
      return null;
    }));

    const secondPassResults = await Promise.all(resolvedSegments_meta.map(async (seg, si) => {
      if (!enrichmentResults[si]?.length) return null;
      const { segStart, segEnd, segPts, segDistKm, segOri, segDst } = segGeometry[si];
      return fetchCorridorStops(env, segPts, { ...seg, start_progress: segStart, end_progress: segEnd }, segOri.lat, segOri.lng, segDst.lat, segDst.lng, segDistKm, seg.stop_themes || [], originExclusionKm, new Set(), verified_route_character);
    }));

    const hotelResults = await Promise.all(resolvedSegments_meta.map(async (seg, si) => {
      const isLastLeg = si === resolvedSegments_meta.length - 1;
      if ((!isLastLeg || plan.trip_type !== 'DAY_TRIP') && seg.overnight_city_resolved) {
        return fetchHotelsForCity(seg.overnight_city_resolved, GOOGLE_KEY);
      }
      return [];
    }));

    for (let si = 0; si < resolvedSegments_meta.length; si++) {
      const seg = resolvedSegments_meta[si];
      const legNumber = seg.leg_number || (si + 1);
      const isLastLeg = si === resolvedSegments_meta.length - 1;
      const { segStart, segEnd, segPts, segDistKm, segDurMin, segOri, segDst } = segGeometry[si];

      let rawStops = firstPassResults[si].stops;
      let weakRejectedCount = firstPassResults[si].weakRejectedCount;
      let fallbackUsed = firstPassResults[si].fallbackUsed;

      if (secondPassResults[si]?.stops?.length > rawStops.length) {
        rawStops = secondPassResults[si].stops;
        fallbackUsed = true;
      }

      debug.rejected_candidates_count += weakRejectedCount;
      if (fallbackUsed) debug.fallback_used = true;

      const driveBlocks = buildDriveBlocks(segPts, maxBlockMinutes, segDistKm, segDurMin);
      if (catchSunset && driveBlocks.length > 0 && isLastLeg) {
        driveBlocks[driveBlocks.length - 1].sunset_candidate = true;
        driveBlocks[driveBlocks.length - 1].sunset_time = sunsetInfo;
      }

      const blockAssigned = assignStopsToBlocks(driveBlocks, rawStops, usedStopNamesGlobal);
      const orderedStops = [];
      for (const block of blockAssigned) {
        const prog = (block.start_progress + block.end_progress) / 2;
        const blockMidProgress = segStart + prog * (segEnd - segStart);
        if (block.anchor_stop)  orderedStops.push(buildStopObject(block.anchor_stop,  block.block_number, 'anchor',  legNumber, blockMidProgress));
        if (block.support_stop) orderedStops.push(buildStopObject(block.support_stop, block.block_number, 'support', legNumber, blockMidProgress + 0.01));
        if (block.scenic_stop)  orderedStops.push(buildStopObject(block.scenic_stop,  block.block_number, 'scenic',  legNumber, blockMidProgress + 0.02));
      }

      const validation = validateSegment(driveBlocks, orderedStops, maxBlockMinutes, segDistKm, maxLegKm);
      if (!validation.valid) { debug.all_violations.push(...validation.violations.map(v => ({ ...v, leg: legNumber })));  debug.validation_passed = false; }

      const cleanStops = orderedStops.filter(s => {
        const name = s.location?.name || '';
        return !isPlaceholder(name) && !validation.violations.some(v => v.rule === 'placeholder_stop_name' && v.stop === name);
      });

      debug.stop_count_per_leg[`leg_${legNumber}`] = cleanStops.length;
      const hotels = hotelResults[si] || [];
      const supportStops = [];
      if (plan.support_strategy !== 'none') {
        if (segDistKm > 120) supportStops.push({ type: 'coffee', note: 'Coffee break around midpoint', progress: segStart + (segEnd - segStart) * 0.45 });
        if (segDistKm > 280) supportStops.push({ type: 'fuel', note: 'Fuel stop recommended', progress: segStart + (segEnd - segStart) * 0.70 });
      }

      finalSegments.push({ leg_number: legNumber, from_city: seg.start_city, to_city: seg.end_city, overnight_city: seg.overnight_city_resolved || null, overnight_city_reason: seg.overnight_city_reason || null, region_anchor: seg.region_anchor ? { name: seg.region_anchor.region_name, lat: seg.region_anchor.lat, lng: seg.region_anchor.lng } : null, route_character: verified_route_character, route_character_honest, route_bias: seg.route_bias || null, themes: seg.stop_themes || [], distance_km: Math.round(segDistKm * 10) / 10, estimated_duration_min: Math.round(segDurMin), start_progress: segStart, end_progress: segEnd, stops: cleanStops, hotels, support_stops: supportStops, drive_blocks: blockAssigned, block_validation: validation, max_block_minutes: maxBlockMinutes, fallback_used: fallbackUsed, weak_stops_rejected: weakRejectedCount, empty_leg: cleanStops.length === 0 });
    }

    // ── STEP 8: Assemble journey ───────────────────────────────────────────────
    const allStops = finalSegments.flatMap(s => s.stops);
    const navWaypoints = [{ name: plan.origin_display, lat: origin.lat, lng: origin.lng, type: 'origin' }, ...allStops.map(s => ({ name: s.location?.name || '', lat: s.location?.latitude || null, lng: s.location?.longitude || null, type: s.stop_role })), dest ? { name: plan.destination_display, lat: dest.lat, lng: dest.lng, type: 'destination' } : null].filter(Boolean);
    const exportWaypoints = navWaypoints.slice(1, -1).map(w => `${w.lat},${w.lng}`).join('|');
    const exportUrl = dest ? `https://www.google.com/maps/dir/${origin.lat},${origin.lng}/${exportWaypoints ? exportWaypoints + '/' : ''}${dest.lat},${dest.lng}` : null;
    const resultStatus = allStops.length > 0 ? 'complete' : 'partial';
    const partialNote = allStops.length === 0 ? 'No stops found along this route — limited coverage in this area.' : null;

    const outputValidation = validatePlannerOutput(planDurationDays, finalSegments.length, allStops.length);
    debug.planner_validation_status = outputValidation.valid ? 'PASS' : 'FAIL';
    debug.planner_validation_fail_reason = outputValidation.reason || null;
    debug.planner_segment_count = finalSegments.length;
    debug.planner_stop_count = allStops.length;
    debug.normalized_duration_days = planDurationDays;

    // ── STEP 9: Persist to Supabase ───────────────────────────────────────────
    let savedJourney = null;
    try {
      savedJourney = await sbInsert(env, 'journeys', { user_id: user.id, user_email: user.email, origin: resolvedOrigin?.display_name || plan.origin_display || '', destination: resolvedDest?.display_name || plan.destination_display || '', origin_lat: origin.lat, origin_lng: origin.lng, destination_lat: dest?.lat || null, destination_lng: dest?.lng || null, trip_type: plan.trip_type, mode: plan.mode, route_character: verified_route_character, route_character_honest, truth_note: truth_note || null, partial_match_note: partialNote, total_distance_km: routeData?.distance_km ? Math.round(routeData.distance_km * 10) / 10 : null, total_duration_hours: routeData?.duration_minutes ? (routeData.duration_minutes / 60).toFixed(1) : null, export_url: exportUrl || null, result_status: resultStatus, user_input_raw: user_input || null, leg_count: finalSegments.length, stop_count: allStops.length, weak_stops_rejected: finalSegments.reduce((s, seg) => s + (seg.weak_stops_rejected || 0), 0), fallback_used: finalSegments.some(s => s.fallback_used) });
      debug.journey_saved = true;
      debug.saved_journey_id = savedJourney.id;

      await Promise.all(finalSegments.map(async (seg, si) => {
        try {
          const savedLeg = await sbInsert(env, 'journey_legs', { journey_id: savedJourney.id, day_index: si, leg_number: seg.leg_number, start_anchor: seg.from_city || '', end_anchor: seg.overnight_city || seg.to_city || '', overnight_city: seg.overnight_city || null, start_progress: seg.start_progress, end_progress: seg.end_progress, distance_km: seg.distance_km || null, drive_time_estimate_min: seg.estimated_duration_min || null, route_character: seg.route_character || null, stop_count: (seg.stops || []).length, fallback_used: seg.fallback_used || false, empty_leg: seg.empty_leg || false });
          seg._saved_leg_id = savedLeg.id;
          await Promise.all([
            ...(seg.stops || []).map((stop, stopIdx) => sbInsert(env, 'journey_stops', { journey_id: savedJourney.id, journey_leg_id: savedLeg.id, stop_index: stopIdx, location_id: stop.location?.id || null, location_name: stop.location?.name || '', location_city: stop.location?.city || null, location_lat: stop.location?.latitude || null, location_lng: stop.location?.longitude || null, stop_type: stop.stop_role === 'main_highlight' ? 'meaningful' : stop.stop_role === 'support_stop' ? 'support' : 'scenic', stop_role: stop.stop_role || null, why_included: stop.why_included || null, confidence: stop.confidence || 'MEDIUM', is_db_backed: !!(stop.location?.id), progress_on_route: stop._progress || null, dwell_minutes: stop.dwell_minutes || 20 }).catch(() => {})),
            ...(seg.hotels || []).map(hotel => sbInsert(env, 'journey_hotels', { journey_id: savedJourney.id, journey_leg_id: savedLeg.id, hotel_name: hotel.name, hotel_city: hotel.city || seg.overnight_city || null, hotel_address: hotel.address || null, booking_url: hotel.booking_url || null, rating: hotel.rating || null, price_level: hotel.price_level || null, lat: hotel.lat || null, lng: hotel.lng || null }).catch(() => {}))
          ]);
        } catch {}
      }));
    } catch {}

    const journey = { journey_title: `${plan.origin_display || 'Your'} → ${plan.destination_display || 'journey'}`, summary: plan.summary_sentence, trip_type: plan.trip_type, mode: plan.mode, route_character: verified_route_character, route_character_honest, truth_note, pacing: plan.pacing, hard_constraints: hardConstraints, soft_constraints: softConstraints, temporal_anchors: temporalAnchors, constraint_valid: debug.validation_passed, resolved_origin: resolvedOrigin ? { display_name: resolvedOrigin.display_name, country: resolvedOrigin.country, lat: resolvedOrigin.lat, lng: resolvedOrigin.lng } : null, resolved_destination: resolvedDest ? { display_name: resolvedDest.display_name, country: resolvedDest.country, lat: resolvedDest.lat, lng: resolvedDest.lng } : null, total_distance_km: routeData?.distance_km ? Math.round(routeData.distance_km * 10) / 10 : null, total_duration_hours: routeData?.duration_minutes ? (routeData.duration_minutes / 60).toFixed(1) : null, saved_journey_id: savedJourney?.id || null, segments: finalSegments.map(seg => ({ ...seg, saved_leg_id: seg._saved_leg_id || null })), main_stops: allStops.filter(s => s.stop_role === 'main_highlight'), nav_waypoints: navWaypoints, export_url: exportUrl, result_status: resultStatus, partial_match_note: partialNote, debug };

    return jsonRes({ phase: 'journey', plan, journey });

  } catch (err) {
    console.error('[buildConciergeJourney] ERROR:', err.message);
    return jsonRes({ error: err.message }, 500);
  }
}
