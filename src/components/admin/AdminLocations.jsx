import React, { useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Edit2, Trash2, ChevronDown, ChevronUp, Briefcase } from "lucide-react";
import LocationEditor from "./LocationEditor";
import AdminBulkGenerator from "./AdminBulkGenerator";
import AdminGeneratedLocations from "./AdminGeneratedLocations";
import AdminJobManager from "./AdminJobManager";
import AdminAddMenu from "./AdminAddMenu";

const LAYER_CONFIG = {
  journey:     { label: "Journey",     cls: "bg-emerald-50 text-emerald-700" },
  service:     { label: "Service",     cls: "bg-orange-50 text-orange-700" },
  hospitality: { label: "Hospitality", cls: "bg-rose-50 text-rose-700" },
  utility:     { label: "Utility",     cls: "bg-slate-100 text-slate-500" },
  transit:     { label: "Transit",     cls: "bg-sky-50 text-sky-700" },
};

function LayerBadge({ loc }) {
  const layer = loc.record_layer || loc.venue_class || "journey";
  const cfg = LAYER_CONFIG[layer] || { label: layer, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

const TYPE_CODE_COLORS = {
  ATT: "bg-blue-50 text-blue-700",
  MUS: "bg-purple-50 text-purple-700",
  MON: "bg-indigo-50 text-indigo-700",
  PAR: "bg-green-50 text-green-700",
  BEA: "bg-cyan-50 text-cyan-700",
  CAF: "bg-amber-50 text-amber-700",
  RES: "bg-orange-50 text-orange-700",
  HOT: "bg-rose-50 text-rose-700",
  BAR: "bg-pink-50 text-pink-700",
  FUL: "bg-slate-50 text-slate-600",
  PKG: "bg-slate-50 text-slate-600",
  RST: "bg-slate-50 text-slate-600",
};

const RECORD_STATE_CONFIG = {
  raw:          { dot: "bg-slate-400",  label: "Raw",          text: "text-slate-600 bg-slate-100" },
  needs_review: { dot: "bg-amber-400",  label: "Needs Review", text: "text-amber-700 bg-amber-50" },
  curated:      { dot: "bg-blue-500",   label: "Curated",      text: "text-blue-700 bg-blue-50" },
  enriched:     { dot: "bg-green-500",  label: "Enriched",     text: "text-green-700 bg-green-50" },
  hidden:       { dot: "bg-red-500",    label: "Hidden",       text: "text-red-600 bg-red-50" },
};

function RecordStateBadge({ loc }) {
  const state = loc.record_state || "raw";
  const cfg = RECORD_STATE_CONFIG[state] || RECORD_STATE_CONFIG.raw;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function SystemOverview({ locations }) {
  const [open, setOpen] = useState(false);
  const total        = locations.length;
  const rawCount     = locations.filter(l => (l.record_state || "raw") === "raw").length;
  const needsReview  = locations.filter(l => l.record_state === "needs_review").length;
  const curated      = locations.filter(l => l.record_state === "curated").length;
  const enriched     = locations.filter(l => l.record_state === "enriched").length;
  const hidden       = locations.filter(l => l.record_state === "hidden").length;
  const withAudio    = locations.filter(l => l.quick_audio_url).length;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors">
        <span className="text-sm font-semibold">System Overview</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 pb-4 grid grid-cols-3 sm:grid-cols-6 gap-3 border-t border-border pt-4">
          {[
            { label: "Total",        value: total,       color: "text-foreground" },
            { label: "Raw",          value: rawCount,    color: "text-slate-600" },
            { label: "Needs Review", value: needsReview, color: needsReview > 0 ? "text-amber-600" : "text-muted-foreground" },
            { label: "Curated",      value: curated,     color: "text-blue-600" },
            { label: "Enriched",     value: enriched,    color: "text-green-600" },
            { label: "Hidden",       value: hidden,      color: hidden > 0 ? "text-red-600" : "text-muted-foreground" },
            { label: "Has Audio",    value: `${withAudio}/${total}`, color: "text-primary" },
          ].map(item => (
            <div key={item.label} className="text-center">
              <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function AdminLocations() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [recordLayerFilter, setRecordLayerFilter] = useState("all");
  const [recordStateFilter, setRecordStateFilter] = useState("all");
  const [placeTypeFilter, setPlaceTypeFilter] = useState("all");
  const [duplicateCandidateFilter, setDuplicateCandidateFilter] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState("official");
  const [activePanel, setActivePanel] = useState(null);

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["admin-locations"],
    queryFn: () => base44.entities.Location.list("-created_date", 9999)
  });

  // Quick preset helper — applies state + clears duplicateCandidateFilter unless needed
  const applyPreset = (state) => {
    if (state === "duplicate_candidates") {
      setDuplicateCandidateFilter(true);
      setRecordStateFilter("all");
    } else {
      setDuplicateCandidateFilter(false);
      setRecordStateFilter(state === recordStateFilter ? "all" : state);
    }
  };

  const filtered = locations.filter((l) => {
    const matchSearch = !search || l.name?.toLowerCase().includes(search.toLowerCase()) || l.city?.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (recordLayerFilter !== "all" && (l.record_layer || l.venue_class || "journey") !== recordLayerFilter) return false;
    if (recordStateFilter !== "all" && (l.record_state || "raw") !== recordStateFilter) return false;
    if (placeTypeFilter !== "all" && (l.place_type_code || "") !== placeTypeFilter) return false;
    if (duplicateCandidateFilter && !l.duplicate_candidate) return false;
    return true;
  });

  const official = filtered.filter((l) => l.source !== "user_contribution");
  const contributions = filtered.filter((l) => l.source === "user_contribution");

  const handleSave = async (data) => {
    if (editingLocation) {
      await base44.entities.Location.update(editingLocation.id, data);
      toast.success("Location updated");
    } else {
      await base44.entities.Location.create({ ...data, source: "official" });
      toast.success("Location created");
    }
    setEditingLocation(null);
    setShowCreate(false);
    queryClient.invalidateQueries({ queryKey: ["admin-locations"] });
  };

  const handleDelete = async (id) => {
    await base44.entities.Location.delete(id);
    setEditingLocation(null);
    setShowCreate(false);
    queryClient.invalidateQueries({ queryKey: ["admin-locations"] });
    toast.success("Location deleted");
  };

  const handleDuplicate = (data) => {
    setEditingLocation(null);
    setShowCreate(true);
    // Pre-populate the create form with a copy
    setTimeout(() => setShowCreate({ ...data, id: undefined, location_id: "", name: data.name + " (copy)" }), 10);
  };

  if (editingLocation || showCreate) {
    return (
      <LocationEditor
        location={typeof showCreate === "object" ? showCreate : editingLocation}
        locations={locations}
        onSave={handleSave}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onCancel={() => {setEditingLocation(null);setShowCreate(false);}} />);


  }

  if (activePanel === "bulk") {
    return <AdminBulkGenerator onBack={() => setActivePanel(null)} />;
  }

  if (activePanel === "generated") {
    return (
      <div>
        <button onClick={() => setActivePanel(null)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4">
          ← Back to Locations
        </button>
        <AdminGeneratedLocations />
      </div>);
  }

  if (activePanel === "jobs") {
    return (
      <div>
        <button onClick={() => setActivePanel(null)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4">
          ← Back to Locations
        </button>
        <AdminJobManager />
      </div>);
  }

  const rows = activeTab === "official" ? official : contributions;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <select
          value={recordLayerFilter}
          onChange={(e) => { setRecordLayerFilter(e.target.value); setDuplicateCandidateFilter(false); }}
          className="border border-input rounded-md px-2 py-1.5 bg-background text-sm text-foreground">
          <option value="all">All layers</option>
          <option value="journey">Journey</option>
          <option value="service">Service</option>
          <option value="hospitality">Hospitality</option>
          <option value="utility">Utility</option>
          <option value="transit">Transit</option>
        </select>
        <select
          value={placeTypeFilter}
          onChange={(e) => setPlaceTypeFilter(e.target.value)}
          className="border border-input rounded-md px-2 py-1.5 bg-background text-sm text-foreground">
          <option value="all">All types</option>
          {["ATT","MUS","MON","PAR","BEA","CAF","RES","HOT","BAR","FUL","PKG","RST"].map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={() => setActivePanel("jobs")} className="gap-1.5 text-xs">
          <Briefcase className="w-3.5 h-3.5" /> Job Manager
        </Button>
        <AdminAddMenu
          onAction={(action) => {
            if (action === "location_manual") setShowCreate(true);
          }}
          onNavigate={(section, item) => {
            if (item === "bulkgenerator" || item === "import") setActivePanel("bulk");
            if (item === "generatedlocations") setActivePanel("generated");
            if (item === "jobmanager") setActivePanel("jobs");
          }} />
      </div>

      {/* Quick filter presets */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mr-1">Quick:</span>
        {[
          { key: "raw",                label: "Raw",               cls: "text-slate-600 bg-slate-100 border-slate-200" },
          { key: "needs_review",       label: "Needs Review",      cls: "text-amber-700 bg-amber-50 border-amber-200" },
          { key: "curated",            label: "Curated",           cls: "text-blue-700 bg-blue-50 border-blue-200" },
          { key: "hidden",             label: "Hidden",            cls: "text-red-600 bg-red-50 border-red-200" },
          { key: "duplicate_candidates", label: "⚠ Duplicates",   cls: "text-orange-700 bg-orange-50 border-orange-200" },
        ].map(({ key, label, cls }) => {
          const isActive = key === "duplicate_candidates"
            ? duplicateCandidateFilter
            : recordStateFilter === key && !duplicateCandidateFilter;
          return (
            <button
              key={key}
              onClick={() => applyPreset(key)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${cls} ${isActive ? "ring-2 ring-offset-1 ring-current opacity-100" : "opacity-60 hover:opacity-100"}`}
            >
              {label}
            </button>
          );
        })}
        {(recordStateFilter !== "all" || duplicateCandidateFilter) && (
          <button
            onClick={() => { setRecordStateFilter("all"); setDuplicateCandidateFilter(false); }}
            className="px-2 py-1 rounded-full text-[11px] text-muted-foreground hover:text-foreground border border-border"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* System overview */}
      <SystemOverview locations={locations} />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-0">
        {[
        { id: "official", label: `Official (${official.length})` },
        { id: "contributions", label: `Explorer (${contributions.length})` }].
        map((t) =>
        <button
          key={t.id}
          onClick={() => setActiveTab(t.id)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
          activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`
          }>
          
            {t.label}
          </button>
        )}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-36">Location ID</TableHead>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">City, Country</TableHead>
                <TableHead className="text-xs">State</TableHead>
                <TableHead className="text-xs">Layer</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                {activeTab === "contributions" && <TableHead className="text-xs">Contributor</TableHead>}
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ?
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-sm">Loading…</TableCell></TableRow> :
              rows.length === 0 ?
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-sm">No locations found</TableCell></TableRow> :

              rows.map((loc) =>
              <TableRow key={loc.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-[10px] text-muted-foreground">
                      {loc.location_id || <span className="text-amber-500 text-[10px]">—unset—</span>}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {loc.image_url && <img src={loc.image_url} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" />}
                        {loc.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]">{loc.city}{loc.country ? `, ${loc.country}` : ""}</TableCell>
                    <TableCell><RecordStateBadge loc={loc} /></TableCell>
                    <TableCell><LayerBadge loc={loc} /></TableCell>
                    <TableCell>
                      {loc.place_type_code ? (
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${TYPE_CODE_COLORS[loc.place_type_code] || "bg-muted text-muted-foreground"}`}>
                          {loc.place_type_code}
                        </span>
                      ) : <span className="text-muted-foreground text-[10px]">—</span>}
                    </TableCell>
                    {activeTab === "contributions" &&
                <TableCell className="text-xs text-muted-foreground">{loc.contributor_name || "—"}</TableCell>
                }
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setEditingLocation(loc)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleDelete(loc.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
              )
              }
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>);

}