import React, { useState, useEffect } from "react";
import { base44 } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Minus, Save, Coins } from "lucide-react";
import { toast } from "sonner";

export default function AdminCreditManagement() {
  const queryClient = useQueryClient();
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [creditAmount, setCreditAmount] = useState(10);
  const [adLink, setAdLink] = useState("");
  const [comingSoonMsg, setComingSoonMsg] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => base44.entities.SiteSettings.list(),
  });

  React.useEffect(() => {
    const adSetting = settings.find(s => s.key === "ad_link");
    const msgSetting = settings.find(s => s.key === "credits_coming_soon_message");
    if (adSetting) setAdLink(adSetting.value);
    if (msgSetting) setComingSoonMsg(msgSetting.value);
  }, [settings]);

  const filteredUsers = userSearch.trim()
    ? allUsers.filter(u =>
        u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email?.toLowerCase().includes(userSearch.toLowerCase())
      )
    : [];

  const saveSettings = async () => {
    setSavingSettings(true);
    const saveSetting = async (key, value) => {
      const existing = settings.find(s => s.key === key);
      if (existing) await base44.entities.SiteSettings.update(existing.id, { value });
      else await base44.entities.SiteSettings.create({ key, value });
    };
    await Promise.all([
      saveSetting("ad_link", adLink),
      saveSetting("credits_coming_soon_message", comingSoonMsg),
    ]);
    queryClient.invalidateQueries({ queryKey: ["site-settings"] });
    setSavingSettings(false);
    toast.success("Settings saved");
  };

  const adjustCredits = async (delta) => {
    if (!selectedUser) return;
    const newCredits = Math.max(0, (selectedUser.credits ?? 10) + delta);
    await base44.entities.User.update(selectedUser.id, { credits: newCredits });
    setSelectedUser(u => ({ ...u, credits: newCredits }));
    queryClient.invalidateQueries({ queryKey: ["users"] });
    toast.success(`Credits ${delta > 0 ? "added" : "removed"}: ${Math.abs(delta)}`);
  };

  const setExactCredits = async () => {
    if (!selectedUser) return;
    await base44.entities.User.update(selectedUser.id, { credits: creditAmount });
    setSelectedUser(u => ({ ...u, credits: creditAmount }));
    queryClient.invalidateQueries({ queryKey: ["users"] });
    toast.success(`Credits set to ${creditAmount}`);
  };

  return (
    <div className="space-y-5">
      {/* Credit Options Settings */}
      <Card className="p-4 space-y-4">
        <p className="text-sm font-semibold">Credit Options Configuration</p>

        <div className="space-y-2">
          <Label className="text-xs">Advertisement Link (for "Watch an Ad" option)</Label>
          <Input
            value={adLink}
            onChange={e => setAdLink(e.target.value)}
            placeholder="https://your-ad-link.com"
          />
          <p className="text-[10px] text-muted-foreground">Users will be redirected here when they tap "Watch an Ad". Leave blank to show "Coming Soon".</p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Coming Soon Message</Label>
          <Input
            value={comingSoonMsg}
            onChange={e => setComingSoonMsg(e.target.value)}
            placeholder="e.g. This feature is coming soon! Stay tuned."
          />
          <p className="text-[10px] text-muted-foreground">Shown when users tap Watch Ad or Purchase if not configured.</p>
        </div>

        <Button size="sm" onClick={saveSettings} disabled={savingSettings} className="w-full">
          <Save className="w-3.5 h-3.5 mr-1" />
          {savingSettings ? "Saving..." : "Save Settings"}
        </Button>
      </Card>

      {/* Manual Credit Adjustment */}
      <Card className="p-4 space-y-4">
        <p className="text-sm font-semibold">Manual Credit Adjustment</p>
        <div className="space-y-2">
          <Label className="text-xs">Search User</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={userSearch}
              onChange={e => { setUserSearch(e.target.value); setSelectedUser(null); }}
              placeholder="Name or email..."
            />
          </div>
          {filteredUsers.length > 0 && !selectedUser && (
            <div className="border border-border rounded-lg overflow-hidden">
              {filteredUsers.slice(0, 5).map(u => (
                <button
                  key={u.id}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm border-b last:border-0 flex justify-between items-center"
                  onClick={() => { setSelectedUser(u); setUserSearch(u.full_name || u.email); }}
                >
                  <div>
                    <p className="font-medium text-xs">{u.full_name || "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{u.email}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    <Coins className="w-3 h-3 mr-0.5" />{u.credits ?? 10}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedUser && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{selectedUser.full_name || selectedUser.email}</p>
                <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
              </div>
              <Badge variant="secondary" className="text-sm px-3 py-1">
                <Coins className="w-3.5 h-3.5 mr-1" />{selectedUser.credits ?? 10} credits
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => adjustCredits(-5)} className="flex-1">
                <Minus className="w-3.5 h-3.5 mr-1" /> -5
              </Button>
              <Button size="sm" variant="outline" onClick={() => adjustCredits(-1)} className="flex-1">
                <Minus className="w-3.5 h-3.5 mr-1" /> -1
              </Button>
              <Button size="sm" variant="outline" onClick={() => adjustCredits(1)} className="flex-1">
                <Plus className="w-3.5 h-3.5 mr-1" /> +1
              </Button>
              <Button size="sm" variant="outline" onClick={() => adjustCredits(5)} className="flex-1">
                <Plus className="w-3.5 h-3.5 mr-1" /> +5
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                value={creditAmount}
                onChange={e => setCreditAmount(Number(e.target.value))}
                className="flex-1"
                min={0}
              />
              <Button size="sm" onClick={setExactCredits}>Set Exact</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Ecommerce placeholder */}
      <Card className="p-4 border-dashed border-2 border-border">
        <p className="text-sm font-semibold text-muted-foreground text-center">🛒 Ecommerce / Purchase Link</p>
        <p className="text-xs text-muted-foreground text-center mt-1">Coming soon — link to your store or payment page.</p>
      </Card>
    </div>
  );
}