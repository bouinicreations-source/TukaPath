import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/client";
import RecordManager from "@/components/admin/RecordManager";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Download, Eye, Check, X, Trash2, FileSpreadsheet, Wand2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import AdminUpload from "@/components/admin/AdminUpload";
import TourPointsUploader from "@/components/admin/TourPointsUploader";

// ─── Generic CSV uploader for simpler entities ───────────────────────────────

function parseCSVGeneric(text, fields) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const sep = lines[0].includes("\t") ? "\t" : ",";
  return lines.slice(1).map(line => {
    const cols = [];
    let cur = ""; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === sep && !inQ) { cols.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    const obj = {};
    fields.forEach((f, i) => { obj[f] = cols[i] ?? ""; });
    return obj;
  }).filter(r => Object.values(r).some(v => v));
}

function downloadTemplate(fields, filename) {
  const header = fields.join(",");
  const blob = new Blob([header + "\n"], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = filename; a.click();
}

function exportCSV(rows, fields, filename) {
  const header = fields.join(",");
  const lines = rows.map(r => fields.map(f => `"${String(r[f] ?? "").replace(/"/g, '""')}"`).join(","));
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = filename; a.click();
}

async function masterExportAll() {
  const MODULES = [
    { entity: "Location", fields: ["name","city","country","category","status"] },
    { entity: "VisaBaseRule", fields: ["passport_country","destination_country","visa_type","visa_cost_usd","processing_days"] },
    { entity: "VisaException", fields: ["passport_country","destination_country","exception_type","condition_value","visa_type_override"] },
    { entity: "Airport", fields: ["airport_iata","airport_name","city","country"] },
    { entity: "Rating", fields: ["location_id","place_rating","story_rating","remarks"] },
    { entity: "Discovery", fields: ["place_name","description","status"] },
  ];
  const allRows = [];
  const allFields = new Set(["_source"]);
  for (const mod of MODULES) {
    const rows = await base44.entities[mod.entity].list();
    mod.fields.forEach(f => allFields.add(f));
    rows.forEach(r => allRows.push({ _source: mod.entity, ...r }));
  }
  const fields = ["_source", ...Array.from(allFields).filter(f => f !== "_source")];
  exportCSV(allRows, fields, "tukapath_full_export.csv");
}

const NUMERIC_FIELDS = new Set([
  "processing_days","visa_duration_days","visa_cost_usd",
  "processing_days_override","visa_duration_days_override","visa_cost_usd_override",
  "priority","latitude","longitude"
]);

function coerceRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (NUMERIC_FIELDS.has(k)) {
      const n = parseFloat(v);
      out[k] = isNaN(n) ? 0 : n;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function GenericUploader({ entity, fields, dupKey, label, templateFile, exportFile }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [existing, setExisting] = useState([]);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    base44.entities[entity].list('-created_date', 9999).then(setExisting).catch(() => {});
  }, [entity]);

  const getDup = (row) => existing.find(e =>
    dupKey.every(k => e[k]?.toLowerCase() === row[k]?.toLowerCase())
  );

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSVGeneric(ev.target.result, fields);
      if (!rows.length) { toast.error("No valid rows found. Check column order."); return; }
      setPreview(rows);
      toast.success(`${rows.length} rows ready to preview`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const handleSave = async () => {
    if (!preview?.length) return;
    setSaving(true);
    window.__adminUploadInProgress = true;

    const toCreate = [];
    const toUpdate = [];
    for (const row of preview) {
      const dup = getDup(row);
      const coerced = coerceRow(row);
      if (dup) toUpdate.push({ id: dup.id, data: coerced });
      else toCreate.push(coerced);
    }

    const CHUNK = 5;
    for (let i = 0; i < toCreate.length; i += CHUNK) {
      await base44.entities[entity].bulkCreate(toCreate.slice(i, i + CHUNK));
      await sleep(2000);
    }
    for (let i = 0; i < toUpdate.length; i++) {
      await base44.entities[entity].update(toUpdate[i].id, toUpdate[i].data);
      if ((i + 1) % 5 === 0) await sleep(2000);
    }

    toast.success(`${preview.length} ${label} records imported!`);
    setPreview(null);
    window.__adminUploadInProgress = false;
    setSaving(false);
    base44.entities[entity].list('-created_date', 9999).then(setExisting).catch(() => {});
  };

  const handleExport = async () => {
    setExporting(true);
    const rows = await base44.entities[entity].list('-created_date', 9999);
    exportCSV(rows, fields, exportFile);
    setExporting(false);
    toast.success("Exported!");
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-muted/30 border-dashed">
        <div className="flex items-start gap-2 mb-2">
          <FileSpreadsheet className="w-4 h-4 text-primary mt-0.5" />
          <p className="text-xs font-semibold">CSV Column Order — {label}</p>
        </div>
        <code className="text-[10px] text-muted-foreground break-all block">{fields.join(", ")}</code>
        <p className="text-[10px] text-muted-foreground mt-2">
          ⚠️ First row is treated as header and skipped. Duplicate detected by: <strong>{dupKey.join(" + ")}</strong> — existing record will be overwritten.
        </p>
        <Button size="sm" variant="outline" className="text-xs h-7 mt-3" onClick={() => downloadTemplate(fields, templateFile)}>
          <Download className="w-3 h-3 mr-1" /> Download Template
        </Button>
      </Card>

      <div className="flex gap-2">
        <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={() => fileRef.current?.click()}>
          <Upload className="w-4 h-4 mr-2" /> Upload CSV
        </Button>
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          <Download className="w-4 h-4 mr-1" /> {exporting ? "Exporting..." : "Export"}
        </Button>
      </div>

      {preview && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">Preview — {preview.length} rows</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setPreview(null)}>
                <X className="w-3 h-3 mr-1" /> Discard
              </Button>
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-xs" onClick={handleSave} disabled={saving}>
                <Check className="w-3 h-3 mr-1" /> {saving ? "Saving..." : `Save ${preview.length} Records`}
              </Button>
            </div>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {preview.map((row, i) => (
              <div key={i} className="bg-muted/30 rounded-xl p-3 text-xs border border-border">
                {getDup(row) && (
                  <p className="text-[10px] text-amber-600 font-medium mb-1">⚠️ Duplicate detected — existing record will be overwritten</p>
                )}
                <div className="grid grid-cols-2 gap-1">
                  {fields.slice(0, 6).map(f => (
                    <div key={f}>
                      <span className="text-muted-foreground">{f}: </span>
                      <span className="font-medium">{row[f] || "—"}</span>
                    </div>
                  ))}
                </div>
                {fields.length > 6 && (
                  <p className="text-[10px] text-muted-foreground mt-1">+{fields.length - 6} more fields</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Location ID Backfill Tool ───────────────────────────────────────────────

function BackfillLocationIds() {
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [phase, setPhase] = React.useState('');

  const runMigration = async (dryRun = false) => {
    setLoading(true);
    setResult(null);
    setPhase(dryRun ? 'Scanning all locations…' : 'Assigning IDs to all missing records…');
    try {
      const res = await base44.functions.invoke("updateLocationIds", { dry_run: dryRun });
      setResult(res.data);
    } catch (e) {
      toast.error("Migration failed: " + e.message);
    }
    setPhase('');
    setLoading(false);
  };

  const allDone = result && result.without_id === 0 && !result.dry_run;
  const hasDuplicates = result?.duplicates_found > 0;

  return (
    <Card className="p-4 border-dashed border-primary/30 bg-primary/5 mb-4">
      <div className="flex items-start gap-2 mb-3">
        <Wand2 className="w-4 h-4 text-primary mt-0.5" />
        <div>
          <p className="text-xs font-semibold">One-Time Location ID Migration</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Permanently assigns <span className="font-mono">TP_XXX_XXX_000000</span> IDs to all locations missing one.
            Never overwrites existing IDs. Runs as a single atomic migration.
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {phase}
        </div>
      )}

      {result && (
        <div className="p-3 rounded-lg bg-card border border-border text-xs space-y-2 mb-3">
          {result.dry_run && (
            <p className="font-semibold text-amber-600">🔍 Dry Run — no changes saved</p>
          )}
          {allDone && !result.dry_run && (
            <p className="font-semibold text-green-700">✅ Migration complete — all locations have IDs</p>
          )}
          {!allDone && !result.dry_run && !loading && (
            <p className="font-semibold text-amber-600">⚠️ Migration finished but {result.without_id} records still missing IDs</p>
          )}

          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span>Total locations:</span><strong>{result.total_locations}</strong>
            <span>With valid ID:</span><strong className="text-green-700">{result.with_id ?? result.already_had_id}</strong>
            <span>Still missing ID:</span><strong className={result.without_id > 0 ? 'text-destructive' : 'text-green-700'}>{result.without_id ?? 0}</strong>
            <span>Newly assigned:</span><strong className="text-primary">{result.backfilled}</strong>
            {result.failed > 0 && <><span>Failed:</span><strong className="text-destructive">{result.failed}</strong></>}
            <span>Duplicate IDs:</span><strong className={hasDuplicates ? 'text-destructive' : 'text-green-700'}>{result.duplicates_found ?? 0} {hasDuplicates ? '⚠️' : '✓'}</strong>
          </div>

          {result.failed_details?.length > 0 && (
            <div className="mt-2 p-2 bg-destructive/10 rounded text-destructive">
              <p className="font-semibold mb-1">Failed records:</p>
              {result.failed_details.map((f, i) => (
                <p key={i}>{f.name}: {f.error}</p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => runMigration(true)} disabled={loading}>
          🔍 Dry Run (preview)
        </Button>
        <Button size="sm" className="text-xs h-8 bg-primary hover:bg-primary/90" onClick={() => runMigration(false)} disabled={loading}>
          <Wand2 className="w-3 h-3 mr-1" /> Run Migration
        </Button>
      </div>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminDataHub({ initialTab = 'locations' }) {
  const [activeTab, setActiveTab] = React.useState(initialTab);

  const guardTabChange = (val) => {
    if (window.__adminUploadInProgress) {
      if (!window.confirm('An upload is still in progress. Switching tabs will not cancel it, but you will lose visibility of the progress. Continue?')) return;
    }
    setActiveTab(val);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold">Data Hub</h2>
        <p className="text-xs text-muted-foreground">Bulk imports, exports and record management — each tab has its own Download Data action</p>
      </div>

      <Tabs value={activeTab} onValueChange={guardTabChange}>
  <div className="overflow-x-auto">
    <TabsList className="inline-flex w-max min-w-full gap-2 p-1">
      <TabsTrigger value="locations" className="shrink-0 whitespace-nowrap text-xs px-3 py-1.5">
        Locations
      </TabsTrigger>
      <TabsTrigger value="visa-rules" className="shrink-0 whitespace-nowrap text-xs px-3 py-1.5">
        Visa Rules
      </TabsTrigger>
      <TabsTrigger value="visa-exceptions" className="shrink-0 whitespace-nowrap text-xs px-3 py-1.5">
        Exceptions
      </TabsTrigger>
      <TabsTrigger value="airports" className="shrink-0 whitespace-nowrap text-xs px-3 py-1.5">
        Airports
      </TabsTrigger>
      <TabsTrigger value="tour-points" className="shrink-0 whitespace-nowrap text-xs px-3 py-1.5">
      Tour Points
      </TabsTrigger>
      <TabsTrigger value="generated" className="shrink-0 whitespace-nowrap text-xs px-3 py-1.5">
      Generated
      </TabsTrigger>
      <TabsTrigger value="corrections" className="shrink-0 whitespace-nowrap text-xs px-3 py-1.5">
      Corrections
      </TabsTrigger>
      </TabsList>
      </div>

      <TabsContent value="locations" className="pt-3">
          <BackfillLocationIds />
          <AdminUpload />
          <RecordManager
            entity="Location"
            label="Locations"
            displayFields={[
              { key: "name", label: "Name" },
              { key: "city", label: "City" },
              { key: "country", label: "Country" },
              { key: "status", label: "Status" },
            ]}
          />
        </TabsContent>

        <TabsContent value="visa-rules" className="pt-3">
          <GenericUploader
            entity="VisaBaseRule"
            fields={["passport_country","destination_country","visa_type","processing_days","visa_duration_days","visa_cost_usd","entry_status","application_route","special_notes","last_verified_date"]}
            dupKey={["passport_country","destination_country"]}
            label="Visa Rules"
            templateFile="visa_rules_template.csv"
            exportFile="visa_rules_export.csv"
          />
          <RecordManager
            entity="VisaBaseRule"
            label="Visa Rules"
            displayFields={[
              { key: "passport_country", label: "Passport" },
              { key: "destination_country", label: "Destination" },
              { key: "visa_type", label: "Type" },
              { key: "visa_cost_usd", label: "Cost (USD)" },
            ]}
          />
        </TabsContent>

        <TabsContent value="visa-exceptions" className="pt-3">
          <GenericUploader
            entity="VisaException"
            fields={["passport_country","destination_country","exception_type","condition_value","visa_type_override","processing_days_override","visa_duration_days_override","visa_cost_usd_override","entry_status_override","application_route_override","priority","special_notes","last_verified_date"]}
            dupKey={["passport_country","destination_country","exception_type","condition_value"]}
            label="Visa Exceptions"
            templateFile="visa_exceptions_template.csv"
            exportFile="visa_exceptions_export.csv"
          />
          <RecordManager
            entity="VisaException"
            label="Visa Exceptions"
            displayFields={[
              { key: "passport_country", label: "Passport" },
              { key: "destination_country", label: "Destination" },
              { key: "exception_type", label: "Type" },
              { key: "condition_value", label: "Condition" },
            ]}
          />
        </TabsContent>

        <TabsContent value="airports" className="pt-3">
          <GenericUploader
            entity="Airport"
            fields={["airport_iata","airport_name","city","country","latitude","longitude"]}
            dupKey={["airport_iata"]}
            label="Airports"
            templateFile="airports_template.csv"
            exportFile="airports_export.csv"
          />
          <RecordManager
            entity="Airport"
            label="Airports"
            displayFields={[
              { key: "airport_iata", label: "IATA" },
              { key: "airport_name", label: "Name" },
              { key: "city", label: "City" },
              { key: "country", label: "Country" },
            ]}
          />
        </TabsContent>

        <TabsContent value="tour-points" className="pt-3">
          <TourPointsUploader />
        </TabsContent>

        <TabsContent value="generated" className="pt-3">
          <GenericUploader
            entity="Location"
            fields={["name","city","country","category","review_status","visible_to_users","generated_on_demand","image_url","quick_story","quick_audio_url","source","status"]}
            dupKey={["name","city"]}
            label="Generated Locations"
            templateFile="generated_locations_template.csv"
            exportFile="generated_locations_export.csv"
          />
        </TabsContent>

        <TabsContent value="corrections" className="pt-3">
          <GenericUploader
            entity="UserCorrection"
            fields={["location_id","location_name","correction_type","message","status","reviewed_by","applied_at","final_content","original_content"]}
            dupKey={["location_id","correction_type"]}
            label="User Corrections"
            templateFile="corrections_template.csv"
            exportFile="corrections_export.csv"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}