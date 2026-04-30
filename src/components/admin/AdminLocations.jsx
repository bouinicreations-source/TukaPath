/**
 * AdminLocations.jsx
 * 
 * Redesigned location management — clean CMS-style interface.
 * Handles: browse, filter, edit, AI enrich, user submissions, completeness scoring.
 */

import React, { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabase";
import { base44 } from "@/api/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, Plus, Sparkles, MapPin, AlertCircle, CheckCircle2,
  Clock, Filter, MoreHorizontal, ChevronRight, Wand2,
  Eye, EyeOff, Star, RefreshCw, Upload, Download,
  Building2, TreePine, Landmark, Coffee, Utensils,
  X, Check, Edit3, Trash2, Globe, Camera, FileText,
  TrendingUp, Users, MessageSquare, Flag
} from "lucide-react";
import LocationEditor from "./LocationEditor";

// ── Completeness scoring ──────────────────────────────────────────────────────

function scoreCompleteness(loc) {
  const fields = [
    { key: 'name',          weight: 10 },
    { key: 'city',          weight: 8  },
    { key: 'country',       weight: 8  },
    { key: 'category',      weight: 8  },
    { key: 'latitude',      weight: 10 },
    { key: 'longitude',     weight: 10 },
    { key: 'quick_story',   weight: 15 },
    { key: 'mystery_teaser',weight: 10 },
    { key: 'fun_fact',      weight: 8  },
    { key: 'image_url',     weight: 8  },
    { key: 'opening_hours', weight: 5  },
  ];
  let total = 0, earned = 0;
  for (const f of fields) {
    total += f.weight;
    if (loc[f.key] && String(loc[f.key]).trim().length > 0) earned += f.weight;
  }
  return Math.round((earned / total) * 100);
}

function completenessColor(score) {
  if (score >= 80) return 'text-emerald-600 bg-emerald-50';
  if (score >= 50) return 'text-amber-600 bg-amber-50';
  return 'text-red-500 bg-red-50';
}

function completenessLabel(score) {
  if (score >= 80) return 'Complete';
  if (score >= 50) return 'Partial';
  return 'Incomplete';
}

// ── Category icons ────────────────────────────────────────────────────────────

function CategoryIcon({ category, className = "w-3.5 h-3.5" }) {
  const icons = {
    museum: Building2, park: TreePine, landmark: Landmark,
    cafe: Coffee, restaurant: Utensils, religious: Star,
    monument: Landmark, hotel: Building2, bridge: Landmark,
    tower: Landmark, hidden_spot: MapPin,
  };
  const Icon = icons[category] || MapPin;
  return <Icon className={className} />;
}

const CATEGORY_COLORS = {
  museum:     'bg-purple-50 text-purple-700 border-purple-200',
  landmark:   'bg-blue-50 text-blue-700 border-blue-200',
  park:       'bg-green-50 text-green-700 border-green-200',
  religious:  'bg-amber-50 text-amber-700 border-amber-200',
  restaurant: 'bg-orange-50 text-orange-700 border-orange-200',
  cafe:       'bg-yellow-50 text-yellow-700 border-yellow-200',
  hotel:      'bg-rose-50 text-rose-700 border-rose-200',
  monument:   'bg-indigo-50 text-indigo-700 border-indigo-200',
  bridge:     'bg-sky-50 text-sky-700 border-sky-200',
  tower:      'bg-teal-50 text-teal-700 border-teal-200',
  hidden_spot:'bg-pink-50 text-pink-700 border-pink-200',
};

// ── AI Enrich Button ──────────────────────────────────────────────────────────

