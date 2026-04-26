import React, { useState, useEffect } from "react";
import { supabase } from '@/api/supabase';
import PullToRefresh from "@/components/PullToRefresh";
import { base44 } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  User, Coins, Heart, Headphones, Gift, MapPin, Upload, Star,
  LogOut, Copy, ChevronRight, Plus, Info, Bookmark, Edit2, Check, X, Camera, Settings, Trash2, FileText, Shield } from
"lucide-react";
import UserPreferences from "@/components/profile/UserPreferences";
import ExplorerLevel from "@/components/profile/ExplorerLevel";
import CountryAutocomplete from "@/components/adventure/CountryAutocomplete";
import PersonalizationPanel from "@/components/journey/PersonalizationPanel";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";

function PersonalizationPanelLoader() {
  const [profile, setProfile] = React.useState(null);
  React.useEffect(() => {
    base44.functions.invoke('getUserProfile', {}).then(res => {
      if (res?.data?.profile) setProfile(res.data.profile);
    }).catch(() => {});
  }, []);
  return (
    <PersonalizationPanel
      profile={profile}
      onReset={() => {
        base44.functions.invoke('getUserProfile', {}).then(res => {
          if (res?.data?.profile) setProfile(res.data.profile);
        }).catch(() => {});
      }}
    />
  );
}

