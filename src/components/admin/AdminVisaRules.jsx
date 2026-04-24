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
import { VISA_TYPES, ENTRY_STATUSES, APPLICATION_ROUTES, VISA_COLORS } from "@/components/visa/visaLogic";

const BLANK_FORM = {
  passport_country: "", destination_country: "", visa_type: "Visa Free",
  processing_days: "", visa_duration_days: "", visa_cost_usd: "",
  entry_status: "Open", application_route: "", special_notes: "", last_verified_date: "",
};

const CSV_HEADER = "passport_country,destination_country,visa_type,processing_days,visa_duration_days,visa_cost_usd,entry_status,application_route,special_notes,last_verified_date";

function parseCSV(text) {
  const lines = text.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  return lines.slice(1).map(line => {
    const cols = line.split(",").map(c => c.replace(/^"|"$/g, "").trim());
    return {
      passport_country: cols[0] || "",
      destination_country: cols[1] || "",
      visa_type: cols[2] || "Visa Required",
      processing_days: Number(cols[3]) || 0,
      visa_duration_days: Number(cols[4]) || 0,
      visa_cost_usd: Number(cols[5]) || 0,
      entry_status: cols[6] || "Open",
      application_route: cols[7] || "",
      special_notes: cols[8] || "",
      last_verified_date: cols[9] || "",
    };
  }).filter(r => r.passport_country && r.destination_country);
}

function downloadTemplate(type) {
  const sample = type === "csv"
    ? `${CSV_HEADER}\nNetherlands,Thailand,Visa Free,0,30,0,Open,visa_on_arrival,,2024-01-01\nSyria,Germany,Visa Required,30,90,80,Open,embassy_only,,2024-01-01\n`
    : `${CSV_HEADER.replace(/,/g, "\t")}\nNetherlands\tThailand\tVisa Free\t0\t30\t0\tOpen\tvisa_on_arrival\t\t2024-01-01\n`;
  const mime = type === "csv" ? "text/csv" : "application/vnd.ms-excel";
  const ext = type === "csv" ? "csv" : "xls";
  const blob = new Blob([sample], { type: mime });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `visa_base_rules_template.${ext}`; a.click();
}

