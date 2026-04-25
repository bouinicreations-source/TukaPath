import { buildConciergeJourney } from './buildConciergeJourney.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
function err(msg, status = 400) { return json({ error: msg }, status); }

async function getUser(request, env) {
  const token = (request.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!token) return null;
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_SERVICE_KEY },
    });
    return res.ok ? res.json() : null;
  } catch { return null; }
}

async function handleLLM(body, env) {
  const { prompt, response_json_schema, system } = body;
  if (!prompt) return err('prompt required');
  const sysPrompt = response_json_schema
    ? `${system || 'You are a helpful assistant.'}\n\nRespond with ONLY valid JSON. No markdown, no preamble.\nSchema: ${JSON.stringify(response_json_schema)}`
    : (system || 'You are a helpful assistant.');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, system: sysPrompt, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) return err(`Claude error ${res.status}`, 502);
  const data = await res.json();
  const text = data.content?.map(b => b.text || '').join('') || '';
  if (response_json_schema) {
    try { return json(JSON.parse(text.replace(/```json\n?|```\n?/g, '').trim())); }
    catch { return err('Invalid JSON from Claude', 502); }
  }
  return json(text);
}

async function handleResolveLocation(body, env) {
  const { query, mode = 'geocode' } = body;
  if (!query) return err('query required');
  const KEY = env.GOOGLE_PLACES_API_KEY;
  if (mode === 'autocomplete') {
    const p = new URLSearchParams({ input: query, key: KEY, language: 'en', types: '(cities)' });
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${p}`);
    const data = await res.json();
    return json((data.predictions || []).slice(0, 5).map(p => ({ description: p.description, place_id: p.place_id })));
  }
  const p = new URLSearchParams({ address: query, key: KEY, language: 'en' });
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${p}`);
  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.[0]) return json(null);
  const r = data.results[0];
  const getComp = t => r.address_components?.find(c => c.types.includes(t))?.long_name || null;
  return json({ canonical_name: r.formatted_address, display_name: getComp('locality') || getComp('administrative_area_level_1') || r.formatted_address, short_name: getComp('locality') || getComp('administrative_area_level_1') || query, country: getComp('country'), region: getComp('administrative_area_level_1'), city: getComp('locality') || getComp('postal_town'), lat: r.geometry.location.lat, lng: r.geometry.location.lng, place_id: r.place_id });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const path = new URL(request.url).pathname.replace(/^\//, '');
    if (path === 'health' || path === '') return json({ ok: true, anthropic: !!env.ANTHROPIC_API_KEY, google: !!env.GOOGLE_PLACES_API_KEY, supabase: !!env.SUPABASE_URL });
    let body = {};
    if (request.method === 'POST') { try { body = await request.json(); } catch { return err('Invalid JSON'); } }
    const user = await getUser(request, env);
    switch (path) {
      case 'llm': return handleLLM(body, env);
      case 'resolveLocation': return handleResolveLocation(body, env);
      case 'getUserProfile': return handleGetUserProfile(body, env, user);
      case 'updateUserProfile': return handleUpdateUserProfile(body, env, user);
      case 'getUserProfile':
  if (!user) return json(null);
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/user_profiles?user_id=eq.${user.id}&select=*`, {
      headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` }
    });
    const data = await res.json();
    return json(Array.isArray(data) ? data[0] || null : data);
  } catch { return json(null); }

case 'updateUserProfile':
  if (!user) return json(null);
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/user_profiles?user_id=eq.${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, Prefer: 'return=representation' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    return json(Array.isArray(data) ? data[0] || null : data);
  } catch { return json(null); } return buildConciergeJourney(body, env, user || { id: 'guest', email: 'guest' });
      default: return err(`Unknown endpoint: ${path}`, 404);
    }
  }
};
