import React, { useState, useEffect } from "react";
import { base44 } from "@/api/client";
import { AlertCircle, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Score badge ───────────────────────────────────────────────────────────────
function ScoreBadge({ score }) {
  const color =
    score >= 90 ? "bg-emerald-100 text-emerald-700" :
    score >= 75 ? "bg-blue-100 text-blue-700" :
    score >= 60 ? "bg-amber-100 text-amber-700" :
                  "bg-red-100 text-red-700";
  const label =
    score >= 90 ? "Excellent" :
    score >= 75 ? "Good" :
    score >= 60 ? "Acceptable" :
    score >= 40 ? "Weak" :
                  "Broken";
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${color}`}>
      {score} · {label}
    </span>
  );
}

// ── Sub-score bar ─────────────────────────────────────────────────────────────
function SubScore({ label, score }) {
  const color = score >= 80 ? "bg-emerald-400" : score >= 60 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-24 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[10px] font-mono w-6 text-right">{score}</span>
    </div>
  );
}

// ── Individual row ────────────────────────────────────────────────────────────
function EvalRow({ log, index }) {
  const [expanded, setExpanded] = useState(false);
  const eval_ = log._evaluation;
  if (!eval_) return null;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-[11px] font-mono text-muted-foreground w-6">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">
            {log.origin_text || `${log.origin_lat?.toFixed(2)},${log.origin_lng?.toFixed(2)}`}
            {log.destination_text ? ` → ${log.destination_text}` : ''}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {log.mode} · {log.generated_stops_count} stop{log.generated_stops_count !== 1 ? 's' : ''} · {new Date(log.created_date).toLocaleDateString()}
          </p>
        </div>
        <ScoreBadge score={eval_.overall_score} />
        {eval_.issues?.length > 0 && (
          <span className="text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded font-medium">
            {eval_.issues.length} issue{eval_.issues.length !== 1 ? 's' : ''}
          </span>
        )}
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-4 bg-muted/10">
          {/* Sub-scores */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Breakdown</p>
            <SubScore label="Correctness" score={eval_.correctness_score} />
            <SubScore label="Geography" score={eval_.geography_score} />
            <SubScore label="Stop Quality" score={eval_.stop_quality_score} />
            <SubScore label="Flow" score={eval_.flow_score} />
            <SubScore label="Experience" score={eval_.experience_score} />
          </div>

          {/* Issues */}
          {eval_.issues?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-600 mb-1.5">Issues</p>
              <div className="space-y-1">
                {eval_.issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px] text-red-700">
                    <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    {issue}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {eval_.warnings?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-1.5">Warnings</p>
              <div className="space-y-1">
                {eval_.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px] text-amber-700">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    {w}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strengths */}
          {eval_.strengths?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1.5">Strengths</p>
              <div className="space-y-1">
                {eval_.strengths.map((s, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px] text-emerald-700">
                    <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    {s}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested fixes */}
          {eval_.suggested_fixes?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Suggested Fixes</p>
              <div className="space-y-1">
                {eval_.suggested_fixes.map((f, i) => (
                  <div key={i} className="text-[11px] text-foreground/70 pl-2 border-l-2 border-primary/30">{f}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminJourneyQuality() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("worst"); // "worst" | "best" | "recent"
  const [evaluating, setEvaluating] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const records = await base44.entities.JourneyRequestLog.list('-created_date', 50);
      setLogs(records);
    } catch {}
    setLoading(false);
  };

  // Run evaluations on logs that don't have one yet
  const runEvaluations = async () => {
    const unevaluated = logs.filter(l => !l._evaluation && l.parsed_preferences);
    if (unevaluated.length === 0) return;
    setEvaluating(true);
    setProgress(0);
    let done = 0;
    for (const log of unevaluated) {
      try {
        // We reconstruct a minimal journey result from the log's debug data
        const debugLayers = JSON.parse(log.parsed_preferences || '{}');
        const mockJourney = {
          main_stops: (debugLayers.final_main || []).map(n => ({ location: { name: n }, stop_role: 'main_highlight', _progress: 0.5, _score: 75 })),
          quick_stops: (debugLayers.final_quick || []).map(n => ({ location: { name: n }, stop_role: 'quick_stop', _progress: 0.6, _score: 60 })),
          result_status: log.result_status,
          journey_title: debugLayers.journey_title || '',
          summary: '',
          route_metadata: { distance_km: 0, duration_minutes: log.time_minutes || 60 },
          route_character: debugLayers.route_character || {},
        };
        const res = await base44.functions.invoke('evaluateJourney', {
          journey_result: mockJourney,
          input: { startLat: log.origin_lat, startLng: log.origin_lng, destLat: log.destination_lat, destLng: log.destination_lng },
        });
        if (res?.data?.evaluation) {
          log._evaluation = res.data.evaluation;
        }
      } catch {}
      done++;
      setProgress(Math.round((done / unevaluated.length) * 100));
    }
    setLogs([...logs]);
    setEvaluating(false);
  };

  const evaluatedLogs = logs.filter(l => l._evaluation);

  const sorted = [...evaluatedLogs].sort((a, b) => {
    if (sortBy === "worst") return a._evaluation.overall_score - b._evaluation.overall_score;
    if (sortBy === "best")  return b._evaluation.overall_score - a._evaluation.overall_score;
    return 0; // recent = already sorted by created_date from DB
  });

  const avgScore = evaluatedLogs.length > 0
    ? Math.round(evaluatedLogs.reduce((s, l) => s + l._evaluation.overall_score, 0) / evaluatedLogs.length)
    : null;

  const badCount  = evaluatedLogs.filter(l => l._evaluation.overall_score < 60).length;
  const goodCount = evaluatedLogs.filter(l => l._evaluation.overall_score >= 75).length;

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Avg Score", value: avgScore !== null ? avgScore : '—', color: avgScore >= 75 ? "text-emerald-600" : avgScore >= 60 ? "text-amber-600" : "text-red-600" },
          { label: "Bad (<60)", value: badCount, color: "text-red-600" },
          { label: "Good (≥75)", value: goodCount, color: "text-emerald-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-3 text-center">
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={loadLogs} className="gap-1.5 text-xs">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
        <Button
          size="sm"
          onClick={runEvaluations}
          disabled={evaluating}
          className="gap-1.5 text-xs"
        >
          {evaluating ? `Evaluating… ${progress}%` : `Evaluate ${logs.filter(l => !l._evaluation && l.parsed_preferences).length} logs`}
        </Button>
        <div className="ml-auto flex gap-1">
          {["worst", "best", "recent"].map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${sortBy === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
              {s === "worst" ? "Worst first" : s === "best" ? "Best first" : "Recent"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          {evaluatedLogs.length === 0
            ? "Click \"Evaluate\" to score recent journey logs."
            : "No evaluated journeys yet."}
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((log, i) => (
            <EvalRow key={log.id} log={log} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}