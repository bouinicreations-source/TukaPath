import React, { useState, useRef } from "react";
import { base44 } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Search, Upload, Download, Eye, Check, X, Edit2, Save } from "lucide-react";
import { toast } from "sonner";
import { VISA_TYPES, ENTRY_STATUSES, APPLICATION_ROUTES, VISA_COLORS } from "@/lib/visaLogic";

const CSV_HEADER = "passport_country,destination_country,visa_type,processing_days,visa_duration_days,visa_cost_usd,entry_status,application_route,special_notes,last_verified_date";

const BLANK_FORM = {
  passport_country: "", destination_country: "", visa_type: "Visa Free",
  processing_days: "", visa_duration_days: "", visa_cost_usd: "0",
  entry_status: "Open", application_route: "visa_on_arrival",
  special_notes: "", last_verified_date: "",
};

function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  return lines.slice(1).map(line => {
    const cols = line.split(",").map(c => c.replace(/^"|"$/g, "").trim());
    return {
      passport_country: cols[0] || "",
      destination_country: cols[1] || "",
      visa_type: cols[2] || "Visa Required",
      processing_days: cols[3] ? Number(cols[3]) : null,
      visa_duration_days: cols[4] ? Number(cols[4]) : null,
      visa_cost_usd: Number(cols[5]) || 0,
      entry_status: cols[6] || "Open",
      application_route: cols[7] || "",
      special_notes: cols[8] || "",
      last_verified_date: cols[9] || "",
    };
  }).filter(r => r.passport_country && r.destination_country);
}

