import React, { useState } from "react";
import { base44 } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Upload, Trash2, Image, RefreshCw, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

const MAX_SLIDES = 5;
const CONTEXTS = [
  { key: "guests",    label: "Guests (not logged in)" },
  { key: "logged_in", label: "Logged-in users" },
];

export default function AdminOnboarding() {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(null);
  const [expanded, setExpanded] = useState(1); // which slide is open

  const { data: settings = [] } = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => base44.entities.SiteSettings.list(),
  });

  const { data: slides = [] } = useQuery({
    queryKey: ["onboarding-slides"],
    queryFn: () => base44.entities.OnboardingSlide.list("order"),
  });

  // ── Settings helpers ──────────────────────────────────────────────────────
  const getSetting = (key) => settings.find(s => s.key === key);
  const getSettingVal = (key) => getSetting(key)?.value;

  const setSetting = async (key, value) => {
    const existing = getSetting(key);
    if (existing) {
      await base44.entities.SiteSettings.update(existing.id, { value: String(value) });
    } else {
      await base44.entities.SiteSettings.create({ key, value: String(value) });
    }
    queryClient.invalidateQueries({ queryKey: ["site-settings"] });
  };

  const onboardingEnabled = getSettingVal("onboarding_enabled") === "true";
  const forceShow         = getSettingVal("onboarding_force_show") === "true";
  const currentVersion    = getSettingVal("onboarding_version") || "1";

  const resetAllUsers = async () => {
    const nextVer = String(parseInt(currentVersion, 10) + 1);
    await setSetting("onboarding_version", nextVer);
    toast.success(`All users will see onboarding again (v${nextVer})`);
  };

  const resetCurrentUser = () => {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("tuka_onboarding_seen_")) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
    toast.success("Your onboarding state cleared — reload to preview it");
  };

  // ── Slide helpers ─────────────────────────────────────────────────────────
  const getSlide = (order) => slides.find(s => s.order === order);

  const updateSlide = async (order, data) => {
    const slide = getSlide(order);
    if (slide) {
      await base44.entities.OnboardingSlide.update(slide.id, data);
    } else {
      await base44.entities.OnboardingSlide.create({ order, enabled: true, show_contexts: ["guests", "logged_in"], ...data });
    }
    queryClient.invalidateQueries({ queryKey: ["onboarding-slides"] });
  };

  const removeSlide = async (slide) => {
    await base44.entities.OnboardingSlide.delete(slide.id);
    queryClient.invalidateQueries({ queryKey: ["onboarding-slides"] });
    toast.success("Slide removed");
  };

  const handleImageUpload = async (order, file) => {
    setUploading(order);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await updateSlide(order, { image_url: file_url });
    setUploading(null);
    toast.success("Image uploaded");
  };

  const toggleContext = async (slide, order, ctx, checked) => {
    const current = slide?.show_contexts || ["guests", "logged_in"];
    const updated = checked ? [...new Set([...current, ctx])] : current.filter(c => c !== ctx);
    await updateSlide(order, { show_contexts: updated });
  };

  // ── Determine active slides for preview info ───────────────────────────────
  const activeSlides = [...slides]
    .filter(s => s.enabled !== false && s.image_url)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const isFinalSlide = (order) => {
    if (activeSlides.length === 0) return false;
    return activeSlides[activeSlides.length - 1].order === order;
  };

  return (
    <div className="space-y-5">
      {/* ── Global controls ─────────────────────────────────────────────── */}
      <Card className="p-4 space-y-4">
        <p className="text-sm font-semibold">Global Settings</p>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">Enable onboarding</p>
            <p className="text-xs text-muted-foreground">Show slides when app opens</p>
          </div>
          <Switch checked={onboardingEnabled} onCheckedChange={val => {
            setSetting("onboarding_enabled", val);
            toast.success(val ? "Onboarding enabled" : "Onboarding disabled");
          }} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">Force show every time</p>
            <p className="text-xs text-muted-foreground">Ignore "already seen" — always show on load</p>
          </div>
          <Switch checked={forceShow} onCheckedChange={val => {
            setSetting("onboarding_force_show", val);
            toast.success(val ? "Force show on" : "Force show off");
          }} />
        </div>

        <div className="pt-3 border-t border-border space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Reset seen state</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="text-xs h-8 gap-1" onClick={resetAllUsers}>
              <RefreshCw className="w-3 h-3" /> Reset all users
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-8 gap-1" onClick={resetCurrentUser}>
              <RotateCcw className="w-3 h-3" /> Reset my state
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            "Reset all users" bumps version (current: v{currentVersion}). Everyone sees onboarding again.
          </p>
        </div>
      </Card>

      {/* ── Active slide summary ─────────────────────────────────────────── */}
      {activeSlides.length > 0 && (
        <div className="text-xs text-muted-foreground px-1">
          {activeSlides.length} active slide{activeSlides.length > 1 ? "s" : ""} — final slide: #{activeSlides[activeSlides.length - 1].order}
        </div>
      )}

      {/* ── Slides ──────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground font-medium">Slides (up to {MAX_SLIDES})</p>
        {Array.from({ length: MAX_SLIDES }, (_, i) => i + 1).map(order => {
          const slide = getSlide(order);
          const isExpanded = expanded === order;
          const contexts = slide?.show_contexts || ["guests", "logged_in"];
          const isFinal = isFinalSlide(order);

          return (
            <Card key={order} className={`overflow-hidden ${isFinal && slide ? "border-primary/40" : ""}`}>
              {/* Header row */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => setExpanded(isExpanded ? null : order)}
              >
                <div className="flex items-center gap-3">
                  {slide?.image_url ? (
                    <img src={slide.image_url} alt="" className="w-10 h-10 rounded object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                      <Image className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      Slide {order}
                      {isFinal && slide && <span className="ml-2 text-[10px] text-primary font-semibold uppercase tracking-wide">Final</span>}
                    </p>
                    {slide?.title && <p className="text-xs text-muted-foreground truncate max-w-[180px]">{slide.title}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {slide && (
                    <Switch
                      checked={slide.enabled !== false}
                      onCheckedChange={val => updateSlide(order, { enabled: val })}
                      onClick={e => e.stopPropagation()}
                    />
                  )}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                  {/* Image */}
                  {slide?.image_url ? (
                    <div className="relative">
                      <img src={slide.image_url} alt={`Slide ${order}`} className="w-full h-36 object-cover rounded-lg" />
                      <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                        <span className="text-white text-xs font-medium flex items-center gap-1">
                          <Upload className="w-3.5 h-3.5" /> Change Image
                        </span>
                        <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && handleImageUpload(order, e.target.files[0])} />
                      </label>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                      {uploading === order ? (
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Image className="w-7 h-7 text-muted-foreground mb-1.5" />
                          <span className="text-xs text-muted-foreground">Upload background image</span>
                        </>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && handleImageUpload(order, e.target.files[0])} />
                    </label>
                  )}

                  {/* Text content */}
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Title</Label>
                      <Input
                        className="h-8 text-xs mt-1"
                        placeholder="e.g. Discover hidden stories"
                        defaultValue={slide?.title || ""}
                        onBlur={e => updateSlide(order, { title: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Subtitle</Label>
                      <Input
                        className="h-8 text-xs mt-1"
                        placeholder="e.g. Every place has a tale to tell"
                        defaultValue={slide?.subtitle || ""}
                        onBlur={e => updateSlide(order, { subtitle: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Audience */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Show to</p>
                    <div className="flex flex-col gap-1.5">
                      {CONTEXTS.map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={contexts.includes(key)}
                            onChange={e => toggleContext(slide, order, key, e.target.checked)}
                            className="rounded border-border"
                          />
                          <span className="text-xs">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Button controls — non-final */}
                  {!isFinal && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Navigation buttons</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Next button</Label>
                            <Switch
                              checked={slide?.show_next !== false}
                              onCheckedChange={val => updateSlide(order, { show_next: val })}
                            />
                          </div>
                          <Input
                            className="h-7 text-xs"
                            placeholder="Next"
                            defaultValue={slide?.next_label || ""}
                            onBlur={e => updateSlide(order, { next_label: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Skip button</Label>
                            <Switch
                              checked={slide?.show_skip !== false}
                              onCheckedChange={val => updateSlide(order, { show_skip: val })}
                            />
                          </div>
                          <Input
                            className="h-7 text-xs"
                            placeholder="Skip"
                            defaultValue={slide?.skip_label || ""}
                            onBlur={e => updateSlide(order, { skip_label: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CTA controls — final slide */}
                  {isFinal && slide && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Final slide CTAs</p>
                      <div>
                        <Label className="text-xs">Primary button label</Label>
                        <Input
                          className="h-7 text-xs mt-1"
                          placeholder="Start exploring"
                          defaultValue={slide?.cta_primary_label || ""}
                          onBlur={e => updateSlide(order, { cta_primary_label: e.target.value })}
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <Label className="text-xs">Secondary button (goes to login)</Label>
                          <Switch
                            checked={slide?.cta_secondary_enabled === true}
                            onCheckedChange={val => updateSlide(order, { cta_secondary_enabled: val })}
                          />
                        </div>
                        <Input
                          className="h-7 text-xs"
                          placeholder="Unlock full access"
                          defaultValue={slide?.cta_secondary_label || ""}
                          onBlur={e => updateSlide(order, { cta_secondary_label: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Remove */}
                  {slide && (
                    <div className="pt-1 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive text-xs h-7 gap-1"
                        onClick={() => removeSlide(slide)}
                      >
                        <Trash2 className="w-3 h-3" /> Remove slide
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}