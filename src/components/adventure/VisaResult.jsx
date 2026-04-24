import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, Info } from "lucide-react";
import { base44 } from "@/api/client";
import { VISA_COLORS } from "@/lib/visaLogic";
import { toast } from "sonner";

const DISCLAIMER = "Visa guidance is indicative only. Please double-check with the destination country's embassy or consulate before traveling.";

function FeedbackForm({ dest, searchParams, visaResult, onClose }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await base44.entities.VisaFeedback.create({
      passport_country: searchParams?.citizenship || "",
      residence_country: searchParams?.residence || "",
      destination_country: dest.country || dest.city,
      has_us_visa: searchParams?.has_us_visa || false,
      has_uk_visa: searchParams?.has_uk_visa || false,
      has_schengen_visa: searchParams?.has_schengen_visa || false,
      result_shown: visaResult?.visa_type || "not checked",
      user_note: note,
      status: "pending",
    });
    setSaving(false);
    toast.success("Thanks! Our team will review your report.");
    onClose();
  };

  return (
    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-amber-800">Report incorrect visa info for {dest.city}</p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Optional: what is the correct visa information?"
          className="w-full text-xs rounded-lg border border-amber-200 bg-white px-3 py-2 resize-none h-16 outline-none"
        />
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" className="text-xs h-7 bg-amber-600 hover:bg-amber-700 text-white" disabled={saving}>
            {saving ? "Sending..." : "Submit Report"}
          </Button>
        </div>
      </form>
    </div>
  );
}

/**
 * Displays the computed visa result for a destination.
 * variant="card" = compact badge for card header
 * variant="full" = full display with guidance + feedback
 */
export default function VisaResult({ dest, visaResult, searchParams, variant = "full" }) {
  const [showFeedback, setShowFeedback] = useState(false);

  if (!visaResult || visaResult.status === "not_checked") {
    if (variant === "card") return null;
    return (
      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
        <Info className="w-3 h-3" /> Visa not checked
      </div>
    );
  }

  if (visaResult.status === "no_data") {
    if (variant === "card") return <span className="text-[10px] text-muted-foreground">No visa data</span>;
    return (
      <div className="rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        No visa data available. Please verify with official sources.
        <p className="text-[10px] mt-1 text-muted-foreground/70">{DISCLAIMER}</p>
      </div>
    );
  }

  const colorClass = VISA_COLORS[visaResult.visa_type] || "bg-muted text-foreground";
  const isRestricted = visaResult.visa_type === "Not Allowed" || visaResult.entry_status === "Restricted";

  if (variant === "card") {
    return (
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
        {visaResult.visa_type}
      </span>
    );
  }

  return (
    <div className="space-y-2">
      <div className={`rounded-xl p-3 space-y-2 ${isRestricted ? "bg-red-50 border border-red-200" : "bg-muted/40"}`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${colorClass}`}>
            {visaResult.visa_type}
          </span>
          <div className="flex gap-2 text-[10px] text-muted-foreground">
            {visaResult.visa_cost_usd > 0 && <span>${visaResult.visa_cost_usd}</span>}
            {visaResult.processing_days != null && <span>{visaResult.processing_days}d processing</span>}
            {visaResult.visa_duration_days != null && <span>{visaResult.visa_duration_days}d stay</span>}
          </div>
        </div>

        <p className="text-xs text-foreground/80 leading-relaxed">{visaResult.guidance}</p>

        {visaResult.exception_applied && visaResult.exception_reason && (
          <p className="text-[10px] text-primary flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Based on your profile — {visaResult.exception_reason}.
          </p>
        )}

        {visaResult.special_notes && (
          <p className="text-[10px] text-muted-foreground">📝 {visaResult.special_notes}</p>
        )}

        <p className="text-[10px] text-muted-foreground/70 leading-relaxed">{DISCLAIMER}</p>
      </div>

      {showFeedback ? (
        <FeedbackForm dest={dest} searchParams={searchParams} visaResult={visaResult} onClose={() => setShowFeedback(false)} />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7 text-amber-600 hover:text-amber-700 w-full"
          onClick={() => setShowFeedback(true)}
        >
          <AlertCircle className="w-3 h-3 mr-1" /> Incorrect for my case
        </Button>
      )}
    </div>
  );
}