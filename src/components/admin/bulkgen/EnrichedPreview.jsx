import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import EnrichedCard from "./EnrichedCard";
import EditPayloadModal from "./EditPayloadModal";
import { CheckCircle2, AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react";

export default function EnrichedPreview({ enriched, decisions, onDecide, onEditSave, onSave, saving }) {
  const [editingItem, setEditingItem] = useState(null);
  const [showModeModal, setShowModeModal] = useState(false);

  const approved = Object.values(decisions).filter(d => d === "approved").length;
  const skipped  = Object.values(decisions).filter(d => d === "skipped").length;
  const pending  = enriched.filter(i => i.status === "enriched" && !decisions[i.place_id]).length;
  const dupes    = enriched.filter(i => i.status === "enriched" && i.duplicate_flag && !decisions[i.place_id]).length;

  const handleApproveAll = () => {
    enriched.forEach(item => {
      if (item.status === "enriched") onDecide(item.place_id, "approved");
    });
  };

  const handleSkipAllDupes = () => {
    enriched.forEach(item => {
      if (item.status === "enriched" && item.duplicate_flag) onDecide(item.place_id, "skipped");
    });
  };

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-card border border-border rounded-2xl">
        <div className="flex gap-4 text-xs">
          <span><strong className="text-emerald-600">{approved}</strong> approved</span>
          <span><strong className="text-muted-foreground">{skipped}</strong> skipped</span>
          <span><strong className="text-foreground">{pending}</strong> pending</span>
          {dupes > 0 && (
            <span className="text-amber-600"><strong>{dupes}</strong> duplicate{dupes !== 1 ? "s" : ""} pending</span>
          )}
        </div>

        <div className="ml-auto flex gap-2 flex-wrap">
          {dupes > 0 && (
            <Button size="sm" variant="outline" onClick={handleSkipAllDupes} className="text-xs rounded-xl h-7">
              <AlertTriangle className="w-3 h-3 mr-1 text-amber-500" /> Skip duplicates
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleApproveAll} className="text-xs rounded-xl h-7">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" /> Approve all
          </Button>
        </div>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {enriched.map(item => {
          if (item.status !== "enriched") return null;
          return (
            <EnrichedCard
              key={item.place_id}
              item={item}
              decision={decisions[item.place_id] ?? null}
              onApprove={() => onDecide(item.place_id, "approved")}
              onSkip={() => onDecide(item.place_id, "skipped")}
              onEdit={() => setEditingItem(item)}
            />
          );
        })}
      </div>

      {/* Sticky save CTA */}
      {approved > 0 && (
        <div className="sticky bottom-4 z-10">
          <div className="bg-card border border-primary/30 rounded-2xl px-5 py-4 shadow-lg space-y-3">
            <div>
              <p className="text-sm font-bold">{approved} location{approved !== 1 ? "s" : ""} ready to save</p>
              <p className="text-xs text-muted-foreground">Choose how to save them into the system</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Mode A: Review First */}
              <button
                onClick={() => !saving && onSave("review_first")}
                disabled={saving}
                className="flex flex-col items-start gap-1 p-3 rounded-xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-50 text-left"
              >
                <div className="flex items-center gap-1.5">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" /> : <EyeOff className="w-3.5 h-3.5 text-amber-700" />}
                  <span className="text-xs font-bold text-amber-800">Save as Review</span>
                </div>
                <p className="text-[10px] text-amber-700 leading-tight">Hidden draft — not visible to users until approved</p>
              </button>

              {/* Mode B: Direct Live */}
              <button
                onClick={() => !saving && onSave("direct_live")}
                disabled={saving}
                className="flex flex-col items-start gap-1 p-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors disabled:opacity-50 text-left"
              >
                <div className="flex items-center gap-1.5">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" /> : <Eye className="w-3.5 h-3.5 text-emerald-700" />}
                  <span className="text-xs font-bold text-emerald-800">Save as Live</span>
                </div>
                <p className="text-[10px] text-emerald-700 leading-tight">Immediately visible to users — still flagged for review</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingItem && (
        <EditPayloadModal
          item={editingItem}
          onSave={(payload) => {
            onEditSave(editingItem.place_id, payload);
            setEditingItem(null);
          }}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  );
}