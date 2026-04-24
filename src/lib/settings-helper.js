import { base44 } from "@/api/client";

/** Load all SiteSettings into a plain key→value object */
export async function loadSettings() {
  try {
    const rows = await base44.entities.SiteSettings.list();
    const map = {};
    rows.forEach(r => { map[r.key] = r.value; });
    return map;
  } catch {
    return {};
  }
}

/** Upsert (create or update) a SiteSettings key */
export async function saveSetting(key, value, allRows) {
  const existing = allRows?.find(r => r.key === key);
  if (existing) {
    await base44.entities.SiteSettings.update(existing.id, { value: String(value) });
  } else {
    await base44.entities.SiteSettings.create({ key, value: String(value) });
  }
}