import { useState } from "react";
import BenchmarkChecklist from "./BenchmarkChecklist";
import BenchmarkDebugPanels from "./BenchmarkDebugPanels";

const STATUS_COLORS = {
  complete: "bg-emerald-100 text-emerald-800",
  partial: "bg-amber-100 text-amber-700",
  arrival_only: "bg-blue-100 text-blue-700",
  minimal: "bg-slate-100 text-slate-600",
  empty: "bg-red-100 text-red-700",
};

export default function BenchmarkCard({ benchmarkId, label, result, expanded, onToggle }) {
  if (!result) return null;

  if (result.loading) {
    return (
      <div className="border border-border rounded-xl p-4">
        <span className="text-xs text-muted-foreground animate-pulse">Running {benchmarkId}…</span>
      </div>
    );
  }
  if (result.error) {
    return (
      <div className="border border-border rounded-xl p-4">
        <p className="text-xs text-destructive">Error: {result.error}</p>
      </div>
    );
  }

  const pf = result.pass_fail || {};
  const overall = result.overall || "—";

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Header row — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">{benchmarkId}</span>
          <span className="text-sm font-bold">{result.benchmark_name || label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${overall === "PASS" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
            {overall}
          </span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[result.result_status] || "bg-slate-100"}`}>
            {result.result_status}
          </span>
          <span className="text-xs text-muted-foreground">
            {result.main_count}m + {result.quick_count}q stops
          </span>
          <span className="text-xs text-muted-foreground">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="p-4 space-y-4">
          {/* Quick summary row */}
          <div className="flex flex-wrap gap-3 text-xs">
            <span>Blueprint: <strong>{result.journey_output?.blueprint_key || "—"}</strong></span>
            <span>L8: <strong>{result.validation_status || "—"}</strong></span>
            {result.anchor_progress != null && (
              <span>Anchor @ <strong>{result.anchor_progress.toFixed(2)}</strong></span>
            )}
            {result.debug_summary?.route?.distance_km != null && (
              <span className="font-mono">{result.debug_summary.route.distance_km}km / {result.debug_summary.route.duration_minutes}min</span>
            )}
          </div>

          {/* Pass/fail output contract */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {Object.entries(pf).map(([key, pass]) => (
              <div key={key} className={`text-center px-2 py-1.5 rounded-lg text-[11px] font-semibold ${pass ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {pass ? "✓" : "✗"} {key.replace(/_/g, " ")}
              </div>
            ))}
          </div>

          <BenchmarkChecklist checks={result.checks} />

          {/* Failures list */}
          {result.failures?.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-700">Failures</p>
              {result.failures.map((f, i) => (
                <div key={i} className="text-[11px] font-mono text-red-700">
                  [{f.check}] {f.notes.join(" | ")}
                </div>
              ))}
            </div>
          )}

          <BenchmarkDebugPanels result={result} />
        </div>
      )}
    </div>
  );
}