export default function AdminVisaRules() {
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [previewRows, setPreviewRows] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editRow, setEditRow] = useState(null);

  const { data: rules = [] } = useQuery({
    queryKey: ["visa-base-rules"],
    queryFn: () => base44.entities.VisaBaseRule.list(),
  });

  const { data: currentUser } = useQuery({
    queryKey: ["me"],
    queryFn: () => supabase.auth.getUser().then(r => r.data.user),
  });

  const logAudit = (entityId, action, oldVal, newVal) => {
    base44.entities.VisaAuditLog.create({
      entity_type: "VisaBaseRule", entity_id: entityId, action,
      changed_by: currentUser?.email || "admin",
      old_value: oldVal ? JSON.stringify(oldVal) : "",
      new_value: newVal ? JSON.stringify(newVal) : "",
    }).catch(() => {});
  };

  const filtered = rules.filter(r =>
    (r.passport_country || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.destination_country || "").toLowerCase().includes(search.toLowerCase())
  );

  const validateRow = (row) => {
    if (!VISA_TYPES.includes(row.visa_type)) return `Invalid visa_type: ${row.visa_type}`;
    if (row.entry_status && !ENTRY_STATUSES.includes(row.entry_status)) return `Invalid entry_status: ${row.entry_status}`;
    if (row.application_route && !APPLICATION_ROUTES.includes(row.application_route)) return `Invalid application_route: ${row.application_route}`;
    return null;
  };

  const checkDuplicate = (passport, destination, excludeId = null) => {
    return rules.some(r => r.id !== excludeId &&
      r.passport_country?.toLowerCase().trim() === passport?.toLowerCase().trim() &&
      r.destination_country?.toLowerCase().trim() === destination?.toLowerCase().trim()
    );
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const err = validateRow(form);
    if (err) { toast.error(err); return; }
    if (checkDuplicate(form.passport_country, form.destination_country)) {
      toast.error("A rule for this passport + destination already exists."); return;
    }
    const payload = { ...form, processing_days: Number(form.processing_days) || 0, visa_duration_days: Number(form.visa_duration_days) || 0, visa_cost_usd: Number(form.visa_cost_usd) || 0 };
    const created = await base44.entities.VisaBaseRule.create(payload);
    logAudit(created.id, "create", null, payload);
    queryClient.invalidateQueries({ queryKey: ["visa-base-rules"] });
    toast.success("Base rule added!");
    setForm(BLANK_FORM);
    setShowForm(false);
  };

  const handleDelete = async (rule) => {
    await base44.entities.VisaBaseRule.delete(rule.id);
    logAudit(rule.id, "delete", rule, null);
    queryClient.invalidateQueries({ queryKey: ["visa-base-rules"] });
    toast.success("Deleted");
  };

  const startEdit = (rule) => { setEditingId(rule.id); setEditRow({ ...rule }); };
  const cancelEdit = () => { setEditingId(null); setEditRow(null); };

  const saveEdit = async () => {
    const err = validateRow(editRow);
    if (err) { toast.error(err); return; }
    if (checkDuplicate(editRow.passport_country, editRow.destination_country, editRow.id)) {
      toast.error("A rule for this passport + destination already exists."); return;
    }
    const old = rules.find(r => r.id === editingId);
    await base44.entities.VisaBaseRule.update(editingId, editRow);
    logAudit(editingId, "update", old, editRow);
    queryClient.invalidateQueries({ queryKey: ["visa-base-rules"] });
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
        const existing = rules.find(r =>
          r.passport_country?.toLowerCase().trim() === row.passport_country?.toLowerCase().trim() &&
          r.destination_country?.toLowerCase().trim() === row.destination_country?.toLowerCase().trim()
        );
        return existing ? { ...row, _isDuplicate: true, _existingId: existing.id, _existingRecord: existing } : { ...row, _isDuplicate: false };
      });
      setPreviewRows(enriched);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const handleSaveImport = async () => {
    if (!previewRows?.length) return;
    setSaving(true);
    let imported = 0, overwritten = 0, skipped = 0;

    const toCreate = [];
    const toUpdate = [];

    for (const row of previewRows) {
      const { _isDuplicate, _existingId, _existingRecord, ...cleanRow } = row;
      const err = validateRow(cleanRow);
      if (err) { skipped++; continue; }
      if (_isDuplicate && _existingId) {
        toUpdate.push({ id: _existingId, data: cleanRow, old: _existingRecord });
      } else {
        toCreate.push(cleanRow);
      }
    }

    // Bulk create new records
    if (toCreate.length) {
      const CHUNK = 20;
      for (let i = 0; i < toCreate.length; i += CHUNK) {
        const chunk = toCreate.slice(i, i + CHUNK);
        const created = await base44.entities.VisaBaseRule.bulkCreate(chunk);
        created.forEach((c, idx) => logAudit(c.id, "create", null, chunk[idx]));
        imported += chunk.length;
        if (i + CHUNK < toCreate.length) await sleep(600);
      }
    }

    // Sequential updates with delay
    for (let i = 0; i < toUpdate.length; i++) {
      const { id, data, old } = toUpdate[i];
      await base44.entities.VisaBaseRule.update(id, data);
      logAudit(id, "update", old, data);
      overwritten++;
      if (i < toUpdate.length - 1) await sleep(500);
    }

    queryClient.invalidateQueries({ queryKey: ["visa-base-rules"] });
    const parts = [];
    if (imported) parts.push(`${imported} new`);
    if (overwritten) parts.push(`${overwritten} overwritten`);
    if (skipped) parts.push(`${skipped} skipped`);
    toast.success(parts.join(", ") || "Done");
    setPreviewRows(null);
    setSaving(false);
  };

  const updatePreviewRow = (i, key, val) => setPreviewRows(rows => rows.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  const removePreviewRow = (i) => setPreviewRows(rows => rows.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-muted/30 border-dashed">
        <p className="text-xs font-semibold mb-1">📋 CSV Field Order (Base Rules)</p>
        <code className="text-[10px] text-muted-foreground break-all">{CSV_HEADER}</code>
        <div className="flex gap-2 mt-3">
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => downloadTemplate("csv")}><Download className="w-3 h-3 mr-1" /> CSV Template</Button>
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => downloadTemplate("xls")}><Download className="w-3 h-3 mr-1" /> Excel Template</Button>
        </div>
      </Card>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search passport or destination..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4 mr-1" /> Import</Button>
        <input ref={fileRef} type="file" accept=".csv,.txt,.xls,.xlsx" className="hidden" onChange={handleFileChange} />
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-1" /> Add</Button>
      </div>

      {showForm && (
        <Card className="p-4">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Passport Country *</Label>
                <Input value={form.passport_country} onChange={e => setForm({ ...form, passport_country: e.target.value })} placeholder="Netherlands" required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Destination Country *</Label>
                <Input value={form.destination_country} onChange={e => setForm({ ...form, destination_country: e.target.value })} placeholder="Thailand" required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Visa Type *</Label>
                <Select value={form.visa_type} onValueChange={v => setForm({ ...form, visa_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VISA_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Entry Status</Label>
                <Select value={form.entry_status} onValueChange={v => setForm({ ...form, entry_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ENTRY_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Application Route</Label>
                <Select value={form.application_route} onValueChange={v => setForm({ ...form, application_route: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{APPLICATION_ROUTES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cost (USD)</Label>
                <Input type="number" value={form.visa_cost_usd} onChange={e => setForm({ ...form, visa_cost_usd: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Processing Days</Label>
                <Input type="number" value={form.processing_days} onChange={e => setForm({ ...form, processing_days: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Visa Duration Days</Label>
                <Input type="number" value={form.visa_duration_days} onChange={e => setForm({ ...form, visa_duration_days: e.target.value })} placeholder="30" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Last Verified</Label>
                <Input type="date" value={form.last_verified_date} onChange={e => setForm({ ...form, last_verified_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Special Notes (optional)</Label>
                <Input value={form.special_notes} onChange={e => setForm({ ...form, special_notes: e.target.value })} placeholder="Edge case only" />
              </div>
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90">Add Base Rule</Button>
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
                <div className="grid grid-cols-3 gap-2">
                  <div><Label className="text-[10px]">Passport</Label><Input value={row.passport_country} onChange={e => updatePreviewRow(i, "passport_country", e.target.value)} className="h-7 text-xs" /></div>
                  <div><Label className="text-[10px]">Destination</Label><Input value={row.destination_country} onChange={e => updatePreviewRow(i, "destination_country", e.target.value)} className="h-7 text-xs" /></div>
                  <div><Label className="text-[10px]">Visa Type</Label>
                    <Select value={row.visa_type} onValueChange={v => updatePreviewRow(i, "visa_type", v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{VISA_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div><Label className="text-[10px]">Status</Label>
                    <Select value={row.entry_status} onValueChange={v => updatePreviewRow(i, "entry_status", v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{ENTRY_STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-[10px]">Cost $</Label><Input type="number" value={row.visa_cost_usd} onChange={e => updatePreviewRow(i, "visa_cost_usd", Number(e.target.value))} className="h-7 text-xs" /></div>
                  <div><Label className="text-[10px]">Process Days</Label><Input type="number" value={row.processing_days} onChange={e => updatePreviewRow(i, "processing_days", Number(e.target.value))} className="h-7 text-xs" /></div>
                  <div className="flex items-end"><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removePreviewRow(i)}><Trash2 className="w-3 h-3" /></Button></div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">{rules.length} rules total · showing {Math.min(filtered.length, 100)}</p>
      <div className="space-y-2">
        {filtered.slice(0, 100).map(rule => (
          <Card key={rule.id} className="p-3">
            {editingId === rule.id ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input value={editRow.passport_country} onChange={e => setEditRow({ ...editRow, passport_country: e.target.value })} className="h-7 text-xs" placeholder="Passport" />
                  <Input value={editRow.destination_country} onChange={e => setEditRow({ ...editRow, destination_country: e.target.value })} className="h-7 text-xs" placeholder="Destination" />
                  <Select value={editRow.visa_type} onValueChange={v => setEditRow({ ...editRow, visa_type: v })}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{VISA_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={editRow.entry_status} onValueChange={v => setEditRow({ ...editRow, entry_status: v })}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{ENTRY_STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={editRow.application_route} onValueChange={v => setEditRow({ ...editRow, application_route: v })}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{APPLICATION_ROUTES.map(r => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" value={editRow.visa_cost_usd} onChange={e => setEditRow({ ...editRow, visa_cost_usd: Number(e.target.value) })} className="h-7 text-xs" placeholder="Cost USD" />
                  <Input type="number" value={editRow.processing_days} onChange={e => setEditRow({ ...editRow, processing_days: Number(e.target.value) })} className="h-7 text-xs" placeholder="Processing days" />
                  <Input type="number" value={editRow.visa_duration_days} onChange={e => setEditRow({ ...editRow, visa_duration_days: Number(e.target.value) })} className="h-7 text-xs" placeholder="Duration days" />
                </div>
                <Input value={editRow.special_notes || ""} onChange={e => setEditRow({ ...editRow, special_notes: e.target.value })} className="h-7 text-xs" placeholder="Special notes (optional)" />
                <div className="flex gap-2">
                  <Button size="sm" className="text-xs h-7" onClick={saveEdit}><Save className="w-3 h-3 mr-1" /> Save</Button>
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={cancelEdit}><X className="w-3 h-3 mr-1" /> Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium flex-wrap">
                    <span>{rule.passport_country}</span>
                    <span className="text-muted-foreground">→</span>
                    <span>{rule.destination_country}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${VISA_COLORS[rule.visa_type] || "bg-muted"}`}>{rule.visa_type}</span>
                    {rule.entry_status && <Badge variant="outline" className="text-[10px] py-0">{rule.entry_status}</Badge>}
                    {rule.visa_cost_usd > 0 && <span className="text-[10px] text-muted-foreground">${rule.visa_cost_usd}</span>}
                    {rule.processing_days > 0 && <span className="text-[10px] text-muted-foreground">{rule.processing_days}d</span>}
                    {rule.visa_duration_days > 0 && <span className="text-[10px] text-muted-foreground">{rule.visa_duration_days}d stay</span>}
                  </div>
                  {rule.application_route && <p className="text-[10px] text-muted-foreground mt-0.5">{rule.application_route}</p>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => startEdit(rule)}><Edit2 className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleDelete(rule)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            )}
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">No base rules found</p>}
      </div>
    </div>
  );
}