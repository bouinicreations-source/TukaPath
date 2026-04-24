import React, { useState, useEffect } from "react";
import { base44 } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { saveSetting } from "@/lib/settings-helper";
import { toast } from "sonner";
import { Shield, Globe, Lock, Settings, Wrench, Users } from "lucide-react";

const SETTING_KEYS = [
  "terms_text","terms_version","privacy_text","privacy_version",
  "disclaimer_text","disclaimer_version",
  "hotel_disclaimer","flight_disclaimer","attraction_disclaimer",
  "hotel_button_label","flight_button_label","attraction_button_label",
  "hotel_default_link","flight_default_link","attraction_default_link",
  "blocked_countries","allowed_countries","blocked_ips",
  "min_age","maintenance_mode",
];

export default function AdminLegal({ userRole }) {
  const queryClient = useQueryClient();
  const isOwner = userRole === "owner";
  const isAdminOrOwner = userRole === "admin" || userRole === "owner";

  const { data: rows = [] } = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => base44.entities.SiteSettings.list(),
  });

  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const map = {};
    rows.forEach(r => { map[r.key] = r.value; });
    setForm(map);
  }, [rows]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const saveSection = async (keys) => {
    setSaving(true);
    for (const key of keys) {
      if (form[key] !== undefined) {
        await saveSetting(key, form[key] ?? "", rows);
      }
    }
    queryClient.invalidateQueries({ queryKey: ["site-settings"] });
    toast.success("Saved!");
    setSaving(false);
  };

  const bumpVersion = (prefix) => {
    const now = new Date().toISOString();
    const newVersion = Date.now().toString();
    set(`${prefix}_version`, newVersion);
    set(`${prefix}_updated`, now);
    return newVersion;
  };

  const saveLegalDoc = async (prefix) => {
    setSaving(true);
    const newVersion = bumpVersion(prefix);
    const updatedForm = { ...form, [`${prefix}_version`]: newVersion };
    for (const key of [`${prefix}_text`, `${prefix}_version`, `${prefix}_updated`]) {
      await saveSetting(key, updatedForm[key] ?? "", rows);
    }
    queryClient.invalidateQueries({ queryKey: ["site-settings"] });
    toast.success("Saved & version bumped — users will be asked to re-accept.");
    setSaving(false);
  };

  return (
    <div className="space-y-6">

      {/* Legal Documents */}
      {isAdminOrOwner && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold">Legal Documents</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Saving updates the version — all users will be asked to re-accept on next login.</p>

          {[
            { key: "terms", label: "Terms and Conditions" },
            { key: "privacy", label: "Privacy Policy" },
            { key: "disclaimer", label: "Disclaimer" },
          ].map(({ key, label }) => (
            <div key={key} className="mb-5">
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs font-semibold">{label}</Label>
                <span className="text-[10px] text-muted-foreground">v{form[`${key}_version`] || "—"}</span>
              </div>
              <Textarea
                value={form[`${key}_text`] || ""}
                onChange={e => set(`${key}_text`, e.target.value)}
                className="h-32 text-xs"
                placeholder={`Enter ${label} text...`}
              />
              <Button size="sm" className="mt-2 text-xs" disabled={saving} onClick={() => saveLegalDoc(key)}>
                Save & Bump Version
              </Button>
            </div>
          ))}
        </Card>
      )}

      {/* Booking Disclaimers & Controls */}
      {isAdminOrOwner && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold">Booking Controls & Disclaimers</h2>
          </div>

          {[
            { cat: "hotel", label: "Hotel / Stay" },
            { cat: "flight", label: "Flights" },
            { cat: "attraction", label: "Attraction / Tour" },
          ].map(({ cat, label }) => (
            <div key={cat} className="mb-5 pb-5 border-b border-border last:border-0 last:mb-0 last:pb-0">
              <p className="text-xs font-semibold mb-2">{label}</p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Button Label</Label>
                  <Input
                    value={form[`${cat}_button_label`] || ""}
                    onChange={e => set(`${cat}_button_label`, e.target.value)}
                    placeholder={`e.g. Book a ${label}`}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Default Link</Label>
                  <Input
                    value={form[`${cat}_default_link`] || ""}
                    onChange={e => set(`${cat}_default_link`, e.target.value)}
                    placeholder="https://..."
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Disclaimer (shown under button)</Label>
                <Textarea
                  value={form[`${cat}_disclaimer`] || ""}
                  onChange={e => set(`${cat}_disclaimer`, e.target.value)}
                  className="h-16 text-xs"
                  placeholder="Disclaimer text shown to users..."
                />
              </div>
            </div>
          ))}

          <Button size="sm" className="mt-2 text-xs" disabled={saving}
            onClick={() => saveSection([
              "hotel_button_label","hotel_default_link","hotel_disclaimer",
              "flight_button_label","flight_default_link","flight_disclaimer",
              "attraction_button_label","attraction_default_link","attraction_disclaimer",
            ])}>
            {saving ? "Saving..." : "Save Booking Settings"}
          </Button>
        </Card>
      )}

      {/* Owner-only section */}
      {isOwner && (
        <>
          {/* Access Control */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold">Access Control</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Comma-separated values. Blocked takes priority over allowed.
              Countries use ISO 2-letter codes (e.g. US, GB). IPs support CIDR ranges.
            </p>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Blocked Countries (comma-separated ISO codes)</Label>
                <Input value={form.blocked_countries || ""} onChange={e => set("blocked_countries", e.target.value)} placeholder="e.g. KP, IR, CU" className="text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Allowed Countries (leave empty = all allowed)</Label>
                <Input value={form.allowed_countries || ""} onChange={e => set("allowed_countries", e.target.value)} placeholder="e.g. GB, DE, FR" className="text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Blocked IPs / Ranges (comma-separated)</Label>
                <Input value={form.blocked_ips || ""} onChange={e => set("blocked_ips", e.target.value)} placeholder="e.g. 1.2.3.4, 10.0.0.0/8" className="text-xs" />
              </div>
            </div>
            <Button size="sm" className="mt-3 text-xs" disabled={saving}
              onClick={() => saveSection(["blocked_countries","allowed_countries","blocked_ips"])}>
              {saving ? "Saving..." : "Save Access Rules"}
            </Button>
          </Card>

          {/* Age Control */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold">Age Control</h2>
            </div>
            <div className="space-y-1 max-w-xs">
              <Label className="text-xs">Minimum Registration Age</Label>
              <Input
                type="number"
                min={1}
                max={99}
                value={form.min_age || "13"}
                onChange={e => set("min_age", e.target.value)}
                className="text-xs"
              />
            </div>
            <Button size="sm" className="mt-3 text-xs" disabled={saving}
              onClick={() => saveSection(["min_age"])}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </Card>

          {/* Maintenance Mode */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold">Maintenance Mode</h2>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.maintenance_mode === "true"}
                onCheckedChange={(c) => set("maintenance_mode", c ? "true" : "false")}
              />
              <Label className="text-sm">{form.maintenance_mode === "true" ? "🔴 Maintenance is ON" : "🟢 App is live"}</Label>
            </div>
            <p className="text-xs text-muted-foreground mt-2">When ON, all non-owner users see a maintenance screen.</p>
            <Button size="sm" className="mt-3 text-xs" disabled={saving}
              onClick={() => saveSection(["maintenance_mode"])}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </Card>

          {/* Force Logout */}
          <Card className="p-5 border-destructive/20">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-destructive" />
              <h2 className="text-sm font-bold text-destructive">Danger Zone</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Force all users to log out by invalidating sessions. This cannot be undone.</p>
            <Button
              size="sm"
              variant="destructive"
              className="text-xs"
              disabled={saving}
              onClick={async () => {
                if (!confirm("Force logout ALL users? This will invalidate all active sessions.")) return;
                setSaving(true);
                await saveSetting("force_logout_timestamp", Date.now().toString(), rows);
                toast.success("Force logout token updated. All users will be logged out on next request.");
                setSaving(false);
              }}
            >
              Force Logout All Users
            </Button>
          </Card>
        </>
      )}
    </div>
  );
}