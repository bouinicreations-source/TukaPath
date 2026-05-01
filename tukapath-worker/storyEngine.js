/**
 * storyEngine.js
 * 
 * TukaPath Story Generation Engine
 * 
 * Generates captivating location stories using the Curious Insider voice.
 * Stories are structured as: Hook → Context → Revelation → Experience → Call to Action
 * 
 * Audio: OpenAI TTS (ElevenLabs upgrade path ready)
 * Statistics: Completion rate tracking, drop-off analysis, A/B versioning
 */

// ── MASTER STORY PROMPT ──────────────────────────────────────────────────────

const TUKAPATH_VOICE_BRIEF = `You are TukaPath's story voice — The Curious Insider.

PERSONALITY:
You are a brilliant friend who has been everywhere. Warm, slightly conspiratorial, 
genuinely excited about what makes each place remarkable. You cannot help but tell 
people the most interesting thing about every place you visit. You know the real story 
behind the official story. You notice what most people walk past.

You are NOT:
- A museum audio guide (never boring, never dry)
- A tour operator (never selling anything)
- A history teacher (never lecturing)
- A travel blogger (never generic)

VOICE RULES — NO EXCEPTIONS:
1. First sentence must create a question in the listener's mind within 8 seconds
2. Never start with the name of the place or a date
3. Never use these openers: "Welcome to", "This is", "Built in", "Located in", "Known for"
4. Every story must have one thing the listener can DO or LOOK FOR right now
5. End with something that makes them want to tell someone else
6. Write for ears not eyes — short sentences, natural rhythm, conversational
7. One surprising fact minimum — something that reframes everything
8. The hook must work even if they only hear the first 15 seconds`;

const QUICK_STORY_PROMPT = (location) => `${TUKAPATH_VOICE_BRIEF}

LOCATION: ${location.name}
CITY: ${location.city || 'unknown'}
COUNTRY: ${location.country || 'unknown'}  
CATEGORY: ${location.category || 'landmark'}
CONTEXT: ${location.description || location.quick_story || 'no existing description'}
ARCHITECT/CREATOR: ${location.architect_creator || 'unknown'}
BUILT: ${location.built_year || 'unknown'}

Write a QUICK STORY — spoken in under 60 seconds (maximum 130 words).

STRUCTURE (this exact order):
1. HOOK (1-2 sentences): Start with a tension, mystery, or surprising contrast. 
   Create a question the listener must have answered.
2. REVELATION (2-3 sentences): Answer the hook with the real story. 
   The thing that changes how you see this place.
3. EXPERIENCE (1-2 sentences): What to look for, notice, or do RIGHT NOW while here.
4. CLOSER (1 sentence): Something they will want to tell someone tonight.

QUALITY BAR: Would someone share this story with a friend after hearing it? 
If not, rewrite.

Return ONLY the story text. No labels. No markdown. No quotes around it.
Write it exactly as it will be spoken aloud.`;

const DEEP_STORY_PROMPT = (location) => `${TUKAPATH_VOICE_BRIEF}

LOCATION: ${location.name}
CITY: ${location.city || 'unknown'}
COUNTRY: ${location.country || 'unknown'}
CATEGORY: ${location.category || 'landmark'}
CONTEXT: ${location.description || location.quick_story || location.deep_story || 'none'}
ARCHITECT/CREATOR: ${location.architect_creator || 'unknown'}
BUILT: ${location.built_year || 'unknown'}
QUICK STORY ALREADY WRITTEN: ${location.quick_story || 'none'}

Write a DEEP STORY — spoken in 3-4 minutes (700-900 words).

This is the full experience. The listener has chosen to go deeper. Reward that choice.

STRUCTURE:
1. HOOK (different from quick story if quick story exists — new angle)
2. THE REAL HISTORY (the version the guidebooks get wrong or incomplete)
3. THE HIDDEN LAYER (something physical they can verify right now while standing there)
4. THE HUMAN STORY (a specific person, a specific moment, a specific decision that changed this place)
5. THE CONNECTION (how this place connects to something larger — a city, a era, a human truth)
6. THE INSIDER CLOSE (one specific thing to do, see, or remember that most visitors miss)

QUALITY BAR: Would someone listen to this for the full 4 minutes without skipping? 
Every paragraph must earn the next one.

Return ONLY the story text. No labels. No markdown. No quotes.`;

