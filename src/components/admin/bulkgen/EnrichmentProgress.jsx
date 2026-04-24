import React from "react";
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

export default function EnrichmentProgress({ items }) {
  const done   = items.filter(i => i.status === "enriched").length;
  const errors = items.filter(i => i.status === "error" || i.status === "skipped").length;
  const total  = items.length;
  const pct    = total ? Math.round((done + errors) / total * 100) : 0;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {pct < 100
            ? <Loader2 className="w-4 h-4 text-primary animate-spin" />
            : <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          }
          <span className="text-sm font-semibold">
            {pct < 100 ? `Enriching candidates… ${done + errors}/${total}` : "Enrichment complete"}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Per-item status */}
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            {item.status === "enriched"  && <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />}
            {item.status === "pending"   && <Loader2 className="w-3 h-3 text-primary animate-spin flex-shrink-0" />}
            {(item.status === "error" || item.status === "skipped") && <XCircle className="w-3 h-3 text-destructive flex-shrink-0" />}
            <span className={item.status === "error" || item.status === "skipped" ? "text-destructive" : "text-foreground"}>
              {item.name}
            </span>
            {item.status === "enriched" && item.duplicate_flag && (
              <span className="text-amber-600 flex items-center gap-0.5">
                <AlertTriangle className="w-2.5 h-2.5" /> dup
              </span>
            )}
            {item.status === "error" && <span className="text-muted-foreground">— {item.reason}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}