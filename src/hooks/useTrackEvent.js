import { base44 } from "@/api/client";

// Fire-and-forget async tracker — never blocks UI
export function trackEvent(eventType, { locationId, storyType, userId } = {}) {
  try {
    base44.entities.InteractionLog.create({
      event_type: eventType,
      location_id: locationId || null,
      story_type: storyType || null,
      user_id: userId || null,
      timestamp: new Date().toISOString(),
    }).catch(() => {}); // silently ignore failures
  } catch (_) {}
}