const MYSTERY_TEASER_PROMPT = (location, quickStory) => `${TUKAPATH_VOICE_BRIEF}

LOCATION: ${location.name}, ${location.city}, ${location.country}
QUICK STORY: ${quickStory}

Write a MYSTERY TEASER — 15-20 words maximum.
This appears as a text card BEFORE the user taps play.
Its only job: make them tap play.

Like a great trailer — reveal just enough to create irresistible curiosity.
Do NOT give away the revelation. Create the question, not the answer.

Examples of good teasers:
- "The official story is missing one detail that changes everything."
- "Most people walk past the most important thing in this building."
- "There is something here that almost no tourist ever notices."

Return ONLY the teaser. No labels. No punctuation at the end unless it is a question.`;

const PRE_VISIT_INTEL_PROMPT = (location) => `You are a world-travelled insider who knows the practical secrets of famous locations.

LOCATION: ${location.name}, ${location.city}, ${location.country}
CATEGORY: ${location.category}

Generate PRE-VISIT INTELLIGENCE — the practical things worth knowing BEFORE going in.
Think: passport stamps, hidden features, booking tricks, what to bring, what NOT to do,
free things not advertised, best entrance, photo spots, timing secrets.

Examples:
- "Bring your passport — there is a free official stamp at the entrance most visitors miss"
- "Book the tower access when buying tickets online — it sells out but most people don't know it exists"
- "Thursday morning is locals-only quiet. Saturday afternoon is tourist chaos."
- "Ask for the kitchen tour — it is not on the menu but they do it for anyone who asks"

Return a JSON object:
{
  "pre_visit_intelligence": "the single most important thing to know before going in (1-2 sentences)",
  "look_closely_tip": "something specific to notice while there that most people miss (1 sentence)",
  "insider_secret": "the thing that makes locals smile when tourists discover it (1 sentence, optional)",
  "best_photo_spot": "exactly where to stand for the best photo (1 sentence, optional)",
  "must_do": "the one thing not to leave without doing (1 sentence, optional)"
}`;

// ── AUDIO GENERATION ─────────────────────────────────────────────────────────

// OpenAI TTS voices mapped to story types
// Upgrade path: replace these functions with ElevenLabs calls
const VOICE_MAP = {
  quick:  'onyx',    // warm, confident, slightly mysterious
  deep:   'onyx',    // same voice, slower pace
  teaser: 'onyx',
};

async function generateAudio(text, type, env) {
  if (!env.OPENAI_API_KEY) throw new Error('OpenAI key not configured');
  if (!text?.trim()) throw new Error('No text to convert');

  // Clean text for TTS — remove markdown, clean punctuation
  const cleanText = text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const voice = VOICE_MAP[type] || 'onyx';
  
  // Speed: quick stories slightly faster, deep stories normal pace
  const speed = type === 'quick' ? 1.0 : 0.95;

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'tts-1-hd',  // HD quality
      input: cleanText,
      voice,
      speed,
      response_format: 'mp3',
    }),
  });

  if (!res.ok) {
    const e = await res.text();
    throw new Error(`OpenAI TTS error: ${e}`);
  }

  return res.arrayBuffer();
}

async function uploadAudioToSupabase(audioBuffer, locationId, type, env) {
  const fileName = `stories/${locationId}/${type}_${Date.now()}.mp3`;
  
  const res = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/location-audio/${fileName}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/mpeg',
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'x-upsert': 'true',
      },
      body: audioBuffer,
    }
  );

  if (!res.ok) {
    const e = await res.text();
    throw new Error(`Storage upload error: ${e}`);
  }

  return `${env.SUPABASE_URL}/storage/v1/object/public/location-audio/${fileName}`;
}

