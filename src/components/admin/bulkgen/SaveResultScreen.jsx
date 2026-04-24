import React from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, XCircle, RotateCcw, Eye, EyeOff } from "lucide-react";

export default function SaveResultScreen({ results, summary, mode, onReset }) {
  const modeIsLive = mode === "direct_live";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="p-5 bg-card border border-border rounded-2xl space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <h3 className="text-sm font-bold">Save Complete</h3>
          <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
            modeIsLive ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}>
            {modeIsLive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {modeIsLive ? "Mode B — Direct Live" : "Mode A — Review First"}
          </span>
        </div>

        {/* Summary counts */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-emerald-50 rounded-xl">
            <p className="text-xl font-bold text-emerald-700">{summary.saved}</p>
            <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Saved</p>
          </div>
          <div className="text-center p-3 bg-amber-50 rounded-xl">
            <p className="text-xl font-bold text-amber-700">{summary.dupes}</p>
            <p className="text-[10px] text-amber-600 font-medium mt-0.5">Skipped (dup)</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-xl">
            <p className="text-xl font-bold text-red-600">{summary.errors}</p>
            <p className="text-[10px] text-red-500 font-medium mt-0.5">Errors</p>
          </div>
        </div>

        {/* Context message */}
        {summary.saved > 0 && modeIsLive && (
          <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
            <Eye className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              {summary.saved} location{summary.saved !== 1 ? "s are" : " is"} <strong>live and visible to users</strong>.
              You can hide or delete them anytime from Generated Locations.
            </span>
          </div>
        )}
        {summary.saved > 0 && !modeIsLive && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
            <EyeOff className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              {summary.saved} location{summary.saved !== 1 ? "s are" : " is"} saved as <strong>hidden drafts</strong>.
              Go to Generated Locations → approve to make them live.
            </span>
          </div>
        )}
      </div>

      {/* Per-item results */}
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {results.map((r, i) => (
          <div key={i} className="flex items-center gap-2.5 px-3 py-2 bg-card border border-border rounded-xl text-xs">
            {r.status === "saved"             && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
            {r.status === "skipped_duplicate" && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
            {r.status === "error"             && <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}

            <span className="flex-1 font-medium truncate">{r.name || r.place_id}</span>

            {r.status === "saved"             && <span className="text-emerald-600 font-semibold shrink-0">Saved</span>}
            {r.status === "skipped_duplicate" && <span className="text-amber-600 shrink-0">Already exists</span>}
            {r.status === "error"             && <span className="text-red-500 truncate max-w-[120px]" title={r.reason}>{r.reason}</span>}
          </div>
        ))}
      </div>

      {/* Actions */}
      <Button variant="outline" onClick={onReset} className="w-full rounded-xl">
        <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Generate More Locations
      </Button>
    </div>
  );
}