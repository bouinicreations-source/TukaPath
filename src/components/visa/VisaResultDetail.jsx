import React, { useState } from "react";
import { VISA_COLORS } from "./visaLogic";
import { base44 } from "@/api/client";
import { Button } from "@/components/ui/button";
import { AlertCircle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

const DISCLAIMER = "Visa guidance is indicative only. Please double-check with the destination country's embassy or consulate before traveling.";

function FeedbackForm({ passportCountry, residenceCountry, destinationCountry, hasUsVisa, hasUkVisa, hasSchengenVisa, resultShown, onClose }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await base44.entities.VisaFeedback.create({
      passport_country: passportCountry || "",
      residence_country: residenceCountry || "",
      destination_country: destinationCountry || "",
      has_us_visa: !!hasUsVisa,
      has_uk_visa: !!hasUkVisa,
      has_schengen_visa: !!hasSchengenVisa,
      result_shown: resultShown || "",
      user_note: note,
      status: "pending",
    });
    setSaving(false);
    toast.success("Thanks! Our team will review your report.");
    onClose();
  };

  return (
    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-amber-800">Report incorrect visa result for {destinationCountry}</p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Optional: describe what the correct information should be..."
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
 * Full visa result block for expanded destination detail.
 */
export default function VisaResultDetail({ result, passportCountry, residenceCountry, destinationCountry, hasUsVisa, hasUkVisa, hasSchengenVisa }) {
  const [showFeedback, setShowFeedback] = useState(false);

  if (!result || result.status === "not_checked") {
    return (
      <div className="bg-muted/40 rounded-xl px-4 py-3 text-xs text-muted-foreground">
        <p className="font-medium mb-1">Visa</p>
        <p>Visa requirements not checked. Add your passport country in the visa section to see requirements.</p>
        <p className="mt-2 text-[10px] text-muted-foreground">{DISCLAIMER}</p>
      </div>
    );
  }

  if (result.status === "no_data") {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs">
        <p className="font-semibold text-amber-800 mb-1">Visa</p>
        <p className="text-amber-700">No data available. Please verify with official sources.</p>
        <p className="mt-2 text-[10px] text-amber-600">{DISCLAIMER}</p>
      </div>
    );
  }

  const colorClass = VISA_COLORS[result.visa_type] || "bg-muted text-muted-foreground";
  const isRestricted = result.is_restricted;

  return (
    <div className={`rounded-xl border px-4 py-3 space-y-2 text-xs ${isRestricted ? "bg-red-50 border-red-200" : "bg-muted/40 border-border"}`}>
      <div className="flex items-center justify-between">
        <p className="font-semibold text-sm">Visa Requirement</p>
        <span className={`px-2 py-0.5 rounded-full font-medium text-[11px] ${colorClass}`}>{result.visa_type}</span>
      </div>

      {isRestricted && (
        <div className="flex items-start gap-2 bg-red-100 rounded-lg px-3 py-2">
          <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 font-medium">Travel eligibility appears restricted. Please verify before making plans.</p>
        </div>
      )}

      {result.guidance && <p className="text-muted-foreground leading-relaxed">{result.guidance}</p>}

      <div className="flex flex-wrap gap-3 pt-1">
        {result.processing_days > 0 && (
          <span className="text-muted-foreground">⏱ Processing: <strong>{result.processing_days} days</strong></span>
        )}
        {result.visa_duration_days > 0 && (
          <span className="text-muted-foreground">📅 Stay: <strong>{result.visa_duration_days} days</strong></span>
        )}
        {result.visa_cost_usd > 0 && (
          <span className="text-muted-foreground">💵 Cost: <strong>${result.visa_cost_usd}</strong></span>
        )}
      </div>

      {result.special_notes && (
        <p className="text-[10px] text-muted-foreground bg-muted/60 rounded px-2 py-1">📝 {result.special_notes}</p>
      )}

      <p className="text-[10px] text-muted-foreground pt-1 border-t border-border">{DISCLAIMER}</p>

      {!showFeedback ? (
        <button
          onClick={() => setShowFeedback(true)}
          className="flex items-center gap-1 text-[10px] text-amber-600 hover:text-amber-700 pt-1"
        >
          <AlertCircle className="w-3 h-3" /> Incorrect for my case
        </button>
      ) : (
        <FeedbackForm
          passportCountry={passportCountry}
          residenceCountry={residenceCountry}
          destinationCountry={destinationCountry}
          hasUsVisa={hasUsVisa}
          hasUkVisa={hasUkVisa}
          hasSchengenVisa={hasSchengenVisa}
          resultShown={result.visa_type}
          onClose={() => setShowFeedback(false)}
        />
      )}
    </div>
  );
}