function downloadCSVTemplate() {
  const sample = `${CSV_HEADER}\nNetherlands,Thailand,Visa Free,,,0,Open,visa_on_arrival,,2024-01-01\nSyria,Georgia,Visa Required,30,,50,Open,embassy_only,,2024-01-01\n`;
  const blob = new Blob([sample], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = "visa_base_rules_template.csv"; a.click();
}

function downloadExcelTemplate() {
  const sample = `${CSV_HEADER.replace(/,/g, "\t")}\nNetherlands\tThailand\tVisa Free\t\t\t0\tOpen\tvisa_on_arrival\t\t2024-01-01\n`;
  const blob = new Blob([sample], { type: "application/vnd.ms-excel" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = "visa_base_rules_template.xls"; a.click();
}

export default function AdminVisaBaseRules() {
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [previewRows, setPreviewRows] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const { data: rules = [] } = useQuery({
    queryKey: ["visa-base-rules"],
    queryFn: () => base44.entities.VisaBaseRule.list(),
  });

  const filtered = rules.filter(r =>
    norm(r.passport_country).includes(norm(search)) ||
    norm(r.destination_country).includes(norm(search))
  );

  function norm(s) { return (s || "").toLowerCase(); }

  const validate = (row, existingRules, excludeId = null) => {
    if (!VISA_TYPES.includes(row.visa_type)) return `Invalid visa_type: ${row.visa_type}`;
    if (!ENTRY_STATUSES.includes(row.entry_status)) return `Invalid entry_status: ${row.entry_status}`;
    if (row.application_route && !APPLICATION_ROUTES.includes(row.application_route)) return `Invalid application_route: ${row.application_route}`;
    const dup = existingRules.find(r =>
      r.id !== excludeId &&
      norm(r.passport_country) === norm(row.passport_country) &&
      norm(r.destination_country) === norm(row.destination_country)
    );
    if (dup) return `Duplicate rule: ${row.passport_country} → ${row.destination_country}`;
    return null;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const err = validate(form, rules);
    if (err) { toast.error(err); return; }
    await base44.entities.VisaBaseRule.create({
      ...form,
      processing_days: form.processing_days ? Number(form.processing_days) : null,
      visa_duration_days: form.visa_duration_days ? Number(form.visa_duration_days) : null,
      visa_cost_usd: Number(form.visa_cost_usd) || 0,
    });
    queryClient.invalidateQueries({ queryKey: ["visa-base-rules"] });
    toast.success("Base rule added");
    setForm(BLANK_FORM);
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.VisaBaseRule.delete(id);
    queryClient.invalidateQueries({ queryKey: ["visa-base-rules"] });
    toast.success("Deleted");
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setEditForm({ ...r });
  };

  const saveEdit = async () => {
    const err = validate(editForm, rules, editingId);
    if (err) { toast.error(err); return; }
    await base44.entities.VisaBaseRule.update(editingId, {
      ...editForm,
      processing_days: editForm.processing_days ? Number(editForm.processing_days) : null,
      visa_duration_days: editForm.visa_duration_days ? Number(editForm.visa_duration_days) : null,
      visa_cost_usd: Number(editForm.visa_cost_usd) || 0,
    });
    queryClient.invalidateQueries({ queryKey: ["visa-base-rules"] });
    toast.success("Updated");
    setEditingId(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
      if (rows.length === 0) { toast.error("No valid rows found."); return; }
      setPreviewRows(rows);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSaveImport = async () => {
    if (!previewRows?.length) return;
    setSaving(true);
    const errors = [];
    const valid = previewRows.filter((r, i) => {
      const err = validate(r, rules);
      if (err) { errors.push(`Row ${i + 1}: ${err}`); return false; }
      return true;
    });
    if (errors.length > 0) toast.warning(`${errors.length} rows skipped: ${errors.slice(0, 2).join("; ")}`);
    if (valid.length > 0) {
      await base44.entities.VisaBaseRule.bulkCreate(valid);
      queryClient.invalidateQueries({ queryKey: ["visa-base-rules"] });
      toast.success(`${valid.length} rules imported`);
    }
    setPreviewRows(null);
    setSaving(false);
  };

  const updatePreviewRow = (i, key, val) => setPreviewRows(rows => rows.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  const removePreviewRow = (i) => setPreviewRows(rows => rows.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-muted/30 border-dashed">
        <p className="text-xs font-semibold mb-1">📋 CSV Column Order</p>
        <code className="text-[10px] text-muted-foreground break-all">{CSV_HEADER}</code>
        <div className="flex gap-2 mt-3">
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={downloadCSVTemplate}>
            <Download className="w-3 h-3 mr-1" /> CSV Template
          </Button>
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={downloadExcelTemplate}>
            <Download className="w-3 h-3 mr-1" /> Excel Template
          </Button>
        </div>
      </Card>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search passport or destination..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="w-4 h-4 mr-1" /> Import
        </Button>
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      {showForm && (
        <Card className="p-4">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Passport Country *</Label>
                <Input placeholder="Netherlands" value={form.passport_country} onChange={e => setForm({...form, passport_country: e.target.value})} required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Destination Country *</Label>
                <Input placeholder="Thailand" value={form.destination_country} onChange={e => setForm({...form, destination_country: e.target.value})} required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Visa Type *</Label>
                <Select value={form.visa_type} onValueChange={v => setForm({...form, visa_type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VISA_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Entry Status *</Label>
                <Select value={form.entry_status} onValueChange={v => setForm({...form, entry_status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ENTRY_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Application Route</Label>
                <Select value={form.application_route} onValueChange={v => setForm({...form, application_route: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{APPLICATION_ROUTES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Visa Cost (USD)</Label>
                <Input type="number" placeholder="0" value={form.visa_cost_usd} onChange={e => setForm({...form, visa_cost_usd: e.target.value})} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Processing Days</Label>
                <Input type="number" placeholder="—" value={form.processing_days} onChange={e => setForm({...form, processing_days: e.target.value})} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Visa Duration (days)</Label>
                <Input type="number" placeholder="—" value={form.visa_duration_days} onChange={e => setForm({...form, visa_duration_days: e.target.value})} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Special Notes <span className="text-muted-foreground">(optional, rare edge cases only)</span></Label>
              <Input value={form.special_notes} onChange={e => setForm({...form, special_notes: e.target.value})} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Last Verified Date</Label>
              <Input type="date" value={form.last_verified_date} onChange={e => setForm({...form, last_verified_date: e.target.value})} />
            </div>
            <Button type="submit" className="w-full">Add Base Rule</Button>
          </form>
        </Card>
      )}

      {previewRows && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold"><Eye className="w-4 h-4 inline mr-1" />Preview — {previewRows.length} rows</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setPreviewRows(null)}><X className="w-3 h-3 mr-1" />Discard</Button>
              <Button size="sm" className="text-xs" onClick={handleSaveImport} disabled={saving}><Check className="w-3 h-3 mr-1" />{saving ? "Saving..." : "Save All"}</Button>
            </div>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {previewRows.map((row, i) => (
              <div key={i} className="bg-muted/30 rounded-lg p-3 text-xs">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div><Label className="text-[10px]">Passport</Label><Input value={row.passport_country} onChange={e => updatePreviewRow(i, "passport_country", e.target.value)} className="h-7 text-xs" /></div>
                  <div><Label className="text-[10px]">Destination</Label><Input value={row.destination_country} onChange={e => updatePreviewRow(i, "destination_country", e.target.value)} className="h-7 text-xs" /></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label className="text-[10px]">Visa Type</Label>
                    <Select value={row.visa_type} onValueChange={v => updatePreviewRow(i, "visa_type", v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{VISA_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-[10px]">Entry Status</Label>
                    <Select value={row.entry_status} onValueChange={v => updatePreviewRow(i, "entry_status", v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{ENTRY_STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end"><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removePreviewRow(i)}><Trash2 className="w-3 h-3" /></Button></div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">{rules.length} rules total — showing {filtered.slice(0, 100).length}</p>
      <div className="space-y-2">
        {filtered.slice(0, 100).map(r => (
          <Card key={r.id} className="p-3">
            {editingId === r.id ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-[10px]">Passport</Label><Input value={editForm.passport_country} onChange={e => setEditForm({...editForm, passport_country: e.target.value})} className="h-7 text-xs" /></div>
                  <div><Label className="text-[10px]">Destination</Label><Input value={editForm.destination_country} onChange={e => setEditForm({...editForm, destination_country: e.target.value})} className="h-7 text-xs" /></div>
                  <div><Label className="text-[10px]">Visa Type</Label>
                    <Select value={editForm.visa_type} onValueChange={v => setEditForm({...editForm, visa_type: v})}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{VISA_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-[10px]">Entry Status</Label>
                    <Select value={editForm.entry_status} onValueChange={v => setEditForm({...editForm, entry_status: v})}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{ENTRY_STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-[10px]">Route</Label>
                    <Select value={editForm.application_route || ""} onValueChange={v => setEditForm({...editForm, application_route: v})}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{APPLICATION_ROUTES.map(r2 => <SelectItem key={r2} value={r2} className="text-xs">{r2}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-[10px]">Cost (USD)</Label><Input type="number" value={editForm.visa_cost_usd || ""} onChange={e => setEditForm({...editForm, visa_cost_usd: e.target.value})} className="h-7 text-xs" /></div>
                  <div><Label className="text-[10px]">Processing Days</Label><Input type="number" value={editForm.processing_days || ""} onChange={e => setEditForm({...editForm, processing_days: e.target.value})} className="h-7 text-xs" /></div>
                  <div><Label className="text-[10px]">Duration Days</Label><Input type="number" value={editForm.visa_duration_days || ""} onChange={e => setEditForm({...editForm, visa_duration_days: e.target.value})} className="h-7 text-xs" /></div>
                </div>
                <div><Label className="text-[10px]">Special Notes</Label><Input value={editForm.special_notes || ""} onChange={e => setEditForm({...editForm, special_notes: e.target.value})} className="h-7 text-xs" /></div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setEditingId(null)}>Cancel</Button>
                  <Button size="sm" className="text-xs h-7" onClick={saveEdit}><Save className="w-3 h-3 mr-1" />Save</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1 text-sm font-medium flex-wrap">
                    <span>{r.passport_country}</span>
                    <span className="text-muted-foreground">→</span>
                    <span>{r.destination_country}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${VISA_COLORS[r.visa_type] || "bg-muted"}`}>{r.visa_type}</span>
                    <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full">{r.entry_status}</span>
                    {r.visa_cost_usd > 0 && <span className="text-[10px] text-muted-foreground">${r.visa_cost_usd}</span>}
                    {r.processing_days && <span className="text-[10px] text-muted-foreground">{r.processing_days}d processing</span>}
                    {r.visa_duration_days && <span className="text-[10px] text-muted-foreground">{r.visa_duration_days}d stay</span>}
                  </div>
                  {r.application_route && <p className="text-[10px] text-muted-foreground mt-0.5">{r.application_route}</p>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => startEdit(r)}><Edit2 className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleDelete(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            )}
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">No visa base rules found</p>}
      </div>
    </div>
  );
}