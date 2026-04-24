import React, { useState, useRef } from "react";
import { base44 } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Search, Upload, Download, Eye, Check, X, Edit2 } from "lucide-react";
import { toast } from "sonner";

const VISA_TYPES = ["Visa Free", "Visa on Arrival", "eVisa", "Visa Required", "ETA"];
const VISA_COLORS = {
  "Visa Free": "bg-green-100 text-green-800",
  "Visa on Arrival": "bg-blue-100 text-blue-800",
  "eVisa": "bg-purple-100 text-purple-800",
  "Visa Required": "bg-red-100 text-red-800",
  "ETA": "bg-yellow-100 text-yellow-800",
};

const CSV_FIELDS = ["passport_country", "residence_country", "destination_country", "visa_type", "visa_cost", "processing_days", "has_valid_us_visa_benefit", "has_valid_uk_visa_benefit", "has_valid_schengen_visa_benefit", "notes", "last_verified_date"];
const CSV_HEADER = "Passport Country,Residence Country,Destination Country,Visa Type,Visa Cost (USD),Processing Days,Has Valid US Visa Benefit,Has Valid UK Visa Benefit,Has Valid Schengen Visa Benefit,Notes,Last Verified Date";

function parseBool(v) { return v?.toLowerCase() === "yes" || v?.toLowerCase() === "true"; }

function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  return lines.slice(1).map(line => {
    const cols = line.split(",").map(c => c.replace(/^"|"$/g, "").trim());
    return {
      passport_country: cols[0] || "",
      residence_country: cols[1] || "",
      destination_country: cols[2] || "",
      visa_type: cols[3] || "Visa Required",
      visa_cost: Number(cols[4]) || 0,
      processing_days: Number(cols[5]) || 0,
      has_valid_us_visa_benefit: parseBool(cols[6]),
      has_valid_uk_visa_benefit: parseBool(cols[7]),
      has_valid_schengen_visa_benefit: parseBool(cols[8]),
      notes: cols[9] || "",
      last_verified_date: cols[10] || "",
    };
  }).filter(r => r.passport_country && r.destination_country);
}