function AIEnrichButton({ location, onDone }) {
  const [loading, setLoading] = useState(false);

  const enrich = async () => {
    setLoading(true);
    try {
      const prompt = `You are enriching a travel location record for TukaPath.

Location: ${location.name}
City: ${location.city || 'unknown'}
Country: ${location.country || 'unknown'}
Category: ${location.category || 'landmark'}
Current story: ${location.quick_story || 'none'}

Please provide enriched data in JSON format:
{
  "quick_story": "2-3 vivid, factual sentences about this place",
  "mystery_teaser": "One intriguing hook under 20 words",
  "fun_fact": "One surprising fact",
  "best_time_of_day": "morning/afternoon/evening/any",
  "timing_notes": "Brief note on best time to visit",
  "visit_worthiness": "hero/worth_stop/conditional"
}

Be specific, factual, and vivid. No generic descriptions.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            quick_story: { type: "string" },
            mystery_teaser: { type: "string" },
            fun_fact: { type: "string" },
            best_time_of_day: { type: "string" },
            timing_notes: { type: "string" },
            visit_worthiness: { type: "string" },
          }
        }
      });

      if (result && typeof result === 'object') {
        await supabase.from('locations').update({
          quick_story: result.quick_story || location.quick_story,
          mystery_teaser: result.mystery_teaser || location.mystery_teaser,
          fun_fact: result.fun_fact || location.fun_fact,
          best_time_of_day: result.best_time_of_day || location.best_time_of_day,
          timing_notes: result.timing_notes || location.timing_notes,
          visit_worthiness: result.visit_worthiness || location.visit_worthiness,
          has_story: !!(result.quick_story || location.quick_story),
          record_state: 'enriched',
          updated_at: new Date().toISOString(),
        }).eq('id', location.id);

        toast.success(`${location.name} enriched`);
        onDone?.();
      }
    } catch (e) {
      toast.error('Enrichment failed: ' + e.message);
    }
    setLoading(false);
  };

  return (
    <button
      onClick={(e) => { e.stopPropagation(); enrich(); }}
      disabled={loading}
      className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-50"
    >
      {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
      {loading ? 'Enriching...' : 'AI Enrich'}
    </button>
  );
}

// ── Location Row ──────────────────────────────────────────────────────────────

function LocationRow({ loc, onEdit, onToggleVisible, onDelete, onEnriched }) {
  const score = scoreCompleteness(loc);
  const catColor = CATEGORY_COLORS[loc.category] || 'bg-slate-50 text-slate-600 border-slate-200';
  const hasFeedback = loc.community_rating || loc.user_verified;

  return (
    <div
      onClick={() => onEdit(loc)}
      className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors border-b border-border/40 last:border-0"
    >
      {/* Status dot */}
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
        loc.status === 'active' ? 'bg-emerald-400' :
        loc.status === 'pending' ? 'bg-amber-400' : 'bg-slate-300'
      }`} />

      {/* Category icon */}
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 border ${catColor}`}>
        <CategoryIcon category={loc.category} />
      </div>

      {/* Name + location */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{loc.name}</span>
          {loc.has_story && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Story</span>}
          {loc.record_state === 'enriched' && <Sparkles className="w-3 h-3 text-violet-500 flex-shrink-0" />}
          {hasFeedback && <Users className="w-3 h-3 text-blue-500 flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-muted-foreground truncate">
            {[loc.city, loc.country].filter(Boolean).join(', ') || 'No location'}
          </span>
          {loc.tier === 1 && <span className="text-[10px] px-1 py-0 rounded bg-amber-100 text-amber-700">T1</span>}
        </div>
      </div>

      {/* Completeness */}
      <div className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium flex-shrink-0 ${completenessColor(score)}`}>
        <span>{score}%</span>
      </div>

      {/* Category badge */}
      <span className={`hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border flex-shrink-0 ${catColor}`}>
        {loc.category || 'other'}
      </span>

      {/* Actions — visible on hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <AIEnrichButton location={loc} onDone={onEnriched} />
        <button
          onClick={(e) => { e.stopPropagation(); onToggleVisible(loc); }}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          {loc.visible_to_users ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
      </div>

      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
    </div>
  );
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────

function StatsBar({ locations }) {
  const total = locations.length;
  const withStory = locations.filter(l => l.has_story).length;
  const complete = locations.filter(l => scoreCompleteness(l) >= 80).length;
  const partial = locations.filter(l => { const s = scoreCompleteness(l); return s >= 50 && s < 80; }).length;
  const incomplete = locations.filter(l => scoreCompleteness(l) < 50).length;
  const pending = locations.filter(l => l.status === 'pending').length;

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 p-4 bg-muted/30 border-b border-border/40">
      {[
        { label: 'Total', value: total, color: 'text-foreground' },
        { label: 'With Story', value: withStory, color: 'text-primary' },
        { label: 'Complete', value: complete, color: 'text-emerald-600' },
        { label: 'Partial', value: partial, color: 'text-amber-600' },
        { label: 'Incomplete', value: incomplete, color: 'text-red-500' },
        { label: 'Pending Review', value: pending, color: 'text-blue-600' },
      ].map(s => (
        <div key={s.label} className="text-center">
          <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
          <div className="text-[11px] text-muted-foreground">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminLocations() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCompleteness, setFilterCompleteness] = useState('all');
  const [filterTier, setFilterTier] = useState('all');
  const [editingLocation, setEditingLocation] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [bulkSelected, setBulkSelected] = useState(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['admin-locations'],
    queryFn: () => base44.entities.Location.list('-created_at', 2000),
    staleTime: 30000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-locations'] });

  // Filter logic
  const filtered = locations.filter(loc => {
    if (search) {
      const q = search.toLowerCase();
      if (!loc.name?.toLowerCase().includes(q) &&
          !loc.city?.toLowerCase().includes(q) &&
          !loc.country?.toLowerCase().includes(q)) return false;
    }
    if (filterCategory !== 'all' && loc.category !== filterCategory) return false;
    if (filterStatus !== 'all' && loc.status !== filterStatus) return false;
    if (filterTier !== 'all' && String(loc.tier) !== filterTier) return false;
    if (filterCompleteness !== 'all') {
      const s = scoreCompleteness(loc);
      if (filterCompleteness === 'complete' && s < 80) return false;
      if (filterCompleteness === 'partial' && (s < 50 || s >= 80)) return false;
      if (filterCompleteness === 'incomplete' && s >= 50) return false;
    }
    return true;
  });

  const categories = [...new Set(locations.map(l => l.category).filter(Boolean))].sort();

  const toggleVisible = async (loc) => {
    await supabase.from('locations').update({ visible_to_users: !loc.visible_to_users }).eq('id', loc.id);
    refresh();
    toast.success(loc.visible_to_users ? 'Hidden from users' : 'Now visible to users');
  };

  const bulkEnrich = async () => {
    const selected = filtered.filter(l => bulkSelected.has(l.id) && scoreCompleteness(l) < 80);
    if (!selected.length) { toast.error('No incomplete locations selected'); return; }
    toast.info(`Enriching ${selected.length} locations...`);
    for (const loc of selected.slice(0, 10)) {
      try {
        const prompt = `Enrich this travel location for TukaPath. Return JSON only.
Location: ${loc.name}, ${loc.city || ''}, ${loc.country || ''}
Category: ${loc.category}
{"quick_story":"2-3 vivid sentences","mystery_teaser":"hook under 20 words","fun_fact":"one fact","visit_worthiness":"hero/worth_stop/conditional"}`;
        const result = await base44.integrations.Core.InvokeLLM({ prompt, response_json_schema: { type: 'object', properties: { quick_story: { type: 'string' }, mystery_teaser: { type: 'string' }, fun_fact: { type: 'string' }, visit_worthiness: { type: 'string' } } } });
        if (result?.quick_story) {
          await supabase.from('locations').update({ ...result, has_story: true, record_state: 'enriched' }).eq('id', loc.id);
        }
      } catch {}
    }
    refresh();
    setBulkSelected(new Set());
    toast.success('Bulk enrichment complete');
  };

  const activeFilters = [filterCategory, filterStatus, filterCompleteness, filterTier].filter(f => f !== 'all').length;

  if (editingLocation || showCreate) {
    return (
      <LocationEditor
        location={typeof showCreate === 'object' ? showCreate : editingLocation}
        onClose={() => { setEditingLocation(null); setShowCreate(false); refresh(); }}
        onSaved={() => { setEditingLocation(null); setShowCreate(false); refresh(); toast.success('Location saved'); }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
        <div>
          <h2 className="text-base font-semibold">Locations</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{locations.length} total · {filtered.length} shown</p>
        </div>
        <div className="flex items-center gap-2">
          {bulkMode && bulkSelected.size > 0 && (
            <Button size="sm" variant="outline" onClick={bulkEnrich} className="text-violet-700 border-violet-200 bg-violet-50 hover:bg-violet-100">
              <Wand2 className="w-3.5 h-3.5 mr-1" />
              AI Enrich {bulkSelected.size}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => { setBulkMode(!bulkMode); setBulkSelected(new Set()); }} className={bulkMode ? 'bg-muted' : ''}>
            {bulkMode ? 'Done' : 'Bulk'}
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1">
            <Plus className="w-3.5 h-3.5" />
            Add
          </Button>
        </div>
      </div>

      {/* Stats */}
      <StatsBar locations={locations} />

      {/* Search + Filters */}
      <div className="px-4 py-3 border-b border-border/40 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, city, country..."
              className="pl-8 h-8 text-sm"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border transition-colors ${showFilters || activeFilters > 0 ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border hover:bg-muted'}`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filter
            {activeFilters > 0 && <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">{activeFilters}</span>}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2">
            {/* Category */}
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
              className="h-7 px-2 text-xs rounded-md border border-border bg-background">
              <option value="all">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Status */}
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="h-7 px-2 text-xs rounded-md border border-border bg-background">
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="pending">Pending review</option>
              <option value="inactive">Inactive</option>
            </select>

            {/* Completeness */}
            <select value={filterCompleteness} onChange={e => setFilterCompleteness(e.target.value)}
              className="h-7 px-2 text-xs rounded-md border border-border bg-background">
              <option value="all">All completeness</option>
              <option value="complete">Complete (80%+)</option>
              <option value="partial">Partial (50-79%)</option>
              <option value="incomplete">Incomplete (&lt;50%)</option>
            </select>

            {/* Tier */}
            <select value={filterTier} onChange={e => setFilterTier(e.target.value)}
              className="h-7 px-2 text-xs rounded-md border border-border bg-background">
              <option value="all">All tiers</option>
              <option value="1">Tier 1 — Hero</option>
              <option value="2">Tier 2 — Standard</option>
              <option value="3">Tier 3 — Support</option>
            </select>

            {activeFilters > 0 && (
              <button onClick={() => { setFilterCategory('all'); setFilterStatus('all'); setFilterCompleteness('all'); setFilterTier('all'); }}
                className="h-7 px-2 text-xs rounded-md text-muted-foreground hover:text-foreground flex items-center gap-1">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading locations...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <MapPin className="w-8 h-8 mb-3 opacity-30" />
            <p className="text-sm">No locations match your filters</p>
            {search && <button onClick={() => setSearch('')} className="text-xs text-primary mt-1">Clear search</button>}
          </div>
        ) : (
          filtered.map(loc => (
            <div key={loc.id} className="flex items-center">
              {bulkMode && (
                <div className="pl-4" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={bulkSelected.has(loc.id)}
                    onChange={e => {
                      const next = new Set(bulkSelected);
                      e.target.checked ? next.add(loc.id) : next.delete(loc.id);
                      setBulkSelected(next);
                    }}
                    className="w-3.5 h-3.5 accent-primary"
                  />
                </div>
              )}
              <div className="flex-1">
                <LocationRow
                  loc={loc}
                  onEdit={setEditingLocation}
                  onToggleVisible={toggleVisible}
                  onDelete={async (l) => {
                    if (!confirm(`Delete "${l.name}"?`)) return;
                    await supabase.from('locations').delete().eq('id', l.id);
                    refresh();
                    toast.success('Deleted');
                  }}
                  onEnriched={refresh}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bulk select bar */}
      {bulkMode && (
        <div className="border-t border-border/60 px-4 py-3 bg-muted/30 flex items-center justify-between">
          <button onClick={() => {
            if (bulkSelected.size === filtered.length) setBulkSelected(new Set());
            else setBulkSelected(new Set(filtered.map(l => l.id)));
          }} className="text-xs text-primary">
            {bulkSelected.size === filtered.length ? 'Deselect all' : `Select all ${filtered.length}`}
          </button>
          <span className="text-xs text-muted-foreground">{bulkSelected.size} selected</span>
        </div>
      )}
    </div>
  );
}
