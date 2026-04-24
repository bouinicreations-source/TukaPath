/**
 * EnrichmentTab
 *
 * Allows admins to manually select raw/needs_review locations and run
 * enrichment on them explicitly. No auto-enrichment.
 *
 * Enrichment actions: generate story content (via saveEnrichedLocations).
 */

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sparkles, ImageOff, Loader2, RefreshCw, Info } from "lucide-react";
import { toast } from "sonner";

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

function BoolDot({ value }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${value ? "bg-green-500" : "bg-slate-200"}`} />;
}

const STATE_BADGE = {
  raw:          "bg-slate-100 text-slate-600",
  needs_review: "bg-amber-50 text-amber-700",
  curated:      "bg-blue-50 text-blue-700",
  enriched:     "bg-green-50 text-green-700",
};

function LocationEnrichRow({ loc, selected, onToggle }) {
  const state = loc.record_state || "raw";

  return (
    <div
      onClick={() => onToggle(loc.id)}
      className={`flex items-center gap-3 p-3 border-b border-border/40 last:border-0 cursor-pointer transition-colors ${selected ? "bg-primary/5" : "hover:bg-muted/20"}`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(loc.id)}
        onClick={e => e.stopPropagation()}
        className="w-4 h-4 rounded accent-primary flex-shrink-0"
      />
      {loc.image_url ? (
        <img src={loc.image_url} alt="" className="w-10 h-9 rounded-lg object-cover flex-shrink-0" />
      ) : (
        <div className="w-10 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
          <ImageOff className="w-3 h-3 text-muted-foreground/40" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{loc.name}</p>
          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATE_BADGE[state] || "bg-muted text-muted-foreground"}`}>
            {state}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {loc.city}{loc.country ? `, ${loc.country}` : ""} · {formatDate(loc.created_date)}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><BoolDot value={!!loc.image_url} /> Image</span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><BoolDot value={!!loc.quick_story} /> Story</span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><BoolDot value={!!loc.quick_audio_url} /> Audio</span>
        </div>
      </div>
    </div>
  );
}

export default function EnrichmentTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("raw");
  const [selected, setSelected] = useState(new Set());
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchResult, setBatchResult] = useState(null);

  const { data: locations = [], isLoading, refetch } = useQuery({
    queryKey: ["enrichment-candidates"],
    queryFn: () => base44.entities.Location.filter({ source: "official" }, "-created_date", 500),
    staleTime: 10000,
    refetchInterval: batchRunning ? 5000 : 15000,
  });

  // Only show locations that haven't been fully enriched
  const eligible = locations.filter(loc => {
    const state = loc.record_state || "raw";
    if (stateFilter !== "all" && state !== stateFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!loc.name?.toLowerCase().includes(q) && !loc.city?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const allSelected = eligible.length > 0 && eligible.every(l => selected.has(l.id));

  const handleToggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleToggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) { eligible.forEach(l => next.delete(l.id)); }
      else             { eligible.forEach(l => next.add(l.id)); }
      return next;
    });
  };

  const handleRunEnrichment = async () => {
    const toEnrich = eligible.filter(l => selected.has(l.id));
    if (!toEnrich.length) return;
    if (!confirm(`Enrich ${toEnrich.length} location${toEnrich.length !== 1 ? "s" : ""}?\n\nThis will generate stories and images. Please keep this page open until complete.`)) return;

    setBatchRunning(true);
    setBatchResult(null);

    const locationIds = toEnrich.map(l => l.id);

    try {
      const res = await base44.functions.invoke("runEnrichmentBatch", { locationIds });
      const { succeeded = 0, failed = 0 } = res.data || {};
      setSelected(new Set());
      setBatchResult({ succeeded, failed, count: locationIds.length });
      toast.success(`Enrichment complete: ${succeeded} enriched, ${failed} failed.`);
    } catch (e) {
      toast.error("Enrichment failed: " + e.message);
    }

    setBatchRunning(false);
    qc.invalidateQueries({ queryKey: ["enrichment-candidates"] });
    refetch();
  };

  const stateOptions = [
    { key: "raw",          label: "Raw" },
    { key: "needs_review", label: "Needs Review" },
    { key: "curated",      label: "Curated" },
    { key: "all",          label: "All" },
  ];

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800">
        <strong>Manual enrichment only.</strong> Select locations below and click "Run Enrichment" to generate story content. 
        Enrichment is never run automatically from coverage ingestion.
      </div>

      {batchResult && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-xs font-semibold bg-green-50 border border-green-200 text-green-800">
          <Info className="w-4 h-4 flex-shrink-0" />
          Enrichment complete: {batchResult.succeeded} enriched, {batchResult.failed} failed (of {batchResult.count} selected).
          <button onClick={() => setBatchResult(null)} className="ml-auto text-[11px] underline opacity-60">dismiss</button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search locations…" className="pl-9 h-8 text-sm" />
        </div>
        {stateOptions.map(({ key, label }) => (
          <button key={key} onClick={() => setStateFilter(key)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${stateFilter === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
        <Button size="sm" variant="outline" onClick={() => refetch()} className="h-8 gap-1.5 text-xs">
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Select all header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-muted/30">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={handleToggleAll}
            disabled={eligible.length === 0}
            className="w-4 h-4 rounded accent-primary"
          />
          <span className="text-xs text-muted-foreground font-medium">
            {eligible.length} eligible · {selected.size} selected
          </span>
          {selected.size > 0 && !batchRunning && (
            <Button
              size="sm"
              onClick={handleRunEnrichment}
              className="ml-auto gap-1.5 text-xs h-7"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Run Enrichment ({selected.size})
            </Button>
          )}
          {batchRunning && (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-blue-700">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Running…
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : eligible.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No eligible locations found.</div>
        ) : (
          eligible.map(loc => (
            <LocationEnrichRow
              key={loc.id}
              loc={loc}
              selected={selected.has(loc.id)}
              onToggle={handleToggle}
            />
          ))
        )}
      </div>
    </div>
  );
}