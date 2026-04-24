import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Save, Globe, Shield, AlertTriangle, Power } from "lucide-react";

export default function AdminAccess({ userRole }) {
  const queryClient = useQueryClient();
  const isOwner = userRole === "owner";
  const [saving, setSaving] = useState(null);

  const { data: settings = [] } = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => base44.entities.SiteSettings.list(),
  });

  const get = (key) => settings.find(s => s.key === key)?.value || "";
  const getRecord = (key) => settings.find(s => s.key === key);

  const [local, setLocal] = useState({});
  useEffect(() => {
    if (settings.length > 0) {
      setLocal({
        maintenance_mode: get("maintenance_mode") === "true",
        min_age: get("min_age") || "13",
        blocked_countries: get("blocked_countries"),
        allowed_countries: get("allowed_countries"),
        blocked_ips: get("blocked_ips"),
      });
    }
  }, [settings]);

  const upd = (k, v) => setLocal(p => ({ ...p, [k]: v }));

  const saveKey = async (key, value) => {
    setSaving(key);
    const existing = getRecord(key);
    const val = typeof value === "boolean" ? String(value) : value;
    if (existing) {
      await base44.entities.SiteSettings.update(existing.id, { value: val });
    } else {
      await base44.entities.SiteSettings.create({ key, value: val });
    }
    queryClient.invalidateQueries({ queryKey: ["site-settings"] });
    toast.success("Saved!");
    setSaving(null);
  };

  const forceLogout = async () => {
    // Set a global "force_logout_before" timestamp — AuthContext checks this
    await saveKey("force_logout_before", Date.now().toString());
    toast.success("All users will be logged out on their next request.");
  };

  if (!isOwner) {
    return (
      <Card className="p-6 text-center">
        <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="font-semibold text-sm">Owner Access Only</p>
        <p className="text-xs text-muted-foreground mt-1">Only the Owner role can manage access controls.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Maintenance Mode */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Power className="w-4 h-4 text-destructive" />
          <h3 className="font-semibold text-sm">Maintenance Mode</h3>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Enable Maintenance Mode</p>
            <p className="text-xs text-muted-foreground">All non-admin users will see a maintenance message.</p>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={local.maintenance_mode || false}
              onCheckedChange={v => upd("maintenance_mode", v)}
            />
            <Button size="sm" className="h-7 text-xs bg-primary hover:bg-primary/90"
              disabled={saving === "maintenance_mode"}
              onClick={() => saveKey("maintenance_mode", local.maintenance_mode)}>
              <Save className="w-3 h-3 mr-1" />
              {saving === "maintenance_mode" ? "..." : "Save"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Age Control */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-accent" />
          <h3 className="font-semibold text-sm">Minimum Registration Age</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Minimum Age (years)</Label>
            <Input
              type="number"
              min="1" max="99"
              value={local.min_age || "13"}
              onChange={e => upd("min_age", e.target.value)}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">Users younger than this will be blocked during registration.</p>
          </div>
          <Button size="sm" className="h-8 text-xs bg-primary hover:bg-primary/90 self-end"
            disabled={saving === "min_age"}
            onClick={() => saveKey("min_age", local.min_age)}>
            <Save className="w-3 h-3 mr-1" />
            {saving === "min_age" ? "..." : "Save"}
          </Button>
        </div>
      </Card>

      {/* Country Restrictions */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Country Access Control</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Use 2-letter ISO country codes (e.g. US, GB, DE), comma-separated.
          If "Allowed" is set, only listed countries can access. "Blocked" takes precedence.
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-destructive">Blocked Countries</Label>
              <Button size="sm" className="h-7 text-xs bg-primary hover:bg-primary/90"
                disabled={saving === "blocked_countries"}
                onClick={() => saveKey("blocked_countries", local.blocked_countries || "")}>
                <Save className="w-3 h-3 mr-1" />
                {saving === "blocked_countries" ? "..." : "Save"}
              </Button>
            </div>
            <Input
              value={local.blocked_countries || ""}
              onChange={e => upd("blocked_countries", e.target.value)}
              placeholder="e.g. CN,RU,KP"
              className="text-xs font-mono"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-primary">Allowed Countries Only</Label>
              <Button size="sm" className="h-7 text-xs bg-primary hover:bg-primary/90"
                disabled={saving === "allowed_countries"}
                onClick={() => saveKey("allowed_countries", local.allowed_countries || "")}>
                <Save className="w-3 h-3 mr-1" />
                {saving === "allowed_countries" ? "..." : "Save"}
              </Button>
            </div>
            <Input
              value={local.allowed_countries || ""}
              onChange={e => upd("allowed_countries", e.target.value)}
              placeholder="Leave blank to allow all (except blocked)"
              className="text-xs font-mono"
            />
          </div>
        </div>
      </Card>

      {/* IP Restrictions */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-destructive" />
          <h3 className="font-semibold text-sm">IP Block List</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Comma-separated IPs or CIDR ranges (e.g. 192.168.1.1, 10.0.0.0/24).</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Blocked IPs / Ranges</Label>
            <Button size="sm" className="h-7 text-xs bg-primary hover:bg-primary/90"
              disabled={saving === "blocked_ips"}
              onClick={() => saveKey("blocked_ips", local.blocked_ips || "")}>
              <Save className="w-3 h-3 mr-1" />
              {saving === "blocked_ips" ? "..." : "Save"}
            </Button>
          </div>
          <Input
            value={local.blocked_ips || ""}
            onChange={e => upd("blocked_ips", e.target.value)}
            placeholder="e.g. 1.2.3.4, 10.0.0.0/24"
            className="text-xs font-mono"
          />
        </div>
      </Card>

      {/* Force Logout */}
      <Card className="p-5 border-destructive/30">
        <div className="flex items-center gap-2 mb-3">
          <Power className="w-4 h-4 text-destructive" />
          <h3 className="font-semibold text-sm text-destructive">Force Logout All Users</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">This will invalidate all active sessions. Users will be required to log in again.</p>
        <Button variant="destructive" size="sm" onClick={forceLogout}>
          Force Logout All Users
        </Button>
      </Card>
    </div>
  );
}