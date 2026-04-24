import React, { useState, useEffect } from "react";
import { base44 } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Route, Compass, Headphones, Eye, EyeOff, Sparkles } from "lucide-react";
import { toast } from "sonner";

const FEATURE_KEYS = {
  feature_stories:   { label: "Stories",      description: "Audio stories on location pages",             icon: Headphones },
  feature_journey:   { label: "Journey",      description: "Route planner and journey builder",           icon: Route      },
  feature_adventure: { label: "Adventure",    description: "Adventure finder and destination explorer",   icon: Compass    },
  feature_concierge: { label: "AI Concierge", description: "AI-powered trip planning chat assistant",     icon: Sparkles   },
};

const DEFAULTS = Object.fromEntries(Object.keys(FEATURE_KEYS).map(k => [k, "true"]));

export default function AdminFeatures() {
  const queryClient = useQueryClient();
  const [values, setValues] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);

  const { data: settingsRaw = [] } = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => base44.entities.SiteSettings.list(),
  });

  useEffect(() => {
    const obj = settingsRaw.reduce((acc, s) => { acc[s.key] = s.value; return acc; }, {});
    setValues({ ...DEFAULTS, ...obj });
  }, [settingsRaw]);

  const toggle = (key, val) => setValues(v => ({ ...v, [key]: val ? "true" : "false" }));
  const isOn = (key) => values[key] !== "false";

  const handleSave = async () => {
    setSaving(true);
    for (const key of Object.keys(FEATURE_KEYS)) {
      const existing = settingsRaw.find(s => s.key === key);
      const value = String(values[key]);
      if (existing) {
        await base44.entities.SiteSettings.update(existing.id, { value });
      } else {
        await base44.entities.SiteSettings.create({ key, value });
      }
    }
    queryClient.invalidateQueries({ queryKey: ["site-settings"] });
    toast.success("Feature settings saved");
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Disabled features are hidden from public users but remain accessible to admins (shown with an "Admin only" label).
      </p>

      <div className="space-y-3">
        {Object.entries(FEATURE_KEYS).map(([key, { label, description, icon: Icon }]) => {
          const on = isOn(key);
          return (
            <Card key={key} className={`p-5 transition-opacity ${on ? "" : "opacity-70"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${on ? "bg-primary/10" : "bg-muted"}`}>
                    <Icon className={`w-4 h-4 ${on ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-semibold">{label}</Label>
                      {!on && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium">
                          <EyeOff className="w-2.5 h-2.5" /> Admin only
                        </span>
                      )}
                      {on && (
                        <span className="flex items-center gap-1 text-[10px] text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full font-medium">
                          <Eye className="w-2.5 h-2.5" /> Public
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                  </div>
                </div>
                <Switch checked={on} onCheckedChange={v => toggle(key, v)} />
              </div>
            </Card>
          );
        })}
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        <Save className="w-4 h-4 mr-2" />
        {saving ? "Saving…" : "Save Feature Settings"}
      </Button>
    </div>
  );
}