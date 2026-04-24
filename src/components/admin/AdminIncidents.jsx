import React, { useState, useEffect } from "react";
import { supabase } from '@/api/supabase';
import { base44 } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, CheckCircle, AlertTriangle, AlertCircle, Info, Search, X, ChevronRight, SlidersHorizontal } from "lucide-react";

const SEVERITY_META = {
  Critical: { color: "bg-red-100 text-red-800 border-red-200", dot: "bg-red-500", icon: AlertCircle },
  High:     { color: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500", icon: AlertTriangle },
  Medium:   { color: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-400", icon: AlertTriangle },
  Low:      { color: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400", icon: Info },
};

const STATUS_META = {
  unresolved:  { color: "bg-red-50 text-red-700", label: "Unresolved" },
  resolved:    { color: "bg-emerald-50 text-emerald-700", label: "Resolved" },
  known_issue: { color: "bg-amber-50 text-amber-700", label: "Known Issue" },
  wont_fix:    { color: "bg-slate-50 text-slate-500", label: "Won't Fix" },
};

const CATEGORY_LABELS = {
  journey_failure:   "Journey",
  audio_failure:     "Audio",
  auth_failure:      "Auth",
  api_failure:       "API",
  database_failure:  "Database",
  frontend_exception: "Frontend",
  user_flow_failure:  "User Flow",
  system_error:       "System",
  other:              "Other",
};

function formatTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function SeverityBadge({ severity }) {
  const meta = SEVERITY_META[severity] || SEVERITY_META.Low;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${meta.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {severity}
    </span>
  );
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.unresolved;
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${meta.color}`}>
      {meta.label}
    </span>
  );
}

function DetailField({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
      <p className="text-xs text-foreground bg-muted/40 rounded-lg px-3 py-2 font-mono break-all whitespace-pre-wrap">{String(value)}</p>
    </div>
  );
}

function IncidentDetail({ incident, onBack, onUpdate }) {
  const [notes, setNotes] = useState(incident.internal_notes || "");
  const [status, setStatus] = useState(incident.resolved_status || "unresolved");
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => { supabase.auth.getUser().then(r => r.data.user).then(setUser).catch(() => {}); }, []);

  const save = async () => {
    setSaving(true);
    await base44.entities.IncidentLog.update(incident.id, {
      resolved_status: status,
      internal_notes: notes,
      resolved_by: status === "resolved" ? (user?.email || "admin") : incident.resolved_by,
    });
    setSaving(false);
    onUpdate();
    onBack();
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(incident, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `incident-${incident.incident_id || incident.id}.json`; a.click();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack}
          className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold">{incident.event_name}</span>
            <SeverityBadge severity={incident.severity} />
            <StatusBadge status={incident.resolved_status} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {incident.incident_id && <span className="mr-2 font-mono">{incident.incident_id}</span>}
            {formatTime(incident.created_date)}
          </p>
        </div>
        <button onClick={exportJSON}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted px-3 py-1.5 rounded-lg transition-colors flex-shrink-0">
          <Download className="w-3.5 h-3.5" /> JSON
        </button>
      </div>

      {/* Context */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-card rounded-xl border border-border space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Event</p>
          <p className="text-xs font-semibold">{incident.feature || "—"}</p>
          <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[incident.category] || incident.category}</p>
        </div>
        <div className="p-3 bg-card rounded-xl border border-border space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Session</p>
          <p className="text-xs font-mono truncate">{incident.user_id || "guest"}</p>
          <p className="text-xs text-muted-foreground">{incident.user_role}</p>
        </div>
        <div className="p-3 bg-card rounded-xl border border-border space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Page</p>
          <p className="text-xs font-semibold truncate">{incident.page_name || "—"}</p>
          <p className="text-xs text-muted-foreground truncate">{incident.route_url || "—"}</p>
        </div>
        <div className="p-3 bg-card rounded-xl border border-border space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Device</p>
          <p className="text-xs font-semibold">{incident.device_type || "—"}</p>
          <p className="text-xs text-muted-foreground">{[incident.os, incident.browser].filter(Boolean).join(" · ")}</p>
        </div>
      </div>

      {/* Error details */}
      <div className="space-y-3">
        <DetailField label="Error Message" value={incident.error_message} />
        <DetailField label="Stack Trace" value={incident.stack_trace} />
        <DetailField label="Request Payload" value={incident.request_payload_summary} />
        <DetailField label="Response Summary" value={incident.response_summary} />
        {incident.journey_request_id && (
          <DetailField label="Journey Request ID" value={incident.journey_request_id} />
        )}
        {incident.active_logic_version && (
          <DetailField label="Active Journey Logic Version" value={incident.active_logic_version} />
        )}
        {incident.api_provider && (
          <DetailField label="API Provider" value={incident.api_provider} />
        )}
        {incident.retry_count > 0 && (
          <DetailField label="Retry Count" value={incident.retry_count} />
        )}
      </div>

      {/* Resolution */}
      <div className="p-4 bg-card border border-border rounded-xl space-y-4">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Resolution</p>
        <div>
          <label className="text-xs text-muted-foreground block mb-2">Status</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(STATUS_META).map(([key, meta]) => (
              <button key={key} onClick={() => setStatus(key)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${status === key ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border hover:border-primary/30"}`}>
                {meta.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">Internal Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Root cause, fix applied, links to relevant code..."
            className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm resize-none focus:outline-none focus:border-primary/30"
            rows={3}
          />
        </div>
        {incident.resolved_by && <p className="text-[11px] text-muted-foreground">Resolved by: {incident.resolved_by}</p>}
        <Button className="rounded-xl" onClick={save} disabled={saving}>
          <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
          {saving ? "Saving…" : "Save Resolution"}
        </Button>
      </div>
    </div>
  );
}

export default function AdminIncidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("unresolved");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.IncidentLog.list("-created_date", 200);
    setIncidents(data);
    setLoading(false);
  };

  const filtered = incidents.filter(inc => {
    if (filterSeverity && inc.severity !== filterSeverity) return false;
    if (filterCategory && inc.category !== filterCategory) return false;
    if (filterStatus && inc.resolved_status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return [inc.event_name, inc.error_message, inc.feature, inc.user_id, inc.incident_id]
        .some(f => f?.toLowerCase().includes(q));
    }
    return true;
  });

  const exportCSV = () => {
    const rows = [["time","severity","category","feature","event","user","status","message"]];
    filtered.forEach(i => rows.push([
      formatTime(i.created_date), i.severity, i.category, i.feature, i.event_name,
      i.user_id || "guest", i.resolved_status, (i.error_message || "").replace(/,/g, ";")
    ]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `incidents-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  if (selected) {
    return <IncidentDetail incident={selected} onBack={() => setSelected(null)} onUpdate={load} />;
  }

  const criticalCount = incidents.filter(i => i.severity === "Critical" && i.resolved_status === "unresolved").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" /> Incidents
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Operational failures and user-facing errors</p>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-full font-semibold border border-red-200">
              <AlertCircle className="w-3 h-3" /> {criticalCount} critical
            </span>
          )}
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted px-3 py-1.5 rounded-lg transition-colors">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="space-y-2">
        <div className="relative flex items-center gap-2">
          <Search className="absolute left-3 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search event, error, user…"
            className="flex-1 pl-9 pr-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:border-primary/30"
          />
          <button onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-2.5 rounded-xl border transition-all ${showFilters ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border text-muted-foreground hover:border-primary/30"}`}>
            <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
          </button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-3 gap-2">
            <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}
              className="px-3 py-2 rounded-xl bg-muted/50 border border-border text-xs focus:outline-none">
              <option value="">All severity</option>
              {["Critical","High","Medium","Low"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
              className="px-3 py-2 rounded-xl bg-muted/50 border border-border text-xs focus:outline-none">
              <option value="">All categories</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-xl bg-muted/50 border border-border text-xs focus:outline-none">
              <option value="">All statuses</option>
              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Summary counts */}
      <div className="grid grid-cols-4 gap-2">
        {["Critical","High","Medium","Low"].map(sev => {
          const meta = SEVERITY_META[sev];
          const count = incidents.filter(i => i.severity === sev && i.resolved_status === "unresolved").length;
          return (
            <button key={sev} onClick={() => setFilterSeverity(filterSeverity === sev ? "" : sev)}
              className={`p-3 rounded-xl border text-center transition-all ${filterSeverity === sev ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:border-primary/20"}`}>
              <p className="text-lg font-bold">{count}</p>
              <p className={`text-[10px] font-semibold mt-0.5 ${meta.dot.replace("bg-", "text-")}`}>{sev}</p>
            </button>
          );
        })}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {incidents.length === 0 ? "No incidents logged yet. Incidents will appear here when errors are recorded." : "No incidents match your filters."}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">{filtered.length} incidents</p>
          {filtered.map(inc => {
            const sevMeta = SEVERITY_META[inc.severity] || SEVERITY_META.Low;
            return (
              <button key={inc.id} onClick={() => setSelected(inc)}
                className="w-full flex items-start gap-3 p-4 bg-card border border-border rounded-xl hover:border-primary/30 hover:bg-primary/5 transition-all text-left group">
                <div className={`w-1.5 h-full min-h-[48px] rounded-full flex-shrink-0 mt-0.5 ${sevMeta.dot}`} />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold">{inc.event_name}</span>
                    <SeverityBadge severity={inc.severity} />
                    <StatusBadge status={inc.resolved_status} />
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                    <span>{CATEGORY_LABELS[inc.category] || inc.category}</span>
                    {inc.feature && <><span>·</span><span>{inc.feature}</span></>}
                    {inc.user_id && <><span>·</span><span className="font-mono">{inc.user_id.slice(0, 12)}…</span></>}
                    <span>·</span><span>{formatTime(inc.created_date)}</span>
                  </div>
                  {inc.error_message && (
                    <p className="text-[11px] text-muted-foreground line-clamp-1 font-mono">{inc.error_message}</p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground flex-shrink-0 mt-1" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}