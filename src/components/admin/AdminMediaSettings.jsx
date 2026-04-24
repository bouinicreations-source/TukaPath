import React, { useState, useEffect } from "react";
import { base44 } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Save, Flag, Headphones, Video } from "lucide-react";
import { toast } from "sonner";

const DEFAULTS = {
  enable_issue_reporting: "true",
  enable_paid_audio: "false",
  audio_preview_pct: "70",
  enable_video_tutorial: "false",
  enable_video_by_tier: "false",
  video_allowed_tiers: "free,premium",
};

export default function AdminMediaSettings() {
  const queryClient = useQueryClient();
  const [values, setValues] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);

  const { data: settingsRaw = [] } = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => base44.entities.SiteSettings.list(),
  });

  useEffect(() => {
    const obj = settingsRaw.reduce((acc, s) => { acc[s.key] = s.value; return acc; }, {});
    setValues(v => ({ ...DEFAULTS, ...obj }));
  }, [settingsRaw]);

  const set = (key, val) => setValues(v => ({ ...v, [key]: val }));
  const bool = (key) => values[key] === "true";

  const handleSave = async () => {
    setSaving(true);
    const keysToSave = Object.keys(DEFAULTS);
    for (const key of keysToSave) {
      const existing = settingsRaw.find(s => s.key === key);
      const value = String(values[key]);
      if (existing) {
        await base44.entities.SiteSettings.update(existing.id, { value });
      } else {
        await base44.entities.SiteSettings.create({ key, value });
      }
    }
    queryClient.invalidateQueries({ queryKey: ["site-settings"] });
    toast.success("Media settings saved!");
    setSaving(false);
  };

  const pct = parseInt(values.audio_preview_pct) || 70;

  return (
    <div className="space-y-4">

      {/* Issue Reporting */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Flag className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Issue Reporting</h3>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <Label className="text-sm">Enable "Report an issue" globally</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Shows a report button on location, story, audio, image surfaces</p>
          </div>
          <Switch
            checked={bool("enable_issue_reporting")}
            onCheckedChange={v => set("enable_issue_reporting", v ? "true" : "false")}
          />
        </div>
      </Card>

      {/* Audio Gating */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Headphones className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Audio Gating (Preview Mode)</h3>
        </div>

        <div className="flex items-center justify-between py-2 border-b border-border pb-3 mb-3">
          <div>
            <Label className="text-sm">Enable paid audio gating</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Audio will pause at the preview threshold and prompt unlock</p>
          </div>
          <Switch
            checked={bool("enable_paid_audio")}
            onCheckedChange={v => set("enable_paid_audio", v ? "true" : "false")}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Preview percentage (how much plays before gate)</Label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={10}
              max={95}
              step={5}
              value={pct}
              onChange={e => set("audio_preview_pct", e.target.value)}
              disabled={!bool("enable_paid_audio")}
              className="flex-1 h-2 accent-primary disabled:opacity-40"
            />
            <div className="w-14">
              <Input
                type="number"
                min={10}
                max={95}
                value={pct}
                onChange={e => set("audio_preview_pct", e.target.value)}
                disabled={!bool("enable_paid_audio")}
                className="h-8 text-xs text-center"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {bool("enable_paid_audio")
              ? `Audio plays the first ${pct}% then pauses for unlock.`
              : "Gating is OFF — full audio plays for all users."}
          </p>
        </div>
      </Card>

      {/* Video Tutorial */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Video className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Video Tutorial</h3>
        </div>

        <div className="flex items-center justify-between py-2 border-b border-border pb-3 mb-3">
          <div>
            <Label className="text-sm">Enable video tutorial feature</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Shows video player on location pages when video_url is set</p>
          </div>
          <Switch
            checked={bool("enable_video_tutorial")}
            onCheckedChange={v => set("enable_video_tutorial", v ? "true" : "false")}
          />
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <Label className="text-sm">Restrict video by user tier</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Only allowed tiers can view video content</p>
          </div>
          <Switch
            checked={bool("enable_video_by_tier")}
            onCheckedChange={v => set("enable_video_by_tier", v ? "true" : "false")}
            disabled={!bool("enable_video_tutorial")}
          />
        </div>

        {bool("enable_video_by_tier") && bool("enable_video_tutorial") && (
          <div className="mt-3 space-y-1.5">
            <Label className="text-xs">Allowed tiers (comma-separated)</Label>
            <Input
              value={values.video_allowed_tiers}
              onChange={e => set("video_allowed_tiers", e.target.value)}
              placeholder="free,premium"
              className="text-xs"
            />
            <p className="text-[10px] text-muted-foreground">e.g. free,premium,vip</p>
          </div>
        )}
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full bg-primary hover:bg-primary/90">
        <Save className="w-4 h-4 mr-2" />
        {saving ? "Saving..." : "Save Media Settings"}
      </Button>
    </div>
  );
}