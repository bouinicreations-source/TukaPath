import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2, Check, X, Search, Upload, Wand2, PenLine, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import AirportGenerator from "./airports/AirportGenerator";

const EMPTY = { airport_iata: "", airport_name: "", city: "", country: "", latitude: "", longitude: "" };

function AirportForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY);
  const up = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.airport_iata || !form.airport_name || !form.city || !form.country) {
      toast.error("IATA, Name, City and Country are required");
      return;
    }
    await onSave({
      ...form,
      airport_iata: form.airport_iata.toUpperCase().trim(),
      latitude: parseFloat(form.latitude) || 0,
      longitude: parseFloat(form.longitude) || 0,
    });
  };

  return (
    <Card className="p-4 space-y-3 mb-4 border-primary/20 bg-primary/5">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">IATA Code *</Label>
          <Input value={form.airport_iata} onChange={e => up("airport_iata", e.target.value.toUpperCase())} placeholder="e.g. CDG" maxLength={3} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Airport Name *</Label>
          <Input value={form.airport_name} onChange={e => up("airport_name", e.target.value)} placeholder="e.g. Charles de Gaulle" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">City *</Label>
          <Input value={form.city} onChange={e => up("city", e.target.value)} placeholder="Paris" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Country *</Label>
          <Input value={form.country} onChange={e => up("country", e.target.value)} placeholder="France" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Latitude</Label>
          <Input type="number" step="any" value={form.latitude} onChange={e => up("latitude", e.target.value)} placeholder="49.0097" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Longitude</Label>
          <Input type="number" step="any" value={form.longitude} onChange={e => up("longitude", e.target.value)} placeholder="2.5479" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90" onClick={handleSave}>
          <Check className="w-3.5 h-3.5 mr-1" /> Save
        </Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={onCancel}>
          <X className="w-3.5 h-3.5 mr-1" /> Cancel
        </Button>
      </div>
    </Card>
  );
}

// Simple CSV parser for airports: iata, name, city, country, latitude, longitude
function parseAirportCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const sep = lines[0].includes("\t") ? "\t" : ",";
  const splitLine = (l) => l.split(sep).map(v => v.replace(/^"|"$/g, "").trim());
  const headers = splitLine(lines[0]).map(h => h.toLowerCase());
  return lines.slice(1).map(line => {
    if (!line.trim()) return null;
    const cols = splitLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });
    return row;
  }).filter(Boolean);
}

