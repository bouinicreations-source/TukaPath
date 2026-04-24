import React, { useState } from "react";
import { base44 } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MapPin, CheckCircle2, XCircle, Edit3, GitMerge, AlertTriangle, ArrowLeft, X } from "lucide-react";

const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  merged: "bg-blue-100 text-blue-700",
};

const CATEGORY_LABELS = {
  landmark: "Landmark", statue: "Statue", monument: "Monument",
  hidden_spot: "Hidden Spot", museum: "Museum", park: "Park",
  religious: "Religious", bridge: "Bridge", tower: "Tower",
  square: "Square", other: "Other",
};

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nameSimilarity(a, b) {
  const clean = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const s = clean(a), t = clean(b);
  if (!s || !t) return 0;
  if (s.includes(t) || t.includes(s)) return 0.8;
  const shared = [...s].filter(c => t.includes(c)).length;
  return shared / Math.max(s.length, t.length);
}

function findDuplicates(suggestion, locations) {
  return locations.filter(loc => {
    const dist = getDistance(suggestion.latitude, suggestion.longitude, loc.latitude, loc.longitude);
    const sim = nameSimilarity(suggestion.suggested_name, loc.name);
    return dist < 500 || sim > 0.5;
  }).slice(0, 3);
}

function EditPanel({ suggestion, onSave, onClose }) {
  const [form, setForm] = useState({
    suggested_name: suggestion.suggested_name,
    suggested_description: suggestion.suggested_description || "",
    category: suggestion.category || "",
    city: suggestion.city || "",
    country: suggestion.country || "",
  });
  const ch = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-[600] bg-black/50 flex items-end sm:items-center justify-center">
      <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <p className="font-semibold text-sm">Edit before approving</p>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        {[
          { label: "Name", key: "suggested_name" },
          { label: "Description", key: "suggested_description" },
          { label: "City", key: "city" },
          { label: "Country", key: "country" },
        ].map(({ label, key }) => (
          <div key={key}>
            <label className="text-xs font-medium text-muted-foreground">{label}</label>
            <Input value={form[key]} onChange={e => ch(key, e.target.value)} className="h-8 text-sm mt-0.5" />
          </div>
        ))}
        <Button className="w-full mt-2" onClick={() => onSave(form)}>Save & Approve</Button>
      </div>
    </div>
  );
}

