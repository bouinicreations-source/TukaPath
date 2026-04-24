import React, { useState } from "react";
import { base44 } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Eye, CheckCircle, Edit, X, Check, AlertCircle, Download } from "lucide-react";
import { toast } from "sonner";

function ApproveModal({ log, existingLocations, onClose, onApproved }) {
  const [form, setForm] = useState({
    name: log.city,
    city: log.city,
    country: log.country,
    description: log.description || "",
    latitude: 0,
    longitude: 0,
    nearest_airport_name: log.nearest_airport_name || "",
    nearest_airport_iata: log.nearest_airport_iata || "",
    has_story: false,
    status: "active",
  });
  const [saving, setSaving] = useState(false);

  const alreadyExists = existingLocations.some(
    l => l.city?.toLowerCase() === log.city?.toLowerCase() && l.country?.toLowerCase() === log.country?.toLowerCase()
  );

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.Location.create({ ...form, source: "official" });
    await base44.entities.DiscoveryLog.update(log.id, { approved: true });
    toast.success(`${form.city} added to Locations!`);
    onApproved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg my-8">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-bold text-base">Approve → Add to Locations</h3>
            <p className="text-xs text-muted-foreground">Edit before saving to curated Locations</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="p-5 space-y-3">
          {alreadyExists && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>A location for <strong>{log.city}, {log.country}</strong> already exists in Locations. Approving will create an additional entry.</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Place Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">City *</Label>
              <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Country *</Label>
              <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Image URL</Label>
              <Input value={form.image_url || ""} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} className="h-8 text-sm" placeholder="https://..." />
            </div>
            <div>
              <Label className="text-xs">Latitude</Label>
              <Input type="number" step="any" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: parseFloat(e.target.value) || 0 }))} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Longitude</Label>
              <Input type="number" step="any" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: parseFloat(e.target.value) || 0 }))} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Nearest Airport Name</Label>
              <Input value={form.nearest_airport_name} onChange={e => setForm(f => ({ ...f, nearest_airport_name: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Nearest Airport IATA</Label>
              <Input value={form.nearest_airport_iata} onChange={e => setForm(f => ({ ...f, nearest_airport_iata: e.target.value }))} className="h-8 text-sm" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="text-sm h-20" />
          </div>

          <p className="text-[10px] text-muted-foreground">Required: Name, City, Country, Latitude, Longitude to make a valid Location record.</p>
        </div>

        <div className="flex gap-2 p-5 border-t border-border">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleSave} disabled={saving}>
            <Check className="w-4 h-4 mr-1.5" /> {saving ? "Saving..." : "Confirm & Add to Locations"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ViewModal({ log, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md my-8">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-bold">{log.city}, {log.country}</h3>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <div className="p-5 space-y-4">
          {log.description && <p className="text-sm leading-relaxed text-muted-foreground">{log.description}</p>}

          <div className="bg-muted/40 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold mb-2">Cost Breakdown</p>
            {[
              ["✈️ Flights", log.flight_cost],
              ["🏨 Hotels", log.hotel_cost],
              ["🍽️ Food", log.food_cost],
              ["🚌 Transport", log.transport_cost],
              ["🎟️ Activities", log.activities_cost],
              ["📄 Visa", log.visa_cost],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">${(val || 0).toLocaleString()}</span>
              </div>
            ))}
            <div className="border-t border-border pt-2 flex justify-between font-bold text-sm">
              <span>Total</span>
              <span className="text-primary">${(log.total_estimated_cost || 0).toLocaleString()}</span>
            </div>
          </div>

          {log.visa_status && (
            <div className="text-sm">
              <span className="font-medium">Visa: </span>{log.visa_status}
              {log.visa_notes && <p className="text-xs text-muted-foreground mt-1">{log.visa_notes}</p>}
            </div>
          )}

          {log.nearest_airport_iata && (
            <div className="text-sm flex items-center gap-2">
              <span className="bg-primary/10 text-primary font-bold text-xs px-1.5 py-0.5 rounded">{log.nearest_airport_iata}</span>
              <span className="text-muted-foreground">{log.nearest_airport_name}</span>
            </div>
          )}

          <div className="text-xs text-muted-foreground space-y-1 border-t border-border pt-3">
            {log.passport_country && <p>Passport: <span className="text-foreground">{log.passport_country}</span></p>}
            {log.residence_country && <p>Residence: <span className="text-foreground">{log.residence_country}</span></p>}
            <p>Generated: {new Date(log.created_date).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminDiscoveryLogs() {
  const queryClient = useQueryClient();
  const [cityFilter, setCityFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [viewLog, setViewLog] = useState(null);
  const [approveLog, setApproveLog] = useState(null);

  const { data: logs = [] } = useQuery({
    queryKey: ["discovery-logs"],
    queryFn: () => base44.entities.DiscoveryLog.list("-created_date", 200),
  });

  const { data: existingLocations = [] } = useQuery({
    queryKey: ["locations-all"],
    queryFn: () => base44.entities.Location.list(),
  });

  const handleDelete = async (log) => {
    if (!window.confirm(`Delete discovery log for ${log.city}?`)) return;
    await base44.entities.DiscoveryLog.delete(log.id);
    queryClient.invalidateQueries({ queryKey: ["discovery-logs"] });
    toast.success("Deleted");
  };

  const filtered = logs.filter(l => {
    if (cityFilter && !l.city?.toLowerCase().includes(cityFilter.toLowerCase())) return false;
    if (countryFilter && !l.country?.toLowerCase().includes(countryFilter.toLowerCase())) return false;
    if (dateFilter && !l.created_date?.startsWith(dateFilter)) return false;
    return true;
  });

  const unapproved = filtered.filter(l => !l.approved);
  const approved = filtered.filter(l => l.approved);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold">Discovery Logs</h2>
          <p className="text-xs text-muted-foreground">Auto-logged from "I Already Know" flow · {unapproved.length} pending approval</p>
        </div>
        <Button size="sm" variant="outline" className="text-xs shrink-0" onClick={() => {
          const fields = ["city","country","description","flight_cost","hotel_cost","food_cost","transport_cost","activities_cost","visa_cost","total_estimated_cost","visa_status","visa_notes","nearest_airport_name","nearest_airport_iata","passport_country","residence_country","approved"];
          const header = fields.join(",");
          const lines = logs.map(r => fields.map(f => `"${String(r[f] ?? "").replace(/"/g, '""')}"`).join(","));
          const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
          const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "discovery_logs_export.csv"; a.click();
        }}>
          <Download className="w-3 h-3 mr-1" /> Download Data
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-[10px]">City</Label>
          <Input value={cityFilter} onChange={e => setCityFilter(e.target.value)} placeholder="Filter by city" className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[10px]">Country</Label>
          <Input value={countryFilter} onChange={e => setCountryFilter(e.target.value)} placeholder="Filter by country" className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[10px]">Date (YYYY-MM-DD)</Label>
          <Input value={dateFilter} onChange={e => setDateFilter(e.target.value)} placeholder="2025-01-01" className="h-8 text-xs" />
        </div>
      </div>

      {/* Unapproved section */}
      {unapproved.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> Pending Approval ({unapproved.length})
          </p>
          <div className="space-y-2">
            {unapproved.map(log => (
              <Card key={log.id} className="p-3 border-amber-200 bg-amber-50/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{log.city}, {log.country}</p>
                      <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">Pending</Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1">
                      <p className="text-[10px] text-muted-foreground">Total: <span className="font-medium text-foreground">${(log.total_estimated_cost || 0).toLocaleString()}</span></p>
                      {log.passport_country && <p className="text-[10px] text-muted-foreground">Passport: {log.passport_country}</p>}
                      {log.nearest_airport_iata && <p className="text-[10px] text-muted-foreground">Airport: {log.nearest_airport_iata}</p>}
                      <p className="text-[10px] text-muted-foreground">{new Date(log.created_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewLog(log)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" onClick={() => setApproveLog(log)}>
                      <CheckCircle className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(log)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Approved section */}
      {approved.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Approved ({approved.length})</p>
          <div className="space-y-2">
            {approved.map(log => (
              <Card key={log.id} className="p-3 opacity-70">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{log.city}, {log.country}</p>
                      <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200">✓ Approved</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(log.created_date).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewLog(log)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(log)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-2xl mb-2">📋</p>
          <p className="text-sm font-medium">No discovery logs yet</p>
          <p className="text-xs mt-1">Logs are created automatically when users explore destinations</p>
        </div>
      )}

      {viewLog && <ViewModal log={viewLog} onClose={() => setViewLog(null)} />}
      {approveLog && (
        <ApproveModal
          log={approveLog}
          existingLocations={existingLocations}
          onClose={() => setApproveLog(null)}
          onApproved={() => {
            setApproveLog(null);
            queryClient.invalidateQueries({ queryKey: ["discovery-logs"] });
            queryClient.invalidateQueries({ queryKey: ["locations-all"] });
          }}
        />
      )}
    </div>
  );
}