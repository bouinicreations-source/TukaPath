import React, { useState, useRef } from "react";
import { supabase } from '@/api/supabase';
import { base44 } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Search, Upload, Download, Eye, Check, X, Edit2, Save } from "lucide-react";
import { toast } from "sonner";
import { VISA_TYPES, ENTRY_STATUSES, APPLICATION_ROUTES, EXCEPTION_TYPES, VISA_COLORS } from "@/components/visa/visaLogic";

const BLANK_FORM = {
  passport_country: "", destination_country: "", exception_type: "Residence Country",
  condition_value: "", visa_type_override: "Visa Free", processing_days_override: "",
  visa_duration_days_override: "", visa_cost_usd_override: "", entry_status_override: "Open",
  application_route_override: "", priority: "10", override_restricted: "No",
  special_notes: "", last_verified_date: "",
};

const CSV_HEADER = "passport_country,destination_country,exception_type,condition_value,visa_type_override,processing_days_override,visa_duration_days_override,visa_cost_usd_override,entry_status_override,application_route_override,priority,override_restricted,special_notes,last_verified_date";

function parseCSV(text) {
  const lines = text.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  return lines.slice(1).map(line => {
    const cols = line.split(",").map(c => c.replace(/^"|"$/g, "").trim());
    return {
      passport_country: cols[0] || "",
      destination_country: cols[1] || "",
      exception_type: cols[2] || "Residence Country",
      condition_value: cols[3] || "",
      visa_type_override: cols[4] || "Visa Free",
      processing_days_override: Number(cols[5]) || 0,
      visa_duration_days_override: Number(cols[6]) || 0,
      visa_cost_usd_override: Number(cols[7]) || 0,
      entry_status_override: cols[8] || "Open",
      application_route_override: cols[9] || "",
      priority: Number(cols[10]) || 10,
      override_restricted: cols[11] === "Yes" ? "Yes" : "No",
      special_notes: cols[12] || "",
      last_verified_date: cols[13] || "",
    };
  }).filter(r => r.passport_country && r.destination_country && r.exception_type);
}

function downloadTemplate(type) {
  const sample = type === "csv"
    ? `${CSV_HEADER}\nSyria,Georgia,Residence Country,Qatar,Visa on Arrival,0,30,0,Open,visa_on_arrival,5,No,,2024-01-01\nPakistan,Georgia,Has Valid US Visa,Yes,Visa on Arrival,0,30,0,Open,visa_on_arrival,10,No,,2024-01-01\n`
    : `${CSV_HEADER.replace(/,/g, "\t")}\nSyria\tGeorgia\tResidence Country\tQatar\tVisa on Arrival\t0\t30\t0\tOpen\tvisa_on_arrival\t5\tNo\t\t2024-01-01\n`;
  const mime = type === "csv" ? "text/csv" : "application/vnd.ms-excel";
  const ext = type === "csv" ? "csv" : "xls";
  const blob = new Blob([sample], { type: mime });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `visa_exceptions_template.${ext}`; a.click();
}

function validateRow(row) {
  if (!EXCEPTION_TYPES.includes(row.exception_type)) return `Invalid exception_type: ${row.exception_type}`;
  if (row.visa_type_override && !VISA_TYPES.includes(row.visa_type_override)) return `Invalid visa_type_override: ${row.visa_type_override}`;
  if (row.entry_status_override && !ENTRY_STATUSES.includes(row.entry_status_override)) return `Invalid entry_status_override`;
  if (row.priority !== undefined && isNaN(Number(row.priority))) return "priority must be numeric";
  if (row.override_restricted && !["Yes", "No"].includes(row.override_restricted)) return "override_restricted must be Yes or No";
  return null;
}

function findExistingException(exceptions, row) {
  return exceptions.find(e =>
    e.passport_country?.toLowerCase().trim() === row.passport_country?.toLowerCase().trim() &&
    e.destination_country?.toLowerCase().trim() === row.destination_country?.toLowerCase().trim() &&
    e.exception_type?.toLowerCase().trim() === row.exception_type?.toLowerCase().trim() &&
    e.condition_value?.toLowerCase().trim() === row.condition_value?.toLowerCase().trim()
  );
}

