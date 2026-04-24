import React, { useState, useEffect } from "react";
import { base44 } from "@/api/client";
import { Download, Search, SlidersHorizontal, Activity } from "lucide-react";

const CATEGORY_COLORS = {
  journey:     "bg-indigo-100 text-indigo-700",
  audio:       "bg-purple-100 text-purple-700",
  auth:        "bg-rose-100 text-rose-700",
  suggestion:  "bg-orange-100 text-orange-700",
  moderation:  "bg-teal-100 text-teal-700",
  navigation:  "bg-slate-100 text-slate-600",
  other:       "bg-muted text-muted-foreground",
};

function formatTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AdminEventLogs() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.EventLog.list("-created_date", 300);
    setEvents(data);
    setLoading(false);
  };

  const filtered = events.filter(ev => {
    if (filterCategory && ev.category !== filterCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return [ev.event_name, ev.feature, ev.user_id, ev.page_name].some(f => f?.toLowerCase().includes(q));
    }
    return true;
  });

  const exportCSV = () => {
    const rows = [["time","category","event","feature","user","page","metadata"]];
    filtered.forEach(ev => rows.push([
      formatTime(ev.created_date), ev.category, ev.event_name, ev.feature || "",
      ev.user_id || "guest", ev.page_name || "",
      (ev.metadata || "").replace(/,/g, ";")
    ]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `event-logs-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  // Category counts
  const categories = [...new Set(events.map(e => e.category))];
  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat] = events.filter(e => e.category === cat).length;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-500" /> Event Logs
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Non-failure product events. Journey flows, audio interactions, user actions.</p>
        </div>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted px-3 py-1.5 rounded-lg transition-colors">
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      </div>

      {/* Category summary */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilterCategory("")}
            className={`text-[11px] px-3 py-1.5 rounded-full border transition-all font-medium ${!filterCategory ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border text-muted-foreground hover:border-primary/30"}`}>
            All ({events.length})
          </button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilterCategory(filterCategory === cat ? "" : cat)}
              className={`text-[11px] px-3 py-1.5 rounded-full border transition-all font-medium ${filterCategory === cat ? "bg-primary text-primary-foreground border-primary" : `${CATEGORY_COLORS[cat] || "bg-muted text-muted-foreground"} border-transparent hover:border-current/20`}`}>
              {cat} ({categoryCounts[cat]})
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search event name, feature, user…"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:border-primary/30"
        />
      </div>

      {/* Log table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {events.length === 0
            ? "No events logged yet. Use base44.entities.EventLog.create() in your product code to start logging."
            : "No events match your filters."}
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">{filtered.length} events</p>
          {filtered.map(ev => {
            let metadata = null;
            if (ev.metadata) { try { metadata = JSON.parse(ev.metadata); } catch {} }
            return (
              <div key={ev.id}
                className="flex items-start gap-3 px-4 py-3 bg-card border border-border/60 rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold font-mono">{ev.event_name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[ev.category] || "bg-muted text-muted-foreground"}`}>
                      {ev.category}
                    </span>
                    {ev.feature && (
                      <span className="text-[10px] text-muted-foreground">{ev.feature}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                    {ev.user_id && <span className="font-mono">{ev.user_id.slice(0, 10)}…</span>}
                    {ev.user_id && <span>·</span>}
                    {ev.user_role && <><span>{ev.user_role}</span><span>·</span></>}
                    {ev.page_name && <><span>{ev.page_name}</span><span>·</span></>}
                    <span>{formatTime(ev.created_date)}</span>
                  </div>
                  {metadata && (
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5 font-mono line-clamp-1">
                      {JSON.stringify(metadata)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}