// ── Add Menu ──────────────────────────────────────────────────────────────────
function AirportAddMenu({ onManual, onCSV, onGenerate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const items = [
    { icon: PenLine, label: "Add Airport Manually", action: onManual },
    { icon: Wand2,   label: "Generate via Google API", action: onGenerate },
    { icon: Upload,  label: "Import CSV",              action: onCSV },
  ];

  return (
    <div className="relative" ref={ref}>
      <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => setOpen(v => !v)}>
        <Plus className="w-3.5 h-3.5 mr-1" /> Add
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          {items.map(({ icon: Icon, label, action }) => (
            <button
              key={label}
              onClick={() => { setOpen(false); action?.(); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors text-left border-b border-border/40 last:border-0"
            >
              <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span>{label}</span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── CSV Import Panel ──────────────────────────────────────────────────────────
function AirportCSVImport({ onDone }) {
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [rows, setRows] = useState(null);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseAirportCSV(ev.target.result);
      if (!parsed.length) { toast.error("No valid rows found"); return; }
      setRows(parsed);
      toast.success(`${parsed.length} rows ready to preview`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!rows?.length) return;
    setSaving(true);
    let ok = 0, fail = 0;
    for (const row of rows) {
      try {
        await base44.entities.Airport.create({
          airport_iata: (row.iata || row.airport_iata || "").toUpperCase().trim(),
          airport_name: row.name || row.airport_name || "",
          city: row.city || "",
          country: row.country || "",
          latitude: parseFloat(row.latitude) || 0,
          longitude: parseFloat(row.longitude) || 0,
        });
        ok++;
      } catch { fail++; }
    }
    queryClient.invalidateQueries(["airports"]);
    setSaving(false);
    setResults({ ok, fail, total: rows.length });
    setRows(null);
    if (fail === 0) toast.success(`Imported ${ok} airports`);
    else toast.warning(`Imported ${ok}, failed ${fail}`);
  };

  return (
    <Card className="p-4 space-y-3 mb-4 border-primary/20 bg-primary/5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Import Airports (CSV)</p>
          <p className="text-xs text-muted-foreground">Columns: iata, name, city, country, latitude, longitude</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onDone}><X className="w-4 h-4" /></Button>
      </div>

      {!rows && !results && (
        <>
          <Button size="sm" variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
            <Upload className="w-3.5 h-3.5 mr-1.5" /> Choose CSV File
          </Button>
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
        </>
      )}

      {rows && (
        <>
          <p className="text-xs text-muted-foreground">{rows.length} rows detected</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {rows.slice(0, 5).map((r, i) => (
              <div key={i} className="text-[11px] bg-muted/50 rounded px-2 py-1 font-mono">
                {r.iata || r.airport_iata || "—"} · {r.name || r.airport_name} · {r.city}, {r.country}
              </div>
            ))}
            {rows.length > 5 && <p className="text-[10px] text-muted-foreground">…and {rows.length - 5} more</p>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : `Save ${rows.length} Airports`}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRows(null)}>Discard</Button>
          </div>
        </>
      )}

      {results && (
        <div className="text-center py-2">
          <Check className="w-5 h-5 text-green-600 mx-auto mb-1" />
          <p className="text-sm font-semibold">Done — {results.ok} saved{results.fail > 0 ? `, ${results.fail} failed` : ""}</p>
          <button onClick={onDone} className="text-xs text-primary underline mt-1">Close</button>
        </div>
      )}
    </Card>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AdminAirports() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [panel, setPanel] = useState(null); // "manual" | "csv" | "generate"
  const [editId, setEditId] = useState(null);

  const { data: airports = [], isLoading } = useQuery({
    queryKey: ["airports"],
    queryFn: () => base44.entities.Airport.list(),
  });

  const filtered = airports.filter(a =>
    !search ||
    a.airport_iata?.toLowerCase().includes(search.toLowerCase()) ||
    a.airport_name?.toLowerCase().includes(search.toLowerCase()) ||
    a.city?.toLowerCase().includes(search.toLowerCase()) ||
    a.country?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (data) => {
    await base44.entities.Airport.create(data);
    queryClient.invalidateQueries(["airports"]);
    setPanel(null);
    toast.success("Airport added!");
  };

  const handleUpdate = async (id, data) => {
    await base44.entities.Airport.update(id, data);
    queryClient.invalidateQueries(["airports"]);
    setEditId(null);
    toast.success("Airport updated!");
  };

  const handleDelete = async (id) => {
    await base44.entities.Airport.delete(id);
    queryClient.invalidateQueries(["airports"]);
    toast.success("Airport removed");
  };

  if (panel === "generate") {
    return <AirportGenerator onBack={() => setPanel(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold">Airport Master Dataset</h2>
          <p className="text-xs text-muted-foreground">{airports.length} airports · Used for flight estimation and destination mapping</p>
        </div>
        <AirportAddMenu
          onManual={() => setPanel(panel === "manual" ? null : "manual")}
          onCSV={() => setPanel(panel === "csv" ? null : "csv")}
          onGenerate={() => setPanel("generate")}
        />
      </div>

      {panel === "manual" && <AirportForm onSave={handleCreate} onCancel={() => setPanel(null)} />}
      {panel === "csv" && <AirportCSVImport onDone={() => setPanel(null)} />}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by IATA, name, city..." className="pl-10" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">
          {airports.length === 0 ? "No airports yet. Use Add to get started." : "No results for your search."}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map(airport => (
            <div key={airport.id}>
              {editId === airport.id ? (
                <AirportForm initial={airport} onSave={(data) => handleUpdate(airport.id, data)} onCancel={() => setEditId(null)} />
              ) : (
                <Card className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className="font-mono text-sm bg-primary/10 text-primary border-0">{airport.airport_iata}</Badge>
                    <div>
                      <p className="text-sm font-medium">{airport.airport_name}</p>
                      <p className="text-[10px] text-muted-foreground">{airport.city}, {airport.country}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setEditId(airport.id)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleDelete(airport.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center pt-2">
        Airport data is used to estimate flight costs and map destinations.
      </p>
    </div>
  );
}