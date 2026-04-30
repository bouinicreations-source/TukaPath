/**
 * client.js — TukaPath API Client
 * Drop-in replacement for base44Client.js
 */
import { supabase } from './supabase';

const WORKER_URL = import.meta.env.VITE_WORKER_URL;

const auth = {
  async me() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  // Attach role from app_metadata so Admin.jsx can read user.role
  user.role = user.app_metadata?.role || 
              user.user_metadata?.role || 
              null;
  return user;
},
  async loginWithGoogle() {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  },
  async logout() {
    return supabase.auth.signOut();
  },
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  }
};

// Explicit entity → table mappings for non-standard names
const TABLE_MAP = {
  location:             'locations',
  location_suggestion:  'location_suggestion',
  visa_feedback:        'visa_feedback',
  discovery:            'discovery',
  favorite:             'favorite',
  story_play:           'story_play',
  listen_later:         'listen_later',
  user_profile:         'user_profiles',
  onboarding_slide:     'onboarding_slide',
  site_settings:        'site_settings',
  journey:              'journeys',
  journey_leg:          'journey_legs',
  journey_stop:         'journey_stops',
  journey_hotel:        'journey_hotels',
};

function tableFor(entityName) {
  const snake = entityName
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
  return TABLE_MAP[snake] || snake;
}

function entityProxy(entityName) {
  const table = tableFor(entityName);
  return {
    async filter(filters = {}, options = {}) {
      let q = supabase.from(table).select(options.select || '*');
      for (const [key, val] of Object.entries(filters)) {
        if (val === null || val === undefined) continue;
        if (typeof val === 'object' && !Array.isArray(val)) {
          for (const [op, operand] of Object.entries(val)) {
            if (op === '$gte') q = q.gte(key, operand);
            else if (op === '$lte') q = q.lte(key, operand);
            else if (op === '$gt')  q = q.gt(key, operand);
            else if (op === '$lt')  q = q.lt(key, operand);
            else if (op === '$in')  q = q.in(key, operand);
            else if (op === '$ne')  q = q.neq(key, operand);
          }
        } else {
          q = q.eq(key, val);
        }
      }
      if (options.order) q = q.order(options.order.field, { ascending: options.order.ascending ?? true });
      if (options.limit) q = q.limit(options.limit);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },

    async list(sortOrOptions, limit) {
      let q = supabase.from(table).select('*');
      if (typeof sortOrOptions === 'string') {
        const desc = sortOrOptions.startsWith('-');
        const field = sortOrOptions.replace(/^-/, '')
          .replace('created_date', 'created_at')
          .replace('updated_date', 'updated_at');
        q = q.order(field, { ascending: !desc });
      } else if (typeof sortOrOptions === 'object' && sortOrOptions?.order) {
        q = q.order(sortOrOptions.order.field, { ascending: sortOrOptions.order.ascending ?? true });
      }
      if (typeof limit === 'number') q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async create(record) {
      const { data, error } = await supabase.from(table).insert(record).select().single();
      if (error) throw error;
      return data;
    },

    async update(id, updates) {
      const { data, error } = await supabase.from(table).update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    },

    async bulkCreate(records) {
      if (!records?.length) return [];
      const { data, error } = await supabase.from(table).insert(records).select();
      if (error) throw error;
      return data || [];
    },
  };
}

const entities = new Proxy({}, {
  get(_, entityName) {
    return entityProxy(entityName);
  }
});

async function callWorker(functionName, payload = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${WORKER_URL}/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Worker error ${res.status}`);
  }
  return res.json();
}

const functions = {
  invoke(functionName, payload) {
    return callWorker(functionName, payload);
  }
};

const integrations = {
  Core: {
    async InvokeLLM({ prompt, response_json_schema }) {
      return callWorker('llm', { prompt, response_json_schema });
    },
    async UploadFile({ file }) {
      const fileName = `${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('uploads').upload(fileName, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(fileName);
      return { file_url: publicUrl };
    }
  }
};

const conciergeSession = {
  STORAGE_KEY: 'tukapath_concierge_state',
  save(state) {
    try {
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify({ state, saved_at: Date.now() }));
    } catch {}
  },
  restore() {
    try {
      const raw = sessionStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;
      const { state, saved_at } = JSON.parse(raw);
      if (Date.now() - saved_at > 2 * 60 * 60 * 1000) { this.clear(); return null; }
      return state || null;
    } catch { return null; }
  },
  clear() {
    try { sessionStorage.removeItem(this.STORAGE_KEY); } catch {}
  },
  isResumeSignal(input) {
    if (!input) return false;
    return /\b(back|done|i('m| am) back|continue|found (flights?|hotel)|booked)\b/i.test(input.trim());
  }
};

export const api = { auth, entities, functions, integrations, conciergeSession };
export const base44 = api;