function downloadCSVTemplate() {
  const sample = `${CSV_HEADER}\nNetherlands,,Thailand,Visa Free,0,0,No,No,No,30 days on arrival,2024-01-01\nSyria,Qatar,Georgia,Visa on Arrival,0,0,Yes,No,No,GCC residents get VoA,2024-01-01\n`;
  const blob = new Blob([sample], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = "visa_requirements_template.csv"; a.click();
}

function downloadExcelTemplate() {
  const sample = `${CSV_HEADER.replace(/,/g, "\t")}\nNetherlands\t\tThailand\tVisa Free\t0\t0\tNo\tNo\tNo\t30 days on arrival\t2024-01-01\n`;
  const blob = new Blob([sample], { type: "application/vnd.ms-excel" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = "visa_requirements_template.xls"; a.click();
}

export default function AdminVisa() {
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ passport_country: "", residence_country: "", destination_country: "", visa_type: "Visa Free", visa_cost: "", processing_days: "", has_valid_us_visa_benefit: false, has_valid_uk_visa_benefit: false, has_valid_schengen_visa_benefit: false, notes: "", last_verified_date: "" });
  const [previewRows, setPreviewRows] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data: visas = [] } = useQuery({
    queryKey: ["visa-requirements"],
    queryFn: () => base44.entities.VisaRequirement.list(),
  });

  const filtered = visas.filter(v =>
    v.passport_country?.toLowerCase().includes(search.toLowerCase()) ||
    v.destination_country?.toLowerCase().includes(search.toLowerCase()) ||
    v.residence_country?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    await base44.entities.VisaRequirement.create({
      ...form, visa_cost: Number(form.visa_cost) || 0, processing_days: Number(form.processing_days) || 0
    });
    queryClient.invalidateQueries({ queryKey: ["visa-requirements"] });
    toast.success("Visa rule added!");
    setForm({ passport_country: "", residence_country: "", destination_country: "", visa_type: "Visa Free", visa_cost: "", processing_days: "", has_valid_us_visa_benefit: false, has_valid_uk_visa_benefit: false, has_valid_schengen_visa_benefit: false, notes: "", last_verified_date: "" });
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.VisaRequirement.delete(id);
    queryClient.invalidateQueries({ queryKey: ["visa-requirements"] });
    toast.success("Deleted");
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
      if (rows.length === 0) { toast.error("No valid rows found. Check the CSV format."); return; }
      setPreviewRows(rows);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSaveImport = async () => {
    if (!previewRows?.length) return;
    setSaving(true);
    await base44.entities.VisaRequirement.bulkCreate(previewRows);
    queryClient.invalidateQueries({ queryKey: ["visa-requirements"] });
    toast.success(`${previewRows.length} visa rules imported!`);
    setPreviewRows(null);
    setSaving(false);
  };

  const updatePreviewRow = (i, key, val) => {
    setPreviewRows(rows => rows.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  };

  const removePreviewRow = (i) => {
    setPreviewRows(rows => rows.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-4">
      {/* Import format info */}
      <Card className="p-4 bg-muted/30 border-dashed">
        <p className="text-xs font-semibold mb-1">📋 Required CSV Column Order:</p>
        <code className="text-[10px] text-muted-foreground break-all">{CSV_HEADER}</code>
        <p className="text-[10px] text-muted-foreground mt-2">
          <strong>Residence Country</strong> is optional — leave blank if the rule applies to all residents.<br />
          Example: Syria passport + Qatar residence → Georgia = Visa on Arrival
        </p>
        <div className="flex gap-2 mt-3">
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={downloadCSVTemplate}>
            <Download className="w-3 h-3 mr-1" /> CSV Template
          </Button>
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={downloadExcelTemplate}>
            <Download className="w-3 h-3 mr-1" /> Excel Template
          </Button>
        </div>
      </Card>

      {/* Actions bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search passport, residence or destination..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="w-4 h-4 mr-1" /> Import CSV
        </Button>
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      {/* Add form */}
      {showForm && (
        <Card className="p-4">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Passport Country *</Label>
                <Input placeholder="Netherlands" value={form.passport_country} onChange={e => setForm({...form, passport_country: e.target.value})} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Residence Country <span className="text-muted-foreground">(optional)</span></Label>
                <Input placeholder="e.g. Qatar (leave blank if universal)" value={form.residence_country} onChange={e => setForm({...form, residence_country: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Destination Country *</Label>
                <Input placeholder="Georgia" value={form.destination_country} onChange={e => setForm({...form, destination_country: e.target.value})} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Visa Type *</Label>
                <Select value={form.visa_type} onValueChange={v => setForm({...form, visa_type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VISA_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Visa Cost (USD)</Label>
                <Input type="number" placeholder="0" value={form.visa_cost} onChange={e => setForm({...form, visa_cost: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Processing Days</Label>
                <Input type="number" placeholder="0" value={form.processing_days} onChange={e => setForm({...form, processing_days: e.target.value})} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Input placeholder="e.g. Max stay 30 days, return ticket required..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Last Verified Date</Label>
              <Input type="date" value={form.last_verified_date} onChange={e => setForm({...form, last_verified_date: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Visa benefits for holders of:</Label>
              <div className="flex flex-col gap-1.5">
                {[
                  { key: "has_valid_us_visa_benefit", label: "🇺🇸 Valid US Visa" },
                  { key: "has_valid_uk_visa_benefit", label: "🇬🇧 Valid UK Visa" },
                  { key: "has_valid_schengen_visa_benefit", label: "🇪🇺 Valid Schengen Visa" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={form[key]} onChange={e => setForm({...form, [key]: e.target.checked})} className="rounded" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90">Add Visa Rule</Button>
          </form>
        </Card>
      )}

      {/* CSV Preview */}
      {previewRows && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">Preview — {previewRows.length} rows</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setPreviewRows(null)}>
                <X className="w-3 h-3 mr-1" /> Discard
              </Button>
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-xs" onClick={handleSaveImport} disabled={saving}>
                <Check className="w-3 h-3 mr-1" /> {saving ? "Saving..." : "Save All"}
              </Button>
            </div>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {previewRows.map((row, i) => (
              <div key={i} className="bg-muted/30 rounded-lg p-3 text-xs">
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div>
                    <Label className="text-[10px]">Passport</Label>
                    <Input value={row.passport_country} onChange={e => updatePreviewRow(i, "passport_country", e.target.value)} className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Residence</Label>
                    <Input value={row.residence_country} onChange={e => updatePreviewRow(i, "residence_country", e.target.value)} className="h-7 text-xs" placeholder="(any)" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Destination</Label>
                    <Input value={row.destination_country} onChange={e => updatePreviewRow(i, "destination_country", e.target.value)} className="h-7 text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <Label className="text-[10px]">Visa Type</Label>
                    <Select value={row.visa_type} onValueChange={v => updatePreviewRow(i, "visa_type", v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{VISA_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px]">Cost $</Label>
                    <Input type="number" value={row.visa_cost} onChange={e => updatePreviewRow(i, "visa_cost", Number(e.target.value))} className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Days</Label>
                    <Input type="number" value={row.processing_days} onChange={e => updatePreviewRow(i, "processing_days", Number(e.target.value))} className="h-7 text-xs" />
                  </div>
                  <div className="flex items-end">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removePreviewRow(i)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {row.notes && <p className="mt-1 text-muted-foreground text-[10px]">📝 {row.notes}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Existing records */}
      <p className="text-xs text-muted-foreground">{visas.length} rules total — showing {filtered.slice(0, 100).length}</p>
      <div className="space-y-2">
        {filtered.slice(0, 100).map(v => (
          <Card key={v.id} className="p-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1 text-sm font-medium flex-wrap">
                  <span>{v.passport_country}</span>
                  {v.residence_country && (
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">living in {v.residence_country}</span>
                  )}
                  <span className="text-muted-foreground">→</span>
                  <span>{v.destination_country}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${VISA_COLORS[v.visa_type] || "bg-muted"}`}>{v.visa_type}</span>
                  {v.visa_cost > 0 && <span className="text-[10px] text-muted-foreground">${v.visa_cost}</span>}
                  {v.processing_days > 0 && <span className="text-[10px] text-muted-foreground">{v.processing_days}d</span>}
                  {v.notes && <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{v.notes}</span>}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive flex-shrink-0" onClick={() => handleDelete(v.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">No visa rules found</p>}
      </div>
    </div>
  );
}