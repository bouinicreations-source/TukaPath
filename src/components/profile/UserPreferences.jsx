import React, { useState } from "react";
import { supabase } from '@/api/supabase';
import { base44 } from "@/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Bell, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const INTERESTS = [
  { key: "history", label: "History", emoji: "🏛️" },
  { key: "architecture", label: "Architecture", emoji: "🏗️" },
  { key: "hidden_spots", label: "Hidden Spots", emoji: "🔍" },
  { key: "food", label: "Food", emoji: "🍜" },
  { key: "nature", label: "Nature", emoji: "🌿" },
  { key: "art", label: "Art", emoji: "🎨" },
  { key: "local_culture", label: "Local Culture", emoji: "🎭" },
];

export default function UserPreferences({ user, onUpdate }) {
  const [locationAccess, setLocationAccess] = useState(user?.location_access_enabled ?? true);
  const [notifyNearby, setNotifyNearby] = useState(user?.notify_nearby ?? false);
  const [notifyInterests, setNotifyInterests] = useState(user?.notify_interests ?? false);
  const [interests, setInterests] = useState(user?.interests || []);
  const [saving, setSaving] = useState(false);

  const toggleInterest = (key) => {
    setInterests(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const prefs = {
      location_access_enabled: locationAccess,
      notify_nearby: locationAccess ? notifyNearby : false,
      notify_interests: (locationAccess && notifyNearby) ? notifyInterests : false,
      interests,
    };

    // Request notification permission if needed
    if (prefs.notify_nearby && Notification.permission === "default") {
      await Notification.requestPermission();
    }

    await supabase.auth.updateUser({ data: prefs });
    onUpdate?.(prefs);
    setSaving(false);
    toast.success("Preferences saved!");
  };

  const Toggle = ({ value, onChange, disabled }) => (
    <button
      onClick={() => !disabled && onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
      } ${value && !disabled ? "bg-primary" : "bg-muted-foreground/30"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value && !disabled ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Location & Notifications */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Location & Notifications</p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <div>
                <p className="text-sm font-medium">Enable Location Access</p>
                <p className="text-[10px] text-muted-foreground">Required for nearby features</p>
              </div>
            </div>
            <Toggle value={locationAccess} onChange={setLocationAccess} />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-accent" />
              <div>
                <p className="text-sm font-medium">Notify when places are near me</p>
                <p className="text-[10px] text-muted-foreground">Get alerts for nearby stories</p>
              </div>
            </div>
            <Toggle value={notifyNearby} onChange={setNotifyNearby} disabled={!locationAccess} />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <div>
                <p className="text-sm font-medium">Notify based on my interests</p>
                <p className="text-[10px] text-muted-foreground">Only matching categories</p>
              </div>
            </div>
            <Toggle value={notifyInterests} onChange={setNotifyInterests} disabled={!locationAccess || !notifyNearby} />
          </div>
        </CardContent>
      </Card>

      {/* Interests */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">What are you interested in?</p>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map(({ key, label, emoji }) => {
              const selected = interests.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleInterest(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    selected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {selected && <Check className="w-3 h-3" />}
                  {emoji} {label}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">Used to filter nearby notifications only — content is always visible to all.</p>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full bg-primary hover:bg-primary/90">
        {saving ? "Saving..." : "Save Preferences"}
      </Button>
    </motion.div>
  );
}