export default function Profile() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showCreditInfo, setShowCreditInfo] = useState(false);
  const [showGetCredits, setShowGetCredits] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(r => r.data.user).then((u) => {
    if (!u) return;
    u.role = u.app_metadata?.role || u.user_metadata?.role || null;
    setUser(u);
    setEditForm({
      first_name: u.user_metadata?.first_name || u.user_metadata?.full_name?.split(" ")[0] || "",
        last_name: u.last_name || u.full_name?.split(" ").slice(1).join(" ") || "",
        birthdate: u.birthdate || "",
        gender: u.gender || "",
        passport_country: u.passport_country || "",
        country_of_residence: u.country_of_residence || ""
      });
    });
  }, []);

  const { data: siteSettings = [] } = useQuery({ queryKey: ["site-settings"], queryFn: () => base44.entities.SiteSettings.list() });
  const { data: favorites = [] } = useQuery({ queryKey: ["favorites"], queryFn: () => base44.entities.Favorite.list() });
  const { data: discoveries = [] } = useQuery({ queryKey: ["discoveries"], queryFn: () => base44.entities.Discovery.list() });
  const { data: storyPlays = [] } = useQuery({ queryKey: ["storyPlays"], queryFn: () => base44.entities.StoryPlay.list("-created_date") });
  const { data: locations = [] } = useQuery({ queryKey: ["locations"], queryFn: () => base44.entities.Location.list() });
  const { data: listenLater = [] } = useQuery({ queryKey: ["listenLater"], queryFn: () => base44.entities.ListenLater.list("-created_date") });

  const referralCode = user?.referral_code || user?.id?.slice(0, 8);
  const credits = user?.credits ?? 10;
  const totalListens = storyPlays.reduce((sum, p) => sum + (p.play_count || 1), 0);

  const referralLink = `${window.location.origin}?ref=${referralCode}`;

  const copyReferral = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied!");
  };

  const shareReferral = async () => {
    const shareData = {
      title: "Discover hidden stories around the world",
      text: `Explore places with TukaPath — audio stories, hidden spots and more. Use my link to join! 🌍`,
      url: referralLink
    };
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      copyReferral();
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPhoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await supabase.auth.updateUser({ data: { profile_photo_url: file_url } });
    setUser((u) => ({ ...u, profile_photo_url: file_url }));
    setUploadingPhoto(false);
    toast.success("Photo updated!");
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    await supabase.auth.updateUser({ data: { account_deleted: true, email: `deleted_${Date.now()}_${user.email}` } });
    supabase.auth.signOut();
  };

  const handleSaveProfile = async () => {
    const full_name = `${editForm.first_name.trim()} ${editForm.last_name.trim()}`.trim();
    await supabase.auth.updateUser({ data: { ...editForm, full_name } });
    setUser((u) => ({ ...u, ...editForm, full_name }));
    setEditing(false);
    toast.success("Profile saved!");
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>);

  }

  const displayName = user.full_name || (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : null) || user.email?.split("@")[0] || "Explorer";

  return (
    <PullToRefresh
      className="h-full"
      onRefresh={() => {queryClient.invalidateQueries();
        supabase.auth.getUser().then(r => r.data.user).then((u) => {
          if (!u) return;
          u.role = u.app_metadata?.role || u.user_metadata?.role || null;
          setUser(u);
          setEditForm({
           first_name: u.first_name || u.full_name?.split(" ")[0] || "", last_name: u.last_name || u.full_name?.split(" ").slice(1).join(" ") || "", birthdate: u.birthdate || "", gender: u.gender || "", passport_country: u.passport_country || "", country_of_residence: u.country_of_residence || "" });});}}>
      
    <div className="max-w-lg mx-auto px-5 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Profile</h1>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => supabase.auth.signOut()}>
          <LogOut className="w-4 h-4 mr-1" /> Logout
        </Button>
      </div>

      {/* Explorer Level */}
      <div className="mb-4">
        <ExplorerLevel listens={totalListens} tier={user?.explorer_level} />
      </div>

      {/* User Card */}
      <Card className="mb-4 overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-5">
          <div className="flex items-center gap-3">
            {/* Avatar with upload */}
            <label className="relative cursor-pointer group">
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                {user.profile_photo_url ?
                  <img src={user.profile_photo_url} alt="" className="w-full h-full object-cover" /> :

                  <User className="w-7 h-7 text-primary" />
                  }
              </div>
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploadingPhoto ?
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> :

                  <Camera className="w-4 h-4 text-white" />
                  }
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
            </label>
            <div className="flex-1">
              <p className="font-semibold">{displayName}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              {(() => {
                  // user_tier is the single source of truth (set by admin)
                  // fall back to listen-count rank only if not set
                  const tier = user?.explorer_level;
                  const label = tier === "Legend" ? "🏆 Legend" :
                  tier === "Trailblazer" ? "⚡ Trailblazer" :
                  tier === "Pioneer" ? "🗺️ Pioneer" :
                  tier === "Explorer" ? "🧭 Explorer" :
                  totalListens >= 75 ? "🏆 Legend" :
                  totalListens >= 30 ? "⚡ Trailblazer" :
                  totalListens >= 10 ? "🗺️ Pioneer" :
                  "🧭 Explorer";
                  const bg = tier === "Legend" || !tier && totalListens >= 75 ? "#f3e8ff" :
                  tier === "Trailblazer" || !tier && totalListens >= 30 ? "#fef3c7" :
                  tier === "Pioneer" || !tier && totalListens >= 10 ? "#dbeafe" :
                  undefined;
                  return (
                    <Badge variant="secondary" className="text-[10px] mt-1" style={{ background: bg }}>
                    {label}
                  </Badge>);

                })()}
            </div>
            <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setEditing(!editing)}>
              <Edit2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Edit Form */}
        {editing &&
          <div className="border-t border-border p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">First Name</Label>
              <Input value={editForm.first_name} onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))} placeholder="Sara" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Last Name</Label>
              <Input value={editForm.last_name} onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))} placeholder="Ahmed" />
            </div>
          </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Birthdate</Label>
                <Input type="date" value={editForm.birthdate} onChange={(e) => setEditForm((f) => ({ ...f, birthdate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Gender</Label>
                <Select value={editForm.gender} onValueChange={(v) => setEditForm((f) => ({ ...f, gender: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                    <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Passport Country (optional)</Label>
              <CountryAutocomplete value={editForm.passport_country} onChange={(v) => setEditForm((f) => ({ ...f, passport_country: v }))} placeholder="e.g. Netherlands" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Country of Residence (optional)</Label>
              <CountryAutocomplete value={editForm.country_of_residence} onChange={(v) => setEditForm((f) => ({ ...f, country_of_residence: v }))} placeholder="e.g. Germany" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90" onClick={handleSaveProfile}>
                <Check className="w-3.5 h-3.5 mr-1" /> Save
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing(false)}>
                <X className="w-3.5 h-3.5 mr-1" /> Cancel
              </Button>
            </div>
          </div>
          }

        <CardContent className="p-5">
          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3 text-center mb-3">
            <div className="relative">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Coins className="w-4 h-4 text-accent" />
                <button onClick={() => setShowCreditInfo(!showCreditInfo)}>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
              <p className="text-lg font-bold">{credits}</p>
              <p className="text-[10px] text-muted-foreground">Credits</p>
              <button
                  onClick={() => setShowGetCredits(!showGetCredits)}
                  className="text-[10px] text-primary font-medium mt-0.5 hover:underline">
                  
                Get more
              </button>
              {showCreditInfo &&
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-card border border-border rounded-lg shadow-lg p-3 text-xs text-left w-48 z-10">
                  <p className="font-medium mb-1">What are credits?</p>
                  <p className="text-muted-foreground">1 credit = 1 story listen.</p>
                </div>
                }
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Heart className="w-4 h-4 text-destructive" />
              </div>
              <p className="text-lg font-bold">{favorites.length}</p>
              <p className="text-[10px] text-muted-foreground">Wishlist</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Headphones className="w-4 h-4 text-primary" />
              </div>
              <p className="text-lg font-bold">{totalListens}</p>
              <p className="text-[10px] text-muted-foreground">Visited</p>
            </div>
          </div>
          {/* Discoveries row */}
          <div className="grid grid-cols-2 gap-3 text-center border-t border-border pt-3">
            <div>
              <p className="text-lg font-bold">{discoveries.length}</p>
              <p className="text-[10px] text-muted-foreground">Submitted</p>
            </div>
            <div>
              <p className="text-lg font-bold">{discoveries.filter((d) => d.status === "approved").length}</p>
              <p className="text-[10px] text-muted-foreground">Approved</p>
            </div>
          </div>
          {/* Referral code */}
          {referralCode &&
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">Referral code: <span className="font-mono font-semibold text-foreground">{referralCode}</span></p>
              <button onClick={copyReferral} className="text-[10px] text-primary hover:underline">Copy link</button>
            </div>
            }
        {/* Get More Credits Modal */}
        {showGetCredits &&
            <div className="px-5 pb-4">
            <div className="bg-muted/50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold mb-2 flex items-center gap-1"><Coins className="w-3.5 h-3.5 text-accent" /> Get More Credits</p>
              <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => {
                    const adLink = siteSettings.find((s) => s.key === "ad_link")?.value;
                    const msg = siteSettings.find((s) => s.key === "credits_coming_soon_message")?.value || "Coming soon! Stay tuned for this feature.";
                    if (adLink) window.open(adLink, "_blank");else
                    toast.info(msg);
                  }}>
                  
                📺 Watch an Ad
              </Button>
              <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => {
                    const msg = siteSettings.find((s) => s.key === "credits_coming_soon_message")?.value || "Coming soon! Stay tuned for this feature.";
                    toast.info(msg);
                  }}>
                  
                💳 Purchase Credits
              </Button>
              <button onClick={() => setShowGetCredits(false)} className="text-[10px] text-muted-foreground w-full text-center mt-1">Dismiss</button>
            </div>
          </div>
            }
        </CardContent>
      </Card>

      {/* Journey Personalization Panel */}
      <div className="mb-4">
        <PersonalizationPanelLoader />
      </div>

      {/* Preferences */}
      <Card className="mb-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setShowPreferences(!showPreferences)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">Preferences</p>
          </div>
          <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${showPreferences ? "rotate-90" : ""}`} />
        </div>
      </Card>
      {showPreferences &&
        <div className="mb-4">
          <UserPreferences
            user={user}
            onUpdate={(prefs) => setUser((u) => ({ ...u, ...prefs }))} />
          
        </div>
        }
{/* Discovery Submission */}
      










        

      {/* Admin panel link */}
      {(user.role === "admin" || user.role === "owner") &&
        <Link to="/Admin">
          <Card className="mb-4 p-4 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary">Control Panel</p>
                  <p className="text-[10px] text-muted-foreground">Admin dashboard</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-primary" />
            </div>
          </Card>
        </Link>
        }

      {/* Referral */}
      <Card className="mb-4 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-accent" />
            <div>
              <p className="text-sm font-semibold">Invite Friends</p>
              <p className="text-[10px] text-muted-foreground">Both get 10 credits</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyReferral} className="text-xs">
              <Copy className="w-3 h-3 mr-1" /> Copy
            </Button>
            <Button size="sm" onClick={shareReferral} className="text-xs bg-primary hover:bg-primary/90">
              Share
            </Button>
          </div>
        </div>
      </Card>

      {/* Recently Heard */}
      {storyPlays.length > 0 &&
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <Headphones className="w-4 h-4 text-primary" /> Recently Heard
          </h3>
          <div className="space-y-2">
            {storyPlays.slice(0, 5).map((play) => {
              const loc = locations.find((l) => l.id === play.location_id);
              return (
                <Link key={play.id} to={`/LocationDetail?id=${play.location_id}`}>
                  <Card className="p-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{loc?.name || "Story"}</p>
                        <p className="text-[10px] text-muted-foreground">{play.story_type === "quick" ? "Quick Story" : "Deep History"}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </Card>
                </Link>);

            })}
          </div>
        </div>
        }

      {/* Listen Later */}
      {listenLater.length > 0 &&
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <Bookmark className="w-4 h-4 text-primary" /> Listen Later
          </h3>
          <div className="space-y-2">
            {listenLater.map((item) =>
            <Link key={item.id} to={`/LocationDetail?id=${item.location_id}`}>
                <Card className="p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{item.location_name || "Story"}</p>
                      <p className="text-[10px] text-muted-foreground">{item.city}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </Card>
              </Link>
            )}
          </div>
        </div>
        }

      {/* Saved Places */}
      {favorites.length > 0 &&
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-destructive" /> Saved Places
          </h3>
          <div className="space-y-2">
            {favorites.map((fav) =>
            <Link key={fav.id} to={fav.item_type === "location" ? `/LocationDetail?id=${fav.item_id}` : "#"}>
                <Card className="p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{fav.item_name || "Place"}</p>
                      <p className="text-[10px] text-muted-foreground">{fav.city}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </Card>
              </Link>
            )}
          </div>
        </div>
        }

      {/* Legal Links */}
      <div className="mb-4 space-y-1">
        <Link to="/Legal?tab=privacy">
          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Privacy Policy</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </Link>
        <Link to="/Legal?tab=terms">
          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Terms of Use</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </Link>
      </div>

      {/* Delete Account */}
      <div className="mb-6">
        {!showDeleteConfirm ?
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 text-sm text-destructive hover:underline p-3">
            
            <Trash2 className="w-4 h-4" /> Delete Account
          </button> :

          <div className="border border-destructive/30 rounded-xl p-4 space-y-3 bg-destructive/5">
            <p className="text-sm font-semibold text-destructive">Delete your account?</p>
            <p className="text-xs text-muted-foreground">This will permanently remove your data and cannot be undone.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
              <Button size="sm" className="flex-1 bg-destructive hover:bg-destructive/90 text-white" onClick={handleDeleteAccount} disabled={deleting}>
                {deleting ? "Deleting..." : "Yes, Delete"}
              </Button>
            </div>
          </div>
          }
      </div>

      
      {/* My Discoveries - show only pending (reviewed ones are removed) */}
      {discoveries.filter((d) => d.status === "pending").length > 0 &&
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <Upload className="w-4 h-4 text-primary" /> My Discoveries
          </h3>
          <div className="space-y-2">
            {discoveries.filter((d) => d.status === "pending").map((d) =>
            <Card key={d.id} className="p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{d.place_name}</p>
                  <Badge className="text-[10px] bg-muted text-muted-foreground">
                    {d.status}
                  </Badge>
                </div>
              </Card>
            )}
          </div>
        </div>
        }
    </div>
    </PullToRefresh>);

}

function DiscoveryForm({ onSubmitted }) {
  const [form, setForm] = useState({ place_name: "", description: "", latitude: 0, longitude: 0, video_proof_url: "" });
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition((pos) => {
      setForm((f) => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
    });
  }, []);

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm((f) => ({ ...f, video_proof_url: file_url }));
    setUploading(false);
    toast.success("Video uploaded!");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await base44.entities.Discovery.create({ ...form, content_permission_accepted: true });
    setSubmitting(false);
    toast.success("Discovery submitted for review!");
    onSubmitted();
  };

  return (
    <motion.form
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      className="mt-3 space-y-3 overflow-hidden"
      onSubmit={handleSubmit}>
      
      <div className="space-y-2">
        <Label className="text-xs">Place Name</Label>
        <Input placeholder="e.g. Hidden garden on Rue de..." value={form.place_name} onChange={(e) => setForm({ ...form, place_name: e.target.value })} required />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Description</Label>
        <Textarea placeholder="What makes this place special?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required className="h-20" />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Video Proof (optional — earns more credits)</Label>
        <Input type="file" accept="video/*,image/*" onChange={handleVideoUpload} disabled={uploading} className="text-xs" />
        {uploading && <p className="text-xs text-muted-foreground">Uploading...</p>}
        {form.video_proof_url && <p className="text-xs text-primary">✓ File uploaded</p>}
      </div>
      <p className="text-[10px] text-muted-foreground">📍 GPS: {form.latitude.toFixed(4)}, {form.longitude.toFixed(4)} (auto-detected)</p>
      <p className="text-xs font-medium text-primary">If approved you will receive credits.</p>
      <p className="text-[10px] text-muted-foreground">By submitting, you accept that your content may be used in TukaPath.</p>
      <Button type="submit" disabled={submitting} className="w-full rounded-xl bg-primary hover:bg-primary/90" size="sm">
        {submitting ? "Submitting..." : "Submit Discovery"}
      </Button>
    </motion.form>);

}