import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X, Save } from "lucide-react";

const FIELDS = [
  { key: "name",               label: "Name",              type: "input" },
  { key: "city",               label: "City",              type: "input" },
  { key: "country",            label: "Country",           type: "input" },
  { key: "category",           label: "Category",          type: "input" },
  { key: "mystery_teaser",     label: "Mystery Teaser",    type: "textarea" },
  { key: "quick_story",        label: "Quick Story",       type: "textarea" },
  { key: "quick_story_voice",  label: "Quick Voice Script",type: "textarea" },
  { key: "deep_story",         label: "Deep Story",        type: "textarea" },
  { key: "fun_fact",           label: "Fun Fact",          type: "textarea" },
  { key: "why_it_matters_today", label: "Why Visit",       type: "textarea" },
  { key: "opening_hours",      label: "Opening Hours",     type: "input" },
  { key: "typical_visit_duration", label: "Visit Duration",type: "input" },
  { key: "image_url",          label: "Image URL",         type: "input" },
];

export default function EditPayloadModal({ item, onSave, onClose }) {
  const [payload, setPayload] = useState({ ...item.payload });

  const update = (key, val) => setPayload(prev => ({ ...prev, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <h3 className="text-sm font-bold">Edit: {payload.name}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {FIELDS.map(({ key, label, type }) => (
            <div key={key}>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                {label}
              </label>
              {type === "textarea" ? (
                <Textarea
                  value={payload[key] || ""}
                  onChange={e => update(key, e.target.value)}
                  className="text-xs min-h-[70px] resize-none"
                />
              ) : (
                <Input
                  value={payload[key] || ""}
                  onChange={e => update(key, e.target.value)}
                  className="text-sm"
                />
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex gap-2 flex-shrink-0">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl text-sm">
            Cancel
          </Button>
          <Button onClick={() => onSave(payload)} className="flex-1 rounded-xl text-sm">
            <Save className="w-3.5 h-3.5 mr-1.5" /> Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}