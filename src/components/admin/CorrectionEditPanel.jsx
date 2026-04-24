import React, { useState, useEffect } from "react";
import { base44 } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Save, ArrowLeft, Lightbulb, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

// Fields shown per correction type
const SECTION_FIELDS = {
  location: [
    { key: "name", label: "Place Name", multi: false },
    { key: "city", label: "City", multi: false },
    { key: "country", label: "Country", multi: false },
    { key: "description", label: "Description", multi: true },
    { key: "category", label: "Category", multi: false },
  ],
  story: [
    { key: "quick_story", label: "Quick Story", multi: true },
    { key: "deep_story", label: "Deep History", multi: true },
    { key: "quick_story_voice", label: "Quick Story Voice (TTS)", multi: true },
    { key: "deep_story_voice", label: "Deep Story Voice (TTS)", multi: true },
    { key: "fun_fact", label: "Fun Fact", multi: false },
    { key: "mystery_teaser", label: "Mystery Teaser", multi: false },
  ],
  visa: [
    { key: "description", label: "Description", multi: true },
    { key: "safety_note", label: "Safety Note", multi: false },
    { key: "local_etiquette", label: "Local Etiquette", multi: false },
  ],
  other: [
    { key: "description", label: "Description", multi: true },
    { key: "fun_fact", label: "Fun Fact", multi: false },
    { key: "look_closely_tip", label: "Look Closely Tip", multi: false },
    { key: "best_photo_spot", label: "Best Photo Spot", multi: false },
    { key: "nearby_recommendation", label: "Nearby Recommendation", multi: false },
  ],
};

const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-700",
  in_review: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  applied: "bg-primary/10 text-primary",
};

export default function CorrectionEditPanel({ correction, onClose, onApplied }) {
  const [location, setLocation] = useState(null);
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const fields = SECTION_FIELDS[correction.correction_type] || SECTION_FIELDS.other;

  useEffect(() => {
    if (!correction.location_id) { setLoading(false); return; }
    base44.entities.Location.filter({ id: correction.location_id })
      .then(res => {
        const loc = res[0] || null;
        setLocation(loc);
        if (loc) {
          const initial = {};
          fields.forEach(f => { initial[f.key] = loc[f.key] || ""; });
          setEdits(initial);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [correction.location_id]);

  const handleSave = async () => {
    if (!location) { toast.error("No linked location found."); return; }
    setSaving(true);

    // Save only non-empty edits
    const patch = {};
    fields.forEach(f => { if (edits[f.key] !== undefined) patch[f.key] = edits[f.key]; });

    // Snapshot original content
    const originalSnippet = fields.map(f => `${f.label}: ${location[f.key] || "(empty)"}`).join("\n");
    const finalSnippet = fields.map(f => `${f.label}: ${edits[f.key] || "(empty)"}`).join("\n");

    try {
      await base44.entities.Location.update(location.id, patch);
      await base44.entities.UserCorrection.update(correction.id, {
        status: "applied",
        applied_at: new Date().toISOString(),
        original_content: originalSnippet,
        final_content: finalSnippet,
      });
      toast.success("Location updated and correction marked as Applied.");
      onApplied();
    } catch (e) {
      toast.error("Save failed: " + (e.message || "Unknown error"));
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <p className="text-sm font-semibold">Smart Edit — {correction.location_name || "Location"}</p>
            <p className="text-[11px] text-muted-foreground capitalize">
              Correction type: <span className="font-medium">{correction.correction_type}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`text-[10px] ${STATUS_COLORS[correction.status] || ""}`}>
            {correction.status}
          </Badge>
          <Button size="sm" className="bg-primary hover:bg-primary/90 text-xs h-8" onClick={handleSave} disabled={saving || !location}>
            <Save className="w-3.5 h-3.5 mr-1" />
            {saving ? "Saving..." : "Save & Mark Applied"}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-7 h-7 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Suggestion context */}
          <div className="w-80 shrink-0 border-r border-border bg-muted/20 flex flex-col overflow-y-auto">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-1.5 mb-3">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <p className="text-xs font-semibold">User Suggestion</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs leading-relaxed text-amber-900 whitespace-pre-wrap">{correction.message}</p>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Submitted {new Date(correction.created_date).toLocaleDateString()}
              </p>
            </div>

            {location && (
              <div className="p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs font-semibold">Current Content</p>
                </div>
                <div className="space-y-3">
                  {fields.map(f => (
                    <div key={f.key}>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">{f.label}</p>
                      <p className={`text-xs leading-relaxed p-2 rounded-lg bg-card border border-border ${!location[f.key] ? "text-muted-foreground italic" : "text-foreground"}`}>
                        {location[f.key] || "(empty)"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!location && (
              <div className="p-4">
                <p className="text-xs text-destructive">⚠ No linked location found. location_id may be missing or invalid.</p>
              </div>
            )}
          </div>

          {/* Right: Editable fields */}
          <div className="flex-1 overflow-y-auto p-5">
            {!location ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-3">
                <p className="text-sm">No location linked to this correction.</p>
                <p className="text-xs">Ensure location_id is set on the correction record.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-5">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">{location.name}</p>
                    <p className="text-xs text-muted-foreground">{location.city}, {location.country}</p>
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5 text-xs text-blue-800">
                  ✏️ Review the suggestion on the left, then edit the fields below as needed. The user's suggestion will <strong>not</strong> be auto-applied — you control the final content.
                </div>

                <div className="space-y-5 max-w-2xl">
                  {fields.map(f => (
                    <div key={f.key}>
                      <Label className="text-xs font-semibold">{f.label}</Label>
                      {f.multi ? (
                        <Textarea
                          value={edits[f.key] ?? ""}
                          onChange={e => setEdits(prev => ({ ...prev, [f.key]: e.target.value }))}
                          className="mt-1.5 text-sm min-h-[100px]"
                          placeholder={`Enter ${f.label.toLowerCase()}...`}
                        />
                      ) : (
                        <Input
                          value={edits[f.key] ?? ""}
                          onChange={e => setEdits(prev => ({ ...prev, [f.key]: e.target.value }))}
                          className="mt-1.5 text-sm h-9"
                          placeholder={`Enter ${f.label.toLowerCase()}...`}
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-8 pt-4 border-t border-border flex gap-3">
                  <Button className="bg-primary hover:bg-primary/90" onClick={handleSave} disabled={saving}>
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? "Saving..." : "Save Changes & Mark Applied"}
                  </Button>
                  <Button variant="outline" onClick={onClose}>Cancel</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}