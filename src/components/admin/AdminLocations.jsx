/**
 * AdminLocations.jsx — TukaPath Admin
 * Clean CMS interface. No Base44. Direct Supabase + Worker calls.
 */

import React, { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, Plus, Wand2, MapPin, ChevronRight,
  Eye, EyeOff, RefreshCw, Building2, TreePine,
  Landmark, Coffee, Utensils, Star, X, Filter,
  Sparkles, Users, CheckCircle2, AlertCircle, Clock
} from "lucide-react";
import LocationEditor from "./LocationEditor";

// ── Worker call helper (no Base44) ───────────────────────────────────────────

async function callWorker(endpoint, payload) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const WORKER = import.meta.env.VITE_WORKER_URL;

  const res = await fetch(`${WORKER}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(e.error || `Worker error ${res.status}`);
  }
  return res.json();
}

// ── Completeness scoring ──────────────────────────────────────────────────────

function score(loc) {
  const fields = [
    { k: "name",          w: 10 },
    { k: "city",          w: 8  },
    { k: "country",       w: 8  },
    { k: "category",      w: 8  },
    { k: "latitude",      w: 10 },
    { k: "longitude",     w: 10 },
    { k: "quick_story",   w: 15 },
    { k: "mystery_teaser",w: 10 },
    { k: "fun_fact",      w: 8  },
    { k: "image_url",     w: 8  },
    { k: "opening_hours", w: 5  },
  ];
  let total = 0, earned = 0;
  for (const f of fields) {
    total += f.w;
    if (loc[f.k] && String(loc[f.k]).trim().length > 0) earned += f.w;
  }
  return Math.round((earned / total) * 100);
}

// ── Category config ───────────────────────────────────────────────────────────

const CAT = {
  museum:     { icon: Building2, color: "bg-purple-100 text-purple-700 border-purple-200" },
  landmark:   { icon: Landmark,  color: "bg-blue-100 text-blue-700 border-blue-200"   },
  park:       { icon: TreePine,  color: "bg-green-100 text-green-700 border-green-200" },
  religious:  { icon: Star,      color: "bg-amber-100 text-amber-700 border-amber-200" },
  restaurant: { icon: Utensils,  color: "bg-orange-100 text-orange-700 border-orange-200" },
  cafe:       { icon: Coffee,    color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  monument:   { icon: Landmark,  color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  hotel:      { icon: Building2, color: "bg-rose-100 text-rose-700 border-rose-200"   },
};

function CatBadge({ cat, className = "" }) {
  const cfg = CAT[cat] || { icon: MapPin, color: "bg-slate-100 text-slate-600 border-slate-200" };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.color} ${className}`}>
      <Icon className="w-3 h-3" />
      {cat || "other"}
    </span>
  );
}

// ── Completeness pill ─────────────────────────────────────────────────────────

