import React, { useState, useMemo } from "react";
import { base44 } from "@/api/client";
import { toast } from "sonner";
import BulkGenForm from "./bulkgen/BulkGenForm";
import BulkGenFilters from "./bulkgen/BulkGenFilters";
import BulkGenSummary from "./bulkgen/BulkGenSummary";
import CandidateTable from "./bulkgen/CandidateTable";
import { Button } from "@/components/ui/button";
import { Wand2, ArrowLeft, Sparkles, CheckCircle2, Brain, AlertCircle } from "lucide-react";

const DEFAULT_FORM = { country: "", city: "", category: "any", maxResults: 20 };
const DEFAULT_FILTERS = { hideDuplicates: true, sortBy: "default" };

function makeBatchId() {
  const d = new Date();
  return `BATCH-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}-${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}`;
}

// Phases: "fetch" → "review" → "submitted"
export default function AdminBulkGenerator({ onBack }) {
  const [phase, setPhase] = useState("fetch");

  // Fetch state
  const [form, setForm]         = useState(DEFAULT_FORM);
  const [filters, setFilters]   = useState(DEFAULT_FILTERS);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError]     = useState(null);
  const [candidates, setCandidates]     = useState([]);
  const [probableDuplicates, setProbableDuplicates] = useState([]);
  const [meta, setMeta]                 = useState(null);
  const [selected, setSelected]         = useState(new Set());

  // AI review state
  const [aiReviewing, setAiReviewing]   = useState(false);
  const [aiDone, setAiDone]             = useState(false);
  const [aiResults, setAiResults]       = useState({}); // keyed by place_id

  // Submit state
  const [submitting, setSubmitting]     = useState(false);
  const [submittedBatchId, setSubmittedBatchId] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);

  // ── Phase: Fetch ──────────────────────────────────────────────────────────
  const handleFetch = async () => {
    setFetchLoading(true);
    setFetchError(null);
    setCandidates([]);
    setMeta(null);
    setSelected(new Set());

    const res = await base44.functions.invoke("fetchPlaceCandidates", {
      country: form.country.trim(),
      city: form.city.trim(),
      category: form.category,
      maxResults: form.maxResults,
    });

    setFetchLoading(false);

    if (res.data?.error) {
      setFetchError(res.data.error + (res.data.details ? ` — ${res.data.details}` : ""));
      return;
    }

    setCandidates(res.data.candidates || []);
    setProbableDuplicates(res.data.probable_duplicates || []);
    setAiDone(false);
    setAiResults({});
    setMeta({
      total_fetched: res.data.total_fetched,
      total_after_filter: res.data.total_after_filter,
      duplicates_found: res.data.duplicates_found,
      probable_duplicates_found: res.data.probable_duplicates_found || 0,
      new_places: res.data.new_places || 0,
      gray_zone_count: res.data.gray_zone_count || 0,
      query_used: res.data.query_used,
    });
    setPhase("review");
  };

  const visibleCandidates = useMemo(() => {
    // Hard duplicates are always excluded from the main list
    let list = [...candidates]; // already clean (no hard dups from backend)
    if (filters.sortBy === "rating")  list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    if (filters.sortBy === "reviews") list.sort((a, b) => (b.review_count || 0) - (a.review_count || 0));
    if (filters.sortBy === "name")    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [candidates, filters]);

  const handleToggle = (placeId) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(placeId) ? next.delete(placeId) : next.add(placeId);
      return next;
    });
  };

  const handleToggleAll = () => {
    const allSel = visibleCandidates.every(c => selected.has(c.place_id));
    setSelected(prev => {
      const next = new Set(prev);
      visibleCandidates.forEach(c => allSel ? next.delete(c.place_id) : next.add(c.place_id));
      return next;
    });
  };

  // ── Phase: AI Gray-Zone Review (optional) ────────────────────────────────
  const handleAiReview = async () => {
    const grayZone = candidates.filter(c => c.needs_ai_review);
    if (!grayZone.length) {
      toast.info("No gray-zone candidates to review.");
      return;
    }
    setAiReviewing(true);
    try {
      const res = await base44.functions.invoke("classifyGrayZone", { candidates: grayZone });
      if (res.data?.error) throw new Error(res.data.error);
      const results = res.data?.results || [];
      const map = {};
      for (const r of results) {
        if (r.place_id) map[r.place_id] = r;
      }
      setAiResults(map);
      setAiDone(true);
      toast.success(`AI reviewed ${results.length} borderline places`);
    } catch (e) {
      toast.error("AI review failed: " + e.message);
    }
    setAiReviewing(false);
  };

  // ── Phase: Save immediately (coverage mode) ───────────────────────────────
  const handleSubmitBackground = async () => {
    const toSend = candidates.filter(c => selected.has(c.place_id));
    if (!toSend.length) return;

    setSubmitting(true);
    const batchId = makeBatchId();

    // Create log entries first (so processGenerationBatch can update them)
    const logEntries = [];
    for (const c of toSend) {
      try {
        const log = await base44.entities.GeneratedLocationLog.create({
          log_id: `GEN-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          request_text: c.name,
          location_name: c.name,
          city: c.city || form.city || null,
          country: c.country || form.country || null,
          google_place_id: c.place_id || null,
          generation_status: "processing",
          generation_source: "google_places",
          batch_id: batchId,
          batch_size: toSend.length,
          review_status: "pending",
        });
        logEntries.push({
          logId: log.id,
          item: {
            place_id: c.place_id,
            payload: {
              name: c.name,
              city: c.city || form.city,
              country: c.country || form.country,
              category: c.category_guess || c.category || "landmark",
              latitude: c.latitude,
              longitude: c.longitude,
              rating: c.rating,
              review_count: c.review_count,
              formatted_address: c.formatted_address,
              types: c.types,
              // New classification fields
              record_layer: c.record_layer || null,
              visit_worthiness: c.visit_worthiness || null,
              enrichment_tier: c.enrichment_tier || null,
              normalized_name: c.normalized_name || null,
              source_types_raw: c.source_types_raw || null,
            },
          },
        });
      } catch {}
    }

    // Call processGenerationBatch synchronously — saves records immediately
    try {
      const res = await base44.functions.invoke("processGenerationBatch", {
        logEntries,
        batch_id: batchId,
        city: form.city,
        country: form.country,
      });
      const results = res.data?.results || [];
      const saved   = results.filter(r => r.status === "ok").length;
      const review  = results.filter(r => r.status === "soft_duplicate").length;
      const blocked = results.filter(r => r.status === "hard_duplicate").length;
      const failed  = results.filter(r => r.status === "error").length;
      setSubmitResult({ saved, review, blocked, failed });
    } catch (e) {
      toast.error("Save failed: " + e.message);
    }

    setSubmitting(false);
    setSubmittedBatchId(batchId);
    setPhase("submitted");
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setPhase("fetch");
    setCandidates([]); setProbableDuplicates([]); setMeta(null); setSelected(new Set());
    setFetchError(null); setSubmittedBatchId(null); setSubmitResult(null);
    setAiDone(false); setAiResults({});
  };

  const phaseLabel = {
    fetch:     "Step 1 — Discover Candidates",
    review:    "Step 2 — Select Candidates",
    submitted: "Coverage saved",
  }[phase] || "";

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-16">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (phase === "fetch" || phase === "submitted") { onBack?.(); return; }
            if (phase === "review") setPhase("fetch");
          }}
          className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Wand2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-bold">Bulk Location Generator</h2>
          <p className="text-xs text-muted-foreground">{phaseLabel}</p>
        </div>
        {phase === "review" && (
          <button onClick={handleReset} className="ml-auto text-xs text-muted-foreground hover:text-foreground underline">
            Start over
          </button>
        )}
      </div>

      {/* ── FETCH ── */}
      {phase === "fetch" && (
        <>
          <BulkGenForm form={form} onChange={u => setForm(p => ({ ...p, ...u }))} onFetch={handleFetch} loading={fetchLoading} />
          {fetchError && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {fetchError}
            </div>
          )}
        </>
      )}

      {/* ── REVIEW ── */}
      {phase === "review" && meta && (
        <>
          <BulkGenSummary meta={meta} />
          {meta.query_used && (
            <p className="text-[10px] text-muted-foreground px-1">
              Query: <span className="font-mono bg-muted px-1 rounded">{meta.query_used}</span>
            </p>
          )}
          {candidates.length > 0 ? (
            <>
              {/* AI Gray-Zone Review banner */}
              {meta?.gray_zone_count > 0 && (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${aiDone ? "bg-violet-50 border-violet-200" : "bg-muted/40 border-border"}`}>
                  <Brain className={`w-4 h-4 flex-shrink-0 ${aiDone ? "text-violet-600" : "text-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    {aiDone ? (
                      <p className="text-xs font-semibold text-violet-800">
                        AI reviewed {Object.keys(aiResults).length} borderline place{Object.keys(aiResults).length !== 1 ? "s" : ""}
                      </p>
                    ) : (
                      <p className="text-xs font-semibold text-foreground">
                        {meta.gray_zone_count} borderline place{meta.gray_zone_count !== 1 ? "s" : ""} flagged for AI review
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {aiDone ? "Classification badges shown on gray-zone rows below" : "Optional — run GPT to adjudicate ambiguous candidates"}
                    </p>
                  </div>
                  {!aiDone && (
                    <button
                      onClick={handleAiReview}
                      disabled={aiReviewing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors flex-shrink-0"
                    >
                      {aiReviewing
                        ? <><span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" /> Reviewing…</>
                        : <><Brain className="w-3 h-3" /> Run AI Review</>
                      }
                    </button>
                  )}
                </div>
              )}

              <BulkGenFilters
                filters={filters}
                onChange={u => setFilters(p => ({ ...p, ...u }))}
                totalCount={candidates.length}
                visibleCount={visibleCandidates.length}
                selectedCount={selected.size}
              />
              <CandidateTable
                candidates={visibleCandidates}
                probableDuplicates={probableDuplicates}
                selected={selected}
                onToggle={handleToggle}
                onToggleAll={handleToggleAll}
                aiResults={aiResults}
              />
            </>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No candidates passed filters. Try a different city or category.
            </div>
          )}

          {selected.size > 0 && (
            <div className="sticky bottom-4 z-10">
              <div className="bg-primary text-primary-foreground rounded-2xl px-5 py-3 flex items-center justify-between shadow-lg">
                <div>
                  <p className="text-sm font-semibold">{selected.size} location{selected.size !== 1 ? "s" : ""} selected</p>
                  <p className="text-[10px] text-primary-foreground/70">Saved immediately as raw records · no enrichment</p>
                </div>
                <Button
                  onClick={handleSubmitBackground}
                  disabled={submitting}
                  className="bg-white text-primary hover:bg-white/90 rounded-xl text-sm font-semibold"
                >
                  {submitting
                    ? <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> Saving…</span>
                    : <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Save Coverage Records</>
                  }
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── SUBMITTED ── */}
      {phase === "submitted" && (
        <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-base font-bold">Coverage saved immediately</p>
            <p className="text-sm text-muted-foreground mt-1">
              Records were saved directly — no background queue. No enrichment was applied.
            </p>
            {submitResult && (
              <div className="flex justify-center gap-4 mt-3 text-xs flex-wrap">
                {submitResult.saved   > 0 && <span className="text-green-700 font-semibold">{submitResult.saved} saved</span>}
                {submitResult.review  > 0 && <span className="text-amber-700 font-semibold">{submitResult.review} needs review</span>}
                {submitResult.blocked > 0 && <span className="text-slate-500">{submitResult.blocked} duplicate blocked</span>}
                {submitResult.failed  > 0 && <span className="text-red-600 font-semibold">{submitResult.failed} failed</span>}
              </div>
            )}
            {submittedBatchId && (
              <p className="text-xs text-muted-foreground mt-2 font-mono bg-muted inline-block px-2 py-1 rounded">
                Batch: {submittedBatchId}
              </p>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            View results in <strong>Generated Locations → Coverage</strong> tab. Use <strong>Enrichment</strong> tab to add stories manually.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <Button variant="outline" onClick={handleReset}>
              Add More
            </Button>
            <Button onClick={onBack}>
              ← Back to Locations
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}