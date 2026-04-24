import React, { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import MobileSelect from "@/components/ui/MobileSelect";
import { base44 } from "@/api/client";
import { toast } from "sonner";

const CATEGORIES = ["Location", "Story", "Visa", "Image", "Audio", "Map", "Other"];

export default function IssueReportButton({ locationId, locationName, section = "Other", className = "" }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(section);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSaving(true);
    await base44.entities.Discovery.create({
      place_name: `[Issue] ${locationName || locationId || "Unknown"}`,
      description: message,
      latitude: 0,
      longitude: 0,
      admin_notes: JSON.stringify({ section: category, location_id: locationId, reported_at: new Date().toISOString() }),
      status: "pending"
    });
    setSaving(false);
    setOpen(false);
    setMessage("");
    toast.success("Report submitted. Thank you!");
  };

  if (!open) {
    return null;







  }

  return (
    <div className="border border-border rounded-xl p-3 space-y-2 bg-muted/30">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">Report an issue</p>
        <button onClick={() => {setOpen(false);setMessage("");}} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-2">
        <MobileSelect
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={CATEGORIES}
          label="Issue category"
          className="text-xs h-8" />
        
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe the issue..."
          required
          className="w-full text-xs rounded-lg border border-input bg-background px-3 py-2 resize-none h-16 outline-none" />
        
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => {setOpen(false);setMessage("");}}>Cancel</Button>
          <Button type="submit" size="sm" className="text-xs h-7 bg-primary hover:bg-primary/90" disabled={saving || !message.trim()}>
            {saving ? "Sending..." : "Submit"}
          </Button>
        </div>
      </form>
    </div>);

}