function ScorePill({ pct }) {
  const color = pct >= 80
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : pct >= 50
    ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-red-50 text-red-500 border-red-200";
  const Icon = pct >= 80 ? CheckCircle2 : pct >= 50 ? Clock : AlertCircle;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${color}`}>
      <Icon className="w-3 h-3" />
      {pct}%
    </span>
  );
}

// ── Stats strip ───────────────────────────────────────────────────────────────

function Stats({ locs }) {
  const total     = locs.length;
  const stories   = locs.filter(l => l.has_story).length;
  const complete  = locs.filter(l => score(l) >= 80).length;
  const partial   = locs.filter(l => { const s = score(l); return s >= 50 && s < 80; }).length;
  const missing   = locs.filter(l => score(l) < 50).length;
  const pending   = locs.filter(l => l.status === "pending").length;

  return (
    <div className="grid grid-cols-6 border-b border-border/40 bg-muted/20">
      {[
        { label: "Total",    value: total,    color: "text-foreground" },
        { label: "Stories",  value: stories,  color: "text-primary" },
        { label: "Complete", value: complete, color: "text-emerald-600" },
        { label: "Partial",  value: partial,  color: "text-amber-600" },
        { label: "Weak",     value: missing,  color: "text-red-500" },
        { label: "Pending",  value: pending,  color: "text-blue-600" },
      ].map(s => (
        <div key={s.label} className="flex flex-col items-center py-3 border-r border-border/30 last:border-0">
          <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
          <span className="text-[10px] text-muted-foreground mt-0.5">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Location row ──────────────────────────────────────────────────────────────

function Row({ loc, onEdit, onToggleVisible, onEnriched, bulkMode, checked, onCheck }) {
  const [enriching, setEnriching] = useState(false);
  const pct = score(loc);

  const enrich = async (e) => {
    e.stopPropagation();
    setEnriching(true);
    try {
      const result = await callWorker("generateStory", {
        location_id: loc.id,
        generate_deep: false,
        generate_audio: false,
        is_new_version: !!loc.quick_story,
      });
      if (result?.success) {
        toast.success(`${loc.name} — story generated`);
        onEnriched();
      } else {
        toast.error(result?.errors?.[0] || "Enrichment failed");
      }
    } catch (err) {
      toast.error(err.message);
    }
    setEnriching(false);
  };

  return (
    <div
      onClick={() => !bulkMode && onEdit(loc)}
      className="group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors border-b border-border/30 last:border-0 cursor-pointer"
    >
      {/* Bulk checkbox */}
      {bulkMode && (
        <input
          type="checkbox"
          checked={checked}
          onChange={e => { e.stopPropagation(); onCheck(loc.id, e.target.checked); }}
          className="w-4 h-4 accent-primary flex-shrink-0"
          onClick={e => e.stopPropagation()}
        />
      )}

      {/* Status dot */}
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
        loc.status === "active" ? "bg-emerald-400" :
        loc.status === "pending" ? "bg-amber-400" : "bg-slate-300"
      }`} />

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium truncate max-w-[200px]">{loc.name}</span>
          {loc.has_story && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">
              Story
            </span>
          )}
          {loc.record_state === "enriched" && (
            <Sparkles className="w-3 h-3 text-violet-500 flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {[loc.city, loc.country].filter(Boolean).join(", ") || "No location set"}
        </p>
      </div>

      {/* Category */}
      <CatBadge cat={loc.category} className="hidden md:inline-flex flex-shrink-0" />

      {/* Score */}
      <ScorePill pct={pct} />

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={enrich}
          disabled={enriching}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 transition-colors disabled:opacity-50 flex-shrink-0"
          title="Generate AI story"
        >
          {enriching
            ? <RefreshCw className="w-3 h-3 animate-spin" />
            : <Wand2 className="w-3 h-3" />}
          {enriching ? "..." : "Enrich"}
        </button>
        <button
          onClick={e => { e.stopPropagation(); onToggleVisible(loc); }}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title={loc.visible_to_users ? "Hide from users" : "Show to users"}
        >
          {loc.visible_to_users
            ? <Eye className="w-3.5 h-3.5" />
            : <EyeOff className="w-3.5 h-3.5" />}
        </button>
      </div>

      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminLocations() {
  const [locations, setLocations]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");
  const [filterCat, setFilterCat]         = useState("all");
  const [filterStatus, setFilterStatus]   = useState("all");
  const [filterScore, setFilterScore]     = useState("all");
  const [showFilters, setShowFilters]     = useState(false);
  const [editing, setEditing]             = useState(null);   // location object or "new"
  const [bulkMode, setBulkMode]           = useState(false);
  const [selected, setSelected]           = useState(new Set());
  const [enrichingBulk, setEnrichingBulk] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("locations")
      .select("id,name,city,country,category,latitude,longitude,has_story,quick_story,mystery_teaser,fun_fact,image_url,status,visible_to_users,record_state,tier,visit_worthiness,opening_hours,community_rating,user_verified,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) toast.error("Failed to load locations");
    else setLocations(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filtered = locations.filter(loc => {
    if (search) {
      const q = search.toLowerCase();
      if (!loc.name?.toLowerCase().includes(q) &&
          !loc.city?.toLowerCase().includes(q) &&
          !loc.country?.toLowerCase().includes(q)) return false;
    }
    if (filterCat !== "all" && loc.category !== filterCat) return false;
    if (filterStatus !== "all" && loc.status !== filterStatus) return false;
    if (filterScore !== "all") {
      const s = score(loc);
      if (filterScore === "complete" && s < 80)  return false;
      if (filterScore === "partial"  && (s < 50 || s >= 80)) return false;
      if (filterScore === "weak"     && s >= 50) return false;
    }
    return true;
  });

  const categories = [...new Set(locations.map(l => l.category).filter(Boolean))].sort();
  const activeFilters = [filterCat, filterStatus, filterScore].filter(f => f !== "all").length;

  // ── Actions ─────────────────────────────────────────────────────────────────
  const toggleVisible = async (loc) => {
    const { error } = await supabase
      .from("locations")
      .update({ visible_to_users: !loc.visible_to_users })
      .eq("id", loc.id);
    if (error) toast.error("Update failed");
    else {
      toast.success(loc.visible_to_users ? "Hidden from users" : "Now visible");
      load();
    }
  };

  const enrichMissing = async () => {
    const ids = filtered.filter(l => !l.has_story).slice(0, 20).map(l => l.id);
    if (!ids.length) { toast.info("All visible locations already have stories"); return; }
    setEnrichingBulk(true);
    toast.info(`Enriching ${ids.length} locations...`);
    try {
      const result = await callWorker("generateBulkStories", {
        location_ids: ids,
        generate_audio: false,
      });
      toast.success(`Done — ${result?.success || 0} of ${result?.total || 0} enriched`);
      load();
    } catch (e) {
      toast.error("Bulk enrich failed: " + e.message);
    }
    setEnrichingBulk(false);
  };

  const enrichSelected = async () => {
    const ids = [...selected];
    if (!ids.length) { toast.error("Select locations first"); return; }
    setEnrichingBulk(true);
    toast.info(`Enriching ${ids.length} selected...`);
    try {
      const result = await callWorker("generateBulkStories", {
        location_ids: ids,
        generate_audio: false,
      });
      toast.success(`Done — ${result?.success || 0} of ${result?.total || 0} enriched`);
      setSelected(new Set());
      load();
    } catch (e) {
      toast.error("Bulk enrich failed: " + e.message);
    }
    setEnrichingBulk(false);
  };

  const toggleSelect = (id, checked) => {
    const next = new Set(selected);
    checked ? next.add(id) : next.delete(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(l => l.id)));
  };

  // ── Editing view ────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <LocationEditor
        location={editing === "new" ? null : editing}
        onClose={() => { setEditing(null); load(); }}
        onSaved={() => { setEditing(null); load(); toast.success("Location saved"); }}
      />
    );
  }

  // ── Main view ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 bg-card">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Locations</h2>
          <p className="text-[11px] text-muted-foreground">
            {locations.length} total · {filtered.length} shown
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Enrich Missing — always visible */}
          <button
            onClick={enrichMissing}
            disabled={enrichingBulk}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
          >
            {enrichingBulk
              ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              : <Wand2 className="w-3.5 h-3.5" />}
            Enrich Missing
          </button>

          {/* Bulk toggle */}
          <button
            onClick={() => { setBulkMode(!bulkMode); setSelected(new Set()); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              bulkMode
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {bulkMode ? "Cancel" : "Bulk"}
          </button>

          {/* Add */}
          <button
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <Stats locs={locations} />

      {/* ── Bulk action bar (when bulk mode active) ─────────────────────── */}
      {bulkMode && (
        <div className="flex items-center justify-between px-4 py-2 bg-primary/5 border-b border-primary/20">
          <button
            onClick={selectAll}
            className="text-xs font-medium text-primary hover:underline"
          >
            {selected.size === filtered.length
              ? "Deselect all"
              : `Select all ${filtered.length}`}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {selected.size} selected
            </span>
            {selected.size > 0 && (
              <button
                onClick={enrichSelected}
                disabled={enrichingBulk}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {enrichingBulk
                  ? <RefreshCw className="w-3 h-3 animate-spin" />
                  : <Wand2 className="w-3 h-3" />}
                Enrich {selected.size}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Search + filters ────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-border/40 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, city, country…"
              className="pl-8 h-8 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              showFilters || activeFilters > 0
                ? "bg-primary/10 border-primary/30 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
            {activeFilters > 0 && (
              <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 pt-1">
            <select
              value={filterCat}
              onChange={e => setFilterCat(e.target.value)}
              className="h-7 px-2 text-xs rounded-md border border-border bg-background text-foreground"
            >
              <option value="all">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="h-7 px-2 text-xs rounded-md border border-border bg-background text-foreground"
            >
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="pending">Pending review</option>
              <option value="inactive">Inactive</option>
            </select>
            <select
              value={filterScore}
              onChange={e => setFilterScore(e.target.value)}
              className="h-7 px-2 text-xs rounded-md border border-border bg-background text-foreground"
            >
              <option value="all">All completeness</option>
              <option value="complete">Complete (80%+)</option>
              <option value="partial">Partial (50–79%)</option>
              <option value="weak">Weak (&lt;50%)</option>
            </select>
            {activeFilters > 0 && (
              <button
                onClick={() => { setFilterCat("all"); setFilterStatus("all"); setFilterScore("all"); }}
                className="h-7 px-2 text-xs rounded-md text-muted-foreground hover:text-foreground flex items-center gap-1 border border-border hover:bg-muted transition-colors"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── List ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading locations…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <MapPin className="w-8 h-8 opacity-20" />
            <p className="text-sm">No locations match your filters</p>
            {(search || activeFilters > 0) && (
              <button
                onClick={() => { setSearch(""); setFilterCat("all"); setFilterStatus("all"); setFilterScore("all"); }}
                className="text-xs text-primary hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          filtered.map(loc => (
            <Row
              key={loc.id}
              loc={loc}
              onEdit={setEditing}
              onToggleVisible={toggleVisible}
              onEnriched={load}
              bulkMode={bulkMode}
              checked={selected.has(loc.id)}
              onCheck={toggleSelect}
            />
          ))
        )}
      </div>

      {/* ── Footer count ─────────────────────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <div className="px-5 py-2.5 border-t border-border/40 bg-muted/20">
          <p className="text-[11px] text-muted-foreground">
            Showing {filtered.length} of {locations.length} locations
          </p>
        </div>
      )}
    </div>
  );
}