function SuggestionDetail({ suggestion, locations, onAction, onClose }) {
  const duplicates = findDuplicates(suggestion, locations);
  const [editOpen, setEditOpen] = useState(false);
  const [acting, setActing] = useState(false);
  const [mergeId, setMergeId] = useState("");

  const act = async (action, extra = {}) => {
    setActing(true);
    await onAction(suggestion.id, action, extra);
    setActing(false);
  };

  return (
    <div className="space-y-4">
      <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {suggestion.image_url && (
        <img src={suggestion.image_url} alt={suggestion.suggested_name} className="w-full h-48 object-cover rounded-xl" />
      )}

      <div className="space-y-1.5 text-sm">
        <div className="flex items-start gap-2">
          <span className="font-semibold w-28 flex-shrink-0 text-muted-foreground">Name</span>
          <span>{suggestion.suggested_name}</span>
        </div>
        {suggestion.suggested_description && (
          <div className="flex items-start gap-2">
            <span className="font-semibold w-28 flex-shrink-0 text-muted-foreground">Description</span>
            <span className="text-muted-foreground">{suggestion.suggested_description}</span>
          </div>
        )}
        <div className="flex items-start gap-2">
          <span className="font-semibold w-28 flex-shrink-0 text-muted-foreground">Category</span>
          <span>{CATEGORY_LABELS[suggestion.category] || suggestion.category || "—"}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="font-semibold w-28 flex-shrink-0 text-muted-foreground">Location</span>
          <span>{suggestion.city}{suggestion.country ? `, ${suggestion.country}` : ""}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="font-semibold w-28 flex-shrink-0 text-muted-foreground">Coordinates</span>
          <span className="text-xs text-muted-foreground">{suggestion.latitude?.toFixed(5)}, {suggestion.longitude?.toFixed(5)}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="font-semibold w-28 flex-shrink-0 text-muted-foreground">Photo source</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${suggestion.image_source_type === "user_upload" ? "bg-orange-100 text-orange-700" : "bg-sky-100 text-sky-700"}`}>
            {suggestion.image_source_type === "user_upload" ? "User upload" : suggestion.image_source_type === "unsplash" ? "Unsplash" : "None"}
          </span>
        </div>
        {suggestion.submitted_by_email && (
          <div className="flex items-start gap-2">
            <span className="font-semibold w-28 flex-shrink-0 text-muted-foreground">Submitted by</span>
            <span className="text-muted-foreground text-xs">{suggestion.submitted_by_email}</span>
          </div>
        )}
      </div>

      {/* Duplicate check */}
      {duplicates.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-xs font-semibold text-amber-700">Possible duplicates detected</p>
          </div>
          {duplicates.map(loc => {
            const dist = getDistance(suggestion.latitude, suggestion.longitude, loc.latitude, loc.longitude);
            return (
              <div key={loc.id} className="flex items-center justify-between text-xs text-amber-800 py-1 border-t border-amber-200 first:border-0">
                <span>{loc.name} ({loc.city}) — {Math.round(dist)}m away</span>
                <button onClick={() => setMergeId(loc.id)} className="text-blue-600 underline">Merge</button>
              </div>
            );
          })}
        </div>
      )}

      {mergeId && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
          <p className="font-semibold mb-2">Merge into selected location?</p>
          <p>This suggestion will be marked as merged and linked to the existing record.</p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" className="flex-1" variant="outline" onClick={() => setMergeId("")}>Cancel</Button>
            <Button size="sm" className="flex-1" onClick={() => act("merged", { merged_into_location_id: mergeId })}>Confirm merge</Button>
          </div>
        </div>
      )}

      {suggestion.status === "pending" && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 text-red-600 border-red-200" onClick={() => act("rejected")} disabled={acting}>
            <XCircle className="w-3.5 h-3.5" /> Reject
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditOpen(true)} disabled={acting}>
            <Edit3 className="w-3.5 h-3.5" /> Edit
          </Button>
          <Button size="sm" className="flex-1" onClick={() => act("approved")} disabled={acting}>
            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
          </Button>
        </div>
      )}

      {editOpen && (
        <EditPanel
          suggestion={suggestion}
          onClose={() => setEditOpen(false)}
          onSave={async (edits) => {
            setEditOpen(false);
            await act("approved", edits);
          }}
        />
      )}
    </div>
  );
}

export default function AdminSuggestions() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState("pending");

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["location-suggestions"],
    queryFn: () => base44.entities.LocationSuggestion.list("-created_date", 200),
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations-all"],
    queryFn: () => base44.entities.Location.list(),
  });

  const handleAction = async (id, status, extra = {}) => {
    const suggestion = suggestions.find(s => s.id === id);
    if (!suggestion) return;

    const updates = { status, ...extra };

    if (status === "approved") {
      // Create new Location record
      await base44.entities.Location.create({
        name: extra.suggested_name || suggestion.suggested_name,
        description: extra.suggested_description || suggestion.suggested_description || "",
        category: extra.category || suggestion.category,
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        city: extra.city || suggestion.city || "",
        country: extra.country || suggestion.country || "",
        image_url: suggestion.image_url || null,
        image_source: suggestion.image_source_type === "unsplash" ? "unsplash" : "manual",
        image_photographer_name: suggestion.unsplash_photographer_name || null,
        image_photographer_url: suggestion.unsplash_photographer_url || null,
        unsplash_photo_id: suggestion.unsplash_photo_id || null,
        source: "user_contribution",
        contributor_email: suggestion.submitted_by_email || null,
        status: "draft",
        has_story: false,
      });
    }

    await base44.entities.LocationSuggestion.update(id, updates);
    queryClient.invalidateQueries({ queryKey: ["location-suggestions"] });
    queryClient.invalidateQueries({ queryKey: ["locations-all"] });
    setSelected(null);
  };

  const filtered = suggestions.filter(s => statusFilter === "all" || s.status === statusFilter);

  const counts = suggestions.reduce((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc; }, {});

  if (selected) {
    return (
      <div>
        <SuggestionDetail
          suggestion={selected}
          locations={locations}
          onAction={handleAction}
          onClose={() => setSelected(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">Place Suggestions</h2>
        {counts.pending > 0 && (
          <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full">
            {counts.pending} pending
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["all", "All"]].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setStatusFilter(val)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === val ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            {label} {counts[val] > 0 && val !== "all" ? `(${counts[val]})` : ""}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No {statusFilter === "all" ? "" : statusFilter} suggestions yet
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(s => (
          <button
            key={s.id}
            onClick={() => setSelected(s)}
            className="w-full flex items-center gap-3 p-3 bg-card rounded-xl border border-border hover:border-primary/30 transition-all text-left"
          >
            {s.image_url ? (
              <img src={s.image_url} alt={s.suggested_name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-muted-foreground/40" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold truncate">{s.suggested_name}</p>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[s.status] || "bg-muted text-muted-foreground"}`}>
                  {s.status}
                </span>
              </div>
              {s.suggested_description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{s.suggested_description}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                {s.city && <span className="text-[10px] text-muted-foreground">{s.city}{s.country ? `, ${s.country}` : ""}</span>}
                {s.category && <span className="text-[10px] text-muted-foreground">· {CATEGORY_LABELS[s.category] || s.category}</span>}
                {s.image_source_type && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${s.image_source_type === "user_upload" ? "bg-orange-50 text-orange-600" : "bg-sky-50 text-sky-600"}`}>
                    {s.image_source_type === "user_upload" ? "User photo" : "Unsplash"}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}