/**
 * AdminImageEnrichment.jsx
 * Admin panel to trigger and monitor the location image enrichment pipeline.
 */

import { useState } from "react";
import { base44 } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Image, Play, Eye, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function AdminImageEnrichment() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [batchSize, setBatchSize] = useState(20);

  const runEnrichment = async (dryRun = false) => {
    setRunning(true);
    setError(null);
    setResults(null);
    try {
      const res = await base44.functions.invoke("enrichLocationImages", {
        batch_size: batchSize,
        dry_run: dryRun,
      });
      setResults({ ...res.data, dry_run: dryRun });
    } catch (e) {
      setError(e.message || "Enrichment failed");
    }
    setRunning(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Image className="w-4 h-4 text-indigo-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold">Location Image Enrichment</h3>
          <p className="text-xs text-muted-foreground">Automatically fetch images for locations missing them</p>
        </div>
      </div>

      {/* Config */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Settings</p>
        <div className="flex items-center gap-3">
          <label className="text-xs text-muted-foreground flex-shrink-0">Batch size</label>
          <input
            type="number"
            min={1}
            max={50}
            value={batchSize}
            onChange={e => setBatchSize(Number(e.target.value))}
            className="w-20 px-3 py-1.5 rounded-lg border border-border bg-muted/40 text-sm text-center"
          />
          <span className="text-xs text-muted-foreground">locations per run (max 50)</span>
        </div>
        <div className="text-[11px] text-muted-foreground/70 space-y-0.5">
          <p>• Google Places searched first (higher confidence)</p>
          <p>• Unsplash used as fallback only</p>
          <p>• Existing curated images are never overwritten</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => runEnrichment(true)}
          disabled={running}
          className="gap-2"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
          Dry Run
        </Button>
        <Button
          size="sm"
          onClick={() => runEnrichment(false)}
          disabled={running}
          className="gap-2"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {running ? "Running…" : "Run Enrichment"}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <p className="text-sm font-semibold">
              {results.dry_run ? "Dry Run Complete" : "Enrichment Complete"}
            </p>
          </div>

          {results.dry_run ? (
            <div>
              <p className="text-xs text-muted-foreground mb-2">{results.total_candidates} locations need images:</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {(results.candidates || []).map((c, i) => (
                  <div key={i} className="text-xs text-muted-foreground flex gap-2">
                    <span className="text-muted-foreground/40">{i + 1}.</span>
                    <span className="font-medium text-foreground">{c.name}</span>
                    <span>— {c.city}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Processed", value: results.results?.processed, color: "text-foreground" },
                { label: "Google Places", value: results.results?.google_places, color: "text-emerald-600" },
                { label: "Unsplash Fallback", value: results.results?.unsplash_fallback, color: "text-blue-600" },
                { label: "No Image Found", value: results.results?.missing, color: "text-amber-600" },
                { label: "Errors", value: results.results?.errors, color: "text-destructive" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-muted/30 rounded-lg px-3 py-2">
                  <p className={`text-lg font-bold ${color}`}>{value ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}