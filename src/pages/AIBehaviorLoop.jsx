/**
 * AIBehaviorLoop — Admin panel for the Concierge Feedback Loop Engine.
 * Shows every audit log with filters for FAIL, recurring, systemic, and regression issues.
 * Allows admins to mark issues as resolved.
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/client";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, RefreshCw, Filter, TrendingUp, Zap, RotateCcw } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseJson(str, fallback = []) {
  try { return JSON.parse(str); } catch { return fallback; }
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status, isSystemic, regression }) {
  if (regression) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">REGRESSION</span>;
  if (isSystemic) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200">SYSTEMIC</span>;
  if (status === "FAIL") return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/10 text-destructive border border-destructive/20">FAIL</span>;
  if (status === "PASS") return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">PASS</span>;
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border">PENDING</span>;
}

// ── Log Row ───────────────────────────────────────────────────────────────────
function LogRow({ log, onResolve }) {
  const [expanded, setExpanded] = useState(false);
  const issues = parseJson(log.issues, []);
  const fixes  = parseJson(log.fix_instructions, []);
  const isFail = log.audit_status === "FAIL";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border rounded-xl overflow-hidden ${
        log.is_systemic ? "border-orange-200 bg-orange-50/30" :
        log.regression   ? "border-purple-200 bg-purple-50/30" :
        isFail           ? "border-destructive/20 bg-destructive/5" :
        "border-border bg-card"
      }`}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-black/5 transition-colors"
      >
        <div className="flex-1 min-w-0 space-y-1">
          {/* User input */}
          <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
            "{log.user_input}"
          </p>
          {/* System response preview */}
          <p className="text-[11px] text-muted-foreground line-clamp-1">
            ↳ {log.system_response || "—"}
          </p>
          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap pt-0.5">
            <StatusBadge status={log.audit_status} isSystemic={log.is_systemic} regression={log.regression} />
            {log.corrected && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                ✓ Auto-corrected
              </span>
            )}
            {log.resolved && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 border border-blue-200">
                ✓ Resolved
              </span>
            )}
            {log.recurrence_count > 0 && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {log.recurrence_count} recurrence{log.recurrence_count !== 1 ? "s" : ""}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto">
              {timeAgo(log.created_date)} · turn {log.turn_index ?? "—"}
            </span>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border/40"
          >
            <div className="px-4 py-3 space-y-3">

              {/* Parsed state */}
              {log.parsed_state && (
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-1">Parsed State</p>
                  <pre className="text-[10px] bg-muted/40 rounded-lg p-2.5 overflow-x-auto text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {(() => {
                      try {
                        const obj = typeof log.parsed_state === "string" ? JSON.parse(log.parsed_state) : log.parsed_state;
                        // Show only meaningful fields
                        const slim = {};
                        const keys = ["origin", "destination", "via_stops", "trip_type", "duration", "mode", "intent", "route_character", "overnight_hint"];
                        keys.forEach(k => { if (obj[k] !== null && obj[k] !== undefined) slim[k] = obj[k]; });
                        return JSON.stringify(slim, null, 2);
                      } catch { return log.parsed_state; }
                    })()}
                  </pre>
                </div>
              )}

              {/* Issues */}
              {issues.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-destructive/70 uppercase tracking-widest mb-1.5">Issues Detected</p>
                  <div className="space-y-1.5">
                    {issues.map((issue, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-destructive bg-destructive/5 rounded-lg px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span>{issue}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fix instructions */}
              {fixes.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-amber-600/70 uppercase tracking-widest mb-1.5">Fix Instructions</p>
                  <div className="space-y-1.5">
                    {fixes.map((fix, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
                        <Zap className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
                        <span>{fix}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Corrected response */}
              {log.corrected_response && (
                <div>
                  <p className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-widest mb-1">Corrective Message Sent</p>
                  <p className="text-xs text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-200 italic">
                    "{log.corrected_response}"
                  </p>
                </div>
              )}

              {/* Actions */}
              {isFail && !log.resolved && (
                <button
                  onClick={() => onResolve(log.id)}
                  className="flex items-center gap-1.5 text-xs text-blue-700 font-semibold hover:text-blue-900 transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark as Resolved
                </button>
              )}
              {log.resolved && (
                <p className="text-xs text-blue-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Marked resolved
                </p>
              )}

              {/* Session info */}
              <p className="text-[10px] text-muted-foreground/50">
                Session: {log.session_id || "—"} · Log ID: {log.id?.slice(0, 12)}…
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Summary Stats ─────────────────────────────────────────────────────────────
function SummaryStats({ logs }) {
  const total    = logs.length;
  const fails    = logs.filter(l => l.audit_status === "FAIL").length;
  const systemic = logs.filter(l => l.is_systemic).length;
  const regressions = logs.filter(l => l.regression).length;
  const corrected   = logs.filter(l => l.corrected).length;
  const passRate = total > 0 ? Math.round(((total - fails) / total) * 100) : 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {[
        { label: "Total Audits", value: total, color: "text-foreground" },
        { label: "Pass Rate", value: `${passRate}%`, color: passRate >= 80 ? "text-emerald-600" : "text-destructive" },
        { label: "FAILs", value: fails, color: fails > 0 ? "text-destructive" : "text-emerald-600" },
        { label: "Systemic", value: systemic, color: systemic > 0 ? "text-orange-600" : "text-muted-foreground" },
        { label: "Auto-corrected", value: corrected, color: "text-emerald-600" },
      ].map(stat => (
        <div key={stat.label} className="bg-card border border-border rounded-xl p-3 text-center">
          <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
const FILTERS = [
  { key: "all",         label: "All" },
  { key: "fail",        label: "FAIL only" },
  { key: "systemic",    label: "Systemic" },
  { key: "regression",  label: "Regressions" },
  { key: "uncorrected", label: "Uncorrected FAILs" },
  { key: "pass",        label: "PASS only" },
];

export default function AIBehaviorLoop() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const loadLogs = async () => {
    setRefreshing(true);
    try {
      const data = await base44.entities.ConciergeAuditLog.list("-created_date", 200);
      setLogs(data || []);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { loadLogs(); }, []);

  const handleResolve = async (id) => {
    try {
      await base44.entities.ConciergeAuditLog.update(id, { resolved: true });
      setLogs(prev => prev.map(l => l.id === id ? { ...l, resolved: true } : l));
    } catch {}
  };

  const filteredLogs = logs.filter(log => {
    if (filter === "fail")        return log.audit_status === "FAIL";
    if (filter === "systemic")    return log.is_systemic;
    if (filter === "regression")  return log.regression;
    if (filter === "uncorrected") return log.audit_status === "FAIL" && !log.corrected;
    if (filter === "pass")        return log.audit_status === "PASS";
    return true;
  });

  // Top recurring issues (aggregated)
  const issueFreq = {};
  logs.filter(l => l.audit_status === "FAIL").forEach(l => {
    parseJson(l.issues, []).forEach(issue => {
      const key = issue.slice(0, 60);
      issueFreq[key] = (issueFreq[key] || 0) + 1;
    });
  });
  const topIssues = Object.entries(issueFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-primary" />
            AI Behavior Loop
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Continuous feedback audit for the Concierge engine</p>
        </div>
        <button
          onClick={loadLogs}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <SummaryStats logs={logs} />

          {/* Top recurring issues */}
          {topIssues.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-orange-700 uppercase tracking-widest flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Top Recurring Issues
              </p>
              {topIssues.map(([issue, count]) => (
                <div key={issue} className="flex items-center justify-between text-xs">
                  <span className="text-orange-900 flex-1 mr-3">{issue}</span>
                  <span className={`font-bold px-2 py-0.5 rounded-full ${count > 3 ? "bg-orange-200 text-orange-800" : "bg-muted text-muted-foreground"}`}>
                    ×{count}{count > 3 ? " SYSTEMIC" : ""}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  filter === f.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 text-muted-foreground border-border/60 hover:border-primary/40"
                }`}
              >
                {f.label}
                {f.key !== "all" && (
                  <span className="ml-1 opacity-60">
                    ({f.key === "fail"        ? logs.filter(l => l.audit_status === "FAIL").length
                      : f.key === "systemic"  ? logs.filter(l => l.is_systemic).length
                      : f.key === "regression"? logs.filter(l => l.regression).length
                      : f.key === "uncorrected"? logs.filter(l => l.audit_status === "FAIL" && !l.corrected).length
                      : f.key === "pass"      ? logs.filter(l => l.audit_status === "PASS").length
                      : 0})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Log list */}
          <div className="space-y-3">
            {filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No logs match this filter.
              </div>
            ) : (
              filteredLogs.map(log => (
                <LogRow key={log.id} log={log} onResolve={handleResolve} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}