import React, { useState, useEffect } from "react";
import { base44 } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save } from "lucide-react";

const FIELDS = [
  { key: "headline", label: "Hero Headline", placeholder: "Explore the world differently" },
  { key: "subtitle", label: "Hero Subtitle", placeholder: "Find where your budget can take you..." },
  { key: "tagline", label: "Tagline", placeholder: "Hear the story behind every pin." },
  { key: "hero_image", label: "Hero Image URL", placeholder: "https://..." },
  { key: "card1_subtitle", label: "Stories Card Subtitle", placeholder: "Hear the story behind the place..." },
  { key: "card2_subtitle", label: "Adventure Card Subtitle", placeholder: "Where can your budget take you?" },
  { key: "instagram_url", label: "Instagram URL", placeholder: "https://instagram.com/tukapath" },
  { key: "tiktok_url", label: "TikTok URL", placeholder: "https://tiktok.com/@tukapath" },
  { key: "facebook_url", label: "Facebook URL", placeholder: "https://facebook.com/tukapath" },
  { key: "twitter_url", label: "X / Twitter URL", placeholder: "https://x.com/tukapath" },
];

export default function AdminBrand() {
  const queryClient = useQueryClient();
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);

  const { data: settingsRaw = [] } = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => base44.entities.SiteSettings.list(),
  });

  useEffect(() => {
    const obj = settingsRaw.reduce((acc, s) => { acc[s.key] = s.value; return acc; }, {});
    setValues(obj);
  }, [settingsRaw]);

  const handleSave = async () => {
    setSaving(true);
    for (const [key, value] of Object.entries(values)) {
      const existing = settingsRaw.find(s => s.key === key);
      if (existing) {
        await base44.entities.SiteSettings.update(existing.id, { value });
      } else if (value) {
        await base44.entities.SiteSettings.create({ key, value });
      }
    }
    queryClient.invalidateQueries({ queryKey: ["site-settings"] });
    toast.success("Brand settings saved!");
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-4">Landing Page & Brand Settings</h3>
        <div className="space-y-4">
          {FIELDS.map(f => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-xs">{f.label}</Label>
              <Input
                placeholder={f.placeholder}
                value={values[f.key] || ""}
                onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <Button onClick={handleSave} disabled={saving} className="mt-5 w-full bg-primary hover:bg-primary/90">
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </Card>
    </div>
  );
}