export default function AdminVisaExceptions() {
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [previewRows, setPreviewRows] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editRow, setEditRow] = useState(null);

  const { data: exceptions = [] } = useQuery({
    queryKey: ["visa-exceptions"],
    queryFn: () => base44.entities.VisaException.list(),
  });

  const { data: currentUser } = useQuery({
    queryKey: ["me"],
    queryFn: () => supabase.auth.getUser().then(r => r.data.user),
  });

  const logAudit = (entityId, action, oldVal, newVal) => {
    base44.entities.VisaAuditLog.create({
      entity_type: "VisaException", entity_id: entityId, action,
      changed_by: currentUser?.email || "admin",
      old_value: oldVal ? JSON.stringify(oldVal) : "",
      new_value: newVal ? JSON.stringify(newVal) : "",
    }).catch(() => {});
  };

  const filtered = exceptions.filter(e =>
    (e.passport_country || "").toLowerCase().includes(search.toLowerCase()) ||
    (e.destination_country || "").toLowerCase().includes(search.toLowerCase()) ||
    (e.exception_type || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (ev) => {
    ev.preventDefault();
    const err = validateRow(form);
    if (err) { toast.error(err); return; }
    const payload = { ...form, processing_days_override: Number(form.processing_days_override) || 0, visa_duration_days_override: Number(form.visa_duration_days_override) || 0, visa_cost_usd_override: Number(form.visa_cost_usd_override) || 0, priority: Number(form.priority) || 10 };
    const created = await base44.entities.VisaException.create(payload);
    logAudit(created.id, "create", null, payload);
    queryClient.invalidateQueries({ queryKey: ["visa-exceptions"] });
    toast.success("Exception added!");
    setForm(BLANK_FORM); setShowForm(false);
  };

  const handleDelete = async (exc) => {
    await base44.entities.VisaException.delete(exc.id);
    logAudit(exc.id, "delete", exc, null);
    queryClient.invalidateQueries({ queryKey: ["visa-exceptions"] });
    toast.success("Deleted");
  };

  const startEdit = (exc) => { setEditingId(exc.id); setEditRow({ ...exc }); };
  const cancelEdit = () => { setEditingId(null); setEditRow(null); };

  const saveEdit = async () => {
    const err = validateRow(editRow);
    if (err) { toast.error(err); return; }
    const old = exceptions.find(e => e.id === editingId);
    await base44.entities.VisaException.update(editingId, editRow);
    logAudit(editingId, "update", old, editRow);
    queryClient.invalidateQueries({ queryKey: ["visa-exceptions"] });
    toast.success("Updated");
    cancelEdit();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
      if (!rows.length) { toast.error("No valid rows found."); return; }
      const enriched = rows.map(row => {
        const existing = findExistingException(exceptions, row);
        return existing ? { ...row, _isDuplicate: true, _existingId: existing.id, _existingRecord: existing } : { ...row, _isDuplicate: false };
      });
      setPreviewRows(enriched);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSaveImport = async () => {
    if (!previewRows?.length) return;
    setSaving(true);
    let imported = 0, overwritten = 0, skipped = 0;
    for (const row of previewRows) {
      const { _isDuplicate, _existingId, _existingRecord, ...cleanRow } = row;
      const err = validateRow(cleanRow);
      if (err) { toast.error(`Row skipped: ${err}`); skipped++; continue; }
      if (_isDuplicate && _existingId) {
        await base44.entities.VisaException.update(_existingId, cleanRow);
        logAudit(_existingId, "update", _existingRecord, cleanRow);
        overwritten++;
      } else {
        const created = await base44.entities.VisaException.create(cleanRow);
        logAudit(created.id, "create", null, cleanRow);
        imported++;
      }
    }
    queryClient.invalidateQueries({ queryKey: ["visa-exceptions"] });
    const parts = [];
    if (imported) parts.push(`${imported} new`);
    if (overwritten) parts.push(`${overwritten} overwritten`);
    if (skipped) parts.push(`${skipped} skipped`);
    toast.success(parts.join(", "));
    setPreviewRows(null);
    setSaving(false);
  };

  const updatePreviewRow = (i, key, val) => setPreviewRows(rows => rows.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  const removePreviewRow = (i) => setPreviewRows(rows => rows.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-muted/30 border-dashed">
        <p className="text-xs font-semibold mb-1">📋 CSV Field Order (Visa Exceptions)</p>
        <code className="text-[10px] text-muted-foreground break-all">{CSV_HEADER}</code>
        <p className="text-[10px] text-muted-foreground mt-2">exception_type: {EXCEPTION_TYPES.join(" | ")}</p>
        <p className="text-[10px] text-muted-foreground">override_restricted: Yes | No · priority: lower = higher priority</p>
        <div className="flex gap-2 mt-3">
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => downloadTemplate("csv")}><Download className="w-3 h-3 mr-1" /> CSV Template</Button>
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => downloadTemplate("xls")}><Download className="w-3 h-3 mr-1" /> Excel Template</Button>
        </div>
      </Card>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search passport, destination or exception type..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4 mr-1" /> Import</Button>
        <input ref={fileRef} type="file" accept=".csv,.txt,.xls,.xlsx" className="hidden" onChange={handleFileChange} />
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-1" /> Add</Button>
      </div>

      {showForm && (
        <Card className="p-4">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Passport Country *</Label><Input value={form.passport_country} onChange={e => setForm({ ...form, passport_country: e.target.value })} required /></div>
              <div className="space-y-1"><Label className="text-xs">Destination Country *</Label><Input value={form.destination_country} onChange={e => setForm({ ...form, destination_country: e.target.value })} required /></div>
              <div className="space-y-1"><Label className="text-xs">Exception Type *</Label>
                <Select value={form.exception_type} onValueChange={v => setForm({ ...form, exception_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EXCEPTION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Condition Value *</Label><Input value={form.condition_value} onChange={e => setForm({ ...form, condition_value: e.target.value })} placeholder="e.g. Qatar or Yes" required /></div>
              <div className="space-y-1"><Label className="text-xs">Visa Type Override</Label>
                <Select value={form.visa_type_override} onValueChange={v => setForm({ ...form, visa_type_override: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VISA_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Entry Status Override</Label>
                <Select value={form.entry_status_override} onValueChange={v => setForm({ ...form, entry_status_override: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ENTRY_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Application Route Override</Label>
                <Select value={form.application_route_override} onValueChange={v => setForm({ ...form, application_route_override: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{APPLICATION_ROUTES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Override Restricted?</Label>
                <Select value={form.override_restricted} onValueChange={v => setForm({ ...form, override_restricted: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="No">No</SelectItem><SelectItem value="Yes">Yes</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Priority (lower = higher)</Label><Input type="number" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} placeholder="10" /></div>
              <div className="space-y-1"><Label className="text-xs">Cost Override (USD)</Label><Input type="number" value={form.visa_cost_usd_override} onChange={e => setForm({ ...form, visa_cost_usd_override: e.target.value })} placeholder="0" /></div>
              <div className="space-y-1"><Label className="text-xs">Processing Days Override</Label><Input type="number" value={form.processing_days_override} onChange={e => setForm({ ...form, processing_days_override: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Duration Days Override</Label><Input type="number" value={form.visa_duration_days_override} onChange={e => setForm({ ...form, visa_duration_days_override: e.target.value })} /></div>
            </div>
            <Input value={form.special_notes} onChange={e => setForm({ ...form, special_notes: e.target.value })} placeholder="Special notes (optional)" />
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90">Add Exception</Button>
          </form>
        </Card>
      )}

      {previewRows && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold"><Eye className="w-4 h-4 inline mr-1 text-primary" />Preview — {previewRows.length} rows</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {previewRows.filter(r => !r._isDuplicate).length} new &nbsp;·&nbsp;
                <span className="text-amber-600 font-medium">{previewRows.filter(r => r._isDuplicate).length} duplicate{previewRows.filter(r => r._isDuplicate).length !== 1 ? "s" : ""} will overwrite</span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setPreviewRows(null)}><X className="w-3 h-3 mr-1" /> Discard</Button>
              <Button size="sm" className="bg-primary text-xs" onClick={handleSaveImport} disabled={saving}><Check className="w-3 h-3 mr-1" />{saving ? "Saving..." : "Save All"}</Button>
            </div>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {previewRows.map((row, i) => (
              <div key={i} className={`rounded-lg p-3 text-xs space-y-2 ${row._isDuplicate ? "bg-amber-50 border border-amber-200" : "bg-muted/30"}`}>
                <div className="flex items-center gap-2 mb-1">
                  {row._isDuplicate
                    ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Duplicate → Will Overwrite</span>
                    : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">New</span>
                  }
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-[10px]">Passport</Label><Input value={row.passport_country} onChange={e => updatePreviewRow(i, "passport_country", e.target.value)} className="h-7 text-xs" /></div>
                  <div><Label className="text-[10px]">Destination</Label><Input value={row.destination_country} onChange={e => updatePreviewRow(i, "destination_country", e.target.value)} className="h-7 text-xs" /></div>
                  <div><Label className="text-[10px]">Exception Type</Label>
                    <Select value={row.exception_type} onValueChange={v => updatePreviewRow(i, "exception_type", v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{EXCEPTION_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-[10px]">Condition Value</Label><Input value={row.condition_value} onChange={e => updatePreviewRow(i, "condition_value", e.target.value)} className="h-7 text-xs" /></div>
                  <div><Label className="text-[10px]">Visa Override</Label>
                    <Select value={row.visa_type_override} onValueChange={v => updatePreviewRow(i, "visa_type_override", v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{VISA_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end"><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removePreviewRow(i)}><Trash2 className="w-3 h-3" /></Button></div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">{exceptions.length} exceptions total · showing {Math.min(filtered.length, 100)}</p>
      <div className="space-y-2">
        {filtered.slice(0, 100).map(exc => (
          <Card key={exc.id} className="p-3">
            {editingId === exc.id ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input value={editRow.passport_country} onChange={e => setEditRow({ ...editRow, passport_country: e.target.value })} className="h-7 text-xs" placeholder="Passport" />
                  <Input value={editRow.destination_country} onChange={e => setEditRow({ ...editRow, destination_country: e.target.value })} className="h-7 text-xs" placeholder="Destination" />
                  <Select value={editRow.exception_type} onValueChange={v => setEditRow({ ...editRow, exception_type: v })}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{EXCEPTION_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input value={editRow.condition_value} onChange={e => setEditRow({ ...editRow, condition_value: e.target.value })} className="h-7 text-xs" placeholder="Condition value" />
                  <Select value={editRow.visa_type_override} onValueChange={v => setEditRow({ ...editRow, visa_type_override: v })}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{VISA_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={editRow.override_restricted} onValueChange={v => setEditRow({ ...editRow, override_restricted: v })}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="No">Override Restricted: No</SelectItem><SelectItem value="Yes">Override Restricted: Yes</SelectItem></SelectContent>
                  </Select>
                  <Input type="number" value={editRow.priority} onChange={e => setEditRow({ ...editRow, priority: Number(e.target.value) })} className="h-7 text-xs" placeholder="Priority" />
                  <Input type="number" value={editRow.visa_cost_usd_override || ""} onChange={e => setEditRow({ ...editRow, visa_cost_usd_override: Number(e.target.value) })} className="h-7 text-xs" placeholder="Cost override" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="text-xs h-7" onClick={saveEdit}><Save className="w-3 h-3 mr-1" /> Save</Button>
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={cancelEdit}><X className="w-3 h-3 mr-1" /> Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1 text-sm font-medium flex-wrap">
                    <span>{exc.passport_country}</span><span className="text-muted-foreground">→</span><span>{exc.destination_country}</span>
                    <Badge variant="outline" className="text-[10px] py-0">{exc.exception_type}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">If {exc.condition_value}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${VISA_COLORS[exc.visa_type_override] || "bg-muted"}`}>{exc.visa_type_override}</span>
                    <span className="text-[10px] text-muted-foreground">priority: {exc.priority ?? 10}</span>
                    {exc.override_restricted === "Yes" && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">overrides restricted</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => startEdit(exc)}><Edit2 className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleDelete(exc)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            )}
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">No exceptions found</p>}
      </div>
    </div>
  );
}