// ── GPT CALL HELPER ──────────────────────────────────────────────────────────

async function gpt(prompt, env, jsonMode = false) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: jsonMode ? 800 : 1200,
      temperature: 0.8,  // slightly creative for stories
      response_format: jsonMode ? { type: 'json_object' } : undefined,
      messages: [
        { role: 'system', content: jsonMode ? 'Return valid JSON only.' : 'You are a master travel storyteller.' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const e = await res.text();
    throw new Error(`GPT error: ${e}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  
  if (jsonMode) {
    try { return JSON.parse(text); }
    catch { throw new Error('Invalid JSON from GPT: ' + text.slice(0, 100)); }
  }
  return text.trim();
}

// ── WORD COUNT → DURATION ESTIMATE ──────────────────────────────────────────

function estimateDuration(text) {
  // Average speaking pace: 130 words per minute
  const words = text.split(/\s+/).length;
  return Math.round((words / 130) * 60); // seconds
}

// ── MAIN STORY GENERATION ────────────────────────────────────────────────────

export async function generateLocationStory(location, env, options = {}) {
  const {
    generateQuick = true,
    generateDeep = false,
    generateAudio: shouldGenerateAudio = false,
    versionNote = null,
  } = options;

  const result = {
    location_id: location.id,
    success: false,
    quick_story: null,
    deep_story: null,
    mystery_teaser: null,
    pre_visit_intelligence: null,
    look_closely_tip: null,
    insider_secret: null,
    best_photo_spot: null,
    must_do: null,
    quick_audio_url: null,
    deep_audio_url: null,
    quick_audio_duration_seconds: null,
    deep_audio_duration_seconds: null,
    has_story: false,
    version_note: versionNote,
    errors: [],
  };

  try {
    // ── Step 1: Generate quick story ────────────────────────────────────────
    if (generateQuick) {
      result.quick_story = await gpt(QUICK_STORY_PROMPT(location), env);
      result.has_story = true;
      result.quick_audio_duration_seconds = estimateDuration(result.quick_story);
    }

    // ── Step 2: Generate mystery teaser ─────────────────────────────────────
    if (result.quick_story) {
      result.mystery_teaser = await gpt(
        MYSTERY_TEASER_PROMPT(location, result.quick_story), env
      );
    }

    // ── Step 3: Generate pre-visit intelligence ──────────────────────────────
    const intel = await gpt(PRE_VISIT_INTEL_PROMPT(location), env, true);
    result.pre_visit_intelligence = intel.pre_visit_intelligence || null;
    result.look_closely_tip       = intel.look_closely_tip || null;
    result.insider_secret         = intel.insider_secret || null;
    result.best_photo_spot        = intel.best_photo_spot || null;
    result.must_do                = intel.must_do || null;

    // ── Step 4: Generate deep story (if requested) ───────────────────────────
    if (generateDeep) {
      const locationWithQuick = { ...location, quick_story: result.quick_story };
      result.deep_story = await gpt(DEEP_STORY_PROMPT(locationWithQuick), env);
      result.deep_audio_duration_seconds = estimateDuration(result.deep_story);
    }

    // ── Step 5: Generate audio (if requested) ────────────────────────────────
    if (shouldGenerateAudio && result.quick_story) {
      try {
        const audioBuffer = await generateAudio(result.quick_story, 'quick', env);
        result.quick_audio_url = await uploadAudioToSupabase(
          audioBuffer, location.id, 'quick', env
        );
      } catch (e) {
        result.errors.push(`Quick audio failed: ${e.message}`);
      }
    }

    if (shouldGenerateAudio && result.deep_story) {
      try {
        const audioBuffer = await generateAudio(result.deep_story, 'deep', env);
        result.deep_audio_url = await uploadAudioToSupabase(
          audioBuffer, location.id, 'deep', env
        );
      } catch (e) {
        result.errors.push(`Deep audio failed: ${e.message}`);
      }
    }

    result.success = true;
  } catch (e) {
    result.errors.push(e.message);
  }

  return result;
}

// ── SAVE STORY TO DATABASE ───────────────────────────────────────────────────

export async function saveStory(locationId, story, env, isNewVersion = false) {
  const update = {
    quick_story:                story.quick_story,
    mystery_teaser:             story.mystery_teaser,
    pre_visit_intelligence:     story.pre_visit_intelligence,
    look_closely_tip:           story.look_closely_tip,
    insider_secret:             story.insider_secret,
    best_photo_spot:            story.best_photo_spot,
    must_do:                    story.must_do,
    has_story:                  story.has_story,
    record_state:               'enriched',
    updated_at:                 new Date().toISOString(),
  };

  if (story.deep_story)              update.deep_story = story.deep_story;
  if (story.quick_audio_url)         update.quick_audio_url = story.quick_audio_url;
  if (story.deep_audio_url)          update.deep_audio_url = story.deep_audio_url;
  if (story.quick_audio_duration_seconds) update.audio_duration_seconds = story.quick_audio_duration_seconds;

  // Save current story as a version before overwriting
  if (isNewVersion) {
    const existing = await fetch(
      `${env.SUPABASE_URL}/rest/v1/locations?id=eq.${locationId}&select=quick_story,mystery_teaser`,
      { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
    ).then(r => r.json());

    if (existing?.[0]?.quick_story) {
      await fetch(`${env.SUPABASE_URL}/rest/v1/location_story_versions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          location_id:   locationId,
          quick_story:   existing[0].quick_story,
          mystery_teaser: existing[0].mystery_teaser,
          version_note:  story.version_note || 'replaced by new generation',
          created_at:    new Date().toISOString(),
        }),
      });
    }
  }

  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/locations?id=eq.${locationId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify(update),
    }
  );

  if (!res.ok) throw new Error(`Save failed: ${await res.text()}`);
  return res.json();
}

