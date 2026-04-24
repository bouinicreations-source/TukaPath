import React, { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import CandidateRow from "./CandidateRow";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

// ── Probable Duplicates Panel ─────────────────────────────────────────────────
function ProbableDuplicatesPanel({ candidates, selected, onToggle }) {
  const [open, setOpen] = useState(false);
  if (!candidates.length) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-amber-100/50 transition-colors"
      >
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-amber-900">Probable Duplicates ({candidates.length})</span>
          <p className="text-[10px] text-amber-700 mt-0.5">Similar names found in DB — review before adding</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-amber-600" /> : <ChevronDown className="w-4 h-4 text-amber-600" />}
      </button>

      {open && (
        <div className="border-t border-amber-200 divide-y divide-amber-100">
          {candidates.map(candidate => (
            <CandidateRow
              key={candidate.place_id}
              candidate={candidate}
              selected={selected.has(candidate.place_id)}
              onToggle={() => onToggle(candidate.place_id)}
              isProbableDuplicate
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Candidate Table ──────────────────────────────────────────────────────
export default function CandidateTable({ candidates, probableDuplicates = [], selected, onToggle, onToggleAll, aiResults = {} }) {
  if (!candidates.length && !probableDuplicates.length) return null;

  const allSelected = candidates.length > 0 && candidates.every(c => selected.has(c.place_id));
  const someSelected = candidates.some(c => selected.has(c.place_id));

  return (
    <div className="space-y-3">
      {/* Clean candidates */}
      {candidates.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
            <Checkbox
              checked={allSelected}
              ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
              onCheckedChange={onToggleAll}
              className="rounded"
            />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              New Candidates ({candidates.length})
            </span>
            <span className="ml-auto text-xs font-bold text-muted-foreground uppercase tracking-wider">Rating</span>
          </div>

          {candidates.map(candidate => (
            <CandidateRow
              key={candidate.place_id}
              candidate={candidate}
              selected={selected.has(candidate.place_id)}
              onToggle={() => onToggle(candidate.place_id)}
              aiReview={aiResults[candidate.place_id] || null}
            />
          ))}
        </div>
      )}

      {/* Probable duplicates — collapsible secondary panel */}
      <ProbableDuplicatesPanel
        candidates={probableDuplicates}
        selected={selected}
        onToggle={onToggle}
      />
    </div>
  );
}