// ── BULK STORY GENERATION ────────────────────────────────────────────────────

export async function generateBulkStories(locationIds, env, options = {}) {
  const results = [];
  const batchSize = 3; // Process 3 at a time to avoid timeouts

  for (let i = 0; i < locationIds.length; i += batchSize) {
    const batch = locationIds.slice(i, i + batchSize);
    
    const batchResults = await Promise.all(batch.map(async (locationId) => {
      try {
        // Fetch location data
        const locRes = await fetch(
          `${env.SUPABASE_URL}/rest/v1/locations?id=eq.${locationId}&select=*`,
          { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
        );
        const locs = await locRes.json();
        const location = locs?.[0];
        if (!location) return { locationId, error: 'Location not found' };

        const story = await generateLocationStory(location, env, options);
        if (story.success) {
          await saveStory(locationId, story, env, !!location.quick_story);
        }
        return { locationId, name: location.name, success: story.success, errors: story.errors };
      } catch (e) {
        return { locationId, success: false, error: e.message };
      }
    }));

    results.push(...batchResults);

    // Small delay between batches to respect rate limits
    if (i + batchSize < locationIds.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return results;
}

// ── STORY STATISTICS ─────────────────────────────────────────────────────────

export async function recordStoryPlay(data, env) {
  const {
    user_id, location_id, story_type,
    started_at, ended_at,
    duration_played_seconds, total_duration_seconds,
    triggered_by, session_id,
  } = data;

  const completion_rate = total_duration_seconds > 0
    ? Math.min(1, duration_played_seconds / total_duration_seconds)
    : 0;

  const drop_off_second = duration_played_seconds < total_duration_seconds
    ? duration_played_seconds
    : null;

    
  await fetch(`${env.SUPABASE_URL}/rest/v1/story_play_events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      user_id, location_id, story_type,
      started_at, ended_at,
      duration_played_seconds,
      total_duration_seconds,
      completion_rate,
      drop_off_second,
      triggered_by: triggered_by || 'map_tap',
      session_id: session_id || null,
      created_at: new Date().toISOString(),
    }),
  });

  return { completion_rate };
}
