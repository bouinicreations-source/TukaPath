import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Download, Eye, Check, X, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

const FIELDS = [
  "location_id","point_id","point_order","point_title","point_label",
  "direction_hint","short_description","story_text","story_voice",
  "audio_url","image_url","is_active"
];

function parseCSV(text) {
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
    FIELDS.forEach((f, i) => { obj[f] = cols[i] ?? ""; });
    return obj;
  }).filter(r => r.point_id || r.location_id);
}

function exportCSV(rows) {
  const header = FIELDS.join(",");
  const lines = rows.map(r => FIELDS.map(f => `"${String(r[f] ?? "").replace(/"/g, '""')}"`).join(","));
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = "tour_points_export.csv"; a.click();
}

function downloadTemplate() {
  const blob = new Blob([FIELDS.join(",") + "\n"], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = "tour_points_template.csv"; a.click();
}

export default function TourPointsUploader() {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null); // { rows: [], validLocationIds: Set }
  const [existing, setExisting] = useState([]);
  const [knownLocationIds, setKnownLocationIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    base44.entities.TourPoint.list("-created_date", 9999).then(setExisting).catch(() => {});
    base44.entities.Location.filter({ status: "active" }, null, 9999)
      .then(locs => setKnownLocationIds(new Set(locs.map(l => l.location_id).filter(Boolean))))
      .catch(() => {});
  }, []);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
      if (!rows.length) { toast.error("No valid rows found. Check column order."); return; }
      setPreview(rows);
      toast.success(`${rows.length} rows ready to preview`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const getExisting = (row) => existing.find(e => e.point_id === row.point_id);
  const isValidLocationId = (row) => knownLocationIds.has(row.location_id);

  const handleSave = async () => {
    if (!preview?.length) return;
    const validRows = preview.filter(r => isValidLocationId(r));
    if (!validRows.length) { toast.error("No valid rows to save — all have invalid location_id."); return; }

    setSaving(true);
    window.__adminUploadInProgress = true;

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const toCreate = [];
    const toUpdate = [];

    for (const row of validRows) {
      const dup = getExisting(row);
      const coerced = {
        ...row,
        point_order: parseFloat(row.point_order) || 0,
        is_active: String(row.is_active).toLowerCase() !== "false",
      };
      if (dup) toUpdate.push({ id: dup.id, data: coerced });
      else toCreate.push(coerced);
    }

    const CHUNK = 5;
    for (let i = 0; i < toCreate.length; i += CHUNK) {
      await base44.entities.TourPoint.bulkCreate(toCreate.slice(i, i + CHUNK));
      await sleep(2000);
    }
    for (let i = 0; i < toUpdate.length; i++) {
      await base44.entities.TourPoint.update(toUpdate[i].id, toUpdate[i].data);
      if ((i + 1) % 5 === 0) await sleep(2000);
    }

    toast.success(`${validRows.length} TourPoint records saved!`);
    setPreview(null);
    window.__adminUploadInProgress = false;
    setSaving(false);
    base44.entities.TourPoint.list("-created_date", 9999).then(setExisting).catch(() => {});
  };

  const handleExport = async () => {
    setExporting(true);
    const rows = await base44.entities.TourPoint.list("-created_date", 9999);
    exportCSV(rows);
    setExporting(false);
    toast.success("Exported!");
  };

  const invalidRows = preview ? preview.filter(r => !isValidLocationId(r)) : [];
  const dupRows = preview ? preview.filter(r => isValidLocationId(r) && getExisting(r)) : [];

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-muted/30 border-dashed">
        <div className="flex items-start gap-2 mb-2">
          <FileSpreadsheet className="w-4 h-4 text-primary mt-0.5" />
          <p className="text-xs font-semibold">CSV Column Order — Tour Points</p>
        </div>
        <code className="text-[10px] text-muted-foreground break-all block">{FIELDS.join(", ")}</code>
        <p className="text-[10px] text-muted-foreground mt-2">
          ⚠️ <strong>location_id</strong> must match an existing Location. Duplicate <strong>point_id</strong> will overwrite existing record.
        </p>
        <Button size="sm" variant="outline" className="text-xs h-7 mt-3" onClick={downloadTemplate}>
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

      <p className="text-xs text-muted-foreground">
        {existing.length} TourPoint records currently in database.
      </p>

      {preview && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">Preview — {preview.length} rows</p>
              {invalidRows.length > 0 && (
                <span className="text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">
                  {invalidRows.length} invalid location_id
                </span>
              )}
              {dupRows.length > 0 && (
                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                  {dupRows.length} will overwrite
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setPreview(null)}>
                <X className="w-3 h-3 mr-1" /> Discard
              </Button>
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-xs" onClick={handleSave} disabled={saving}>
                <Check className="w-3 h-3 mr-1" /> {saving ? "Saving..." : `Save ${preview.filter(r => isValidLocationId(r)).length} Valid Rows`}
              </Button>
            </div>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {preview.map((row, i) => {
              const invalid = !isValidLocationId(row);
              const dup = !invalid && getExisting(row);
              return (
                <div key={i} className={`rounded-xl p-3 text-xs border ${invalid ? "border-destructive/40 bg-destructive/5" : "bg-muted/30 border-border"}`}>
                  {invalid && (
                    <p className="text-[10px] text-destructive font-medium mb-1">❌ Invalid location_id: "{row.location_id}" — this row will be skipped</p>
                  )}
                  {dup && (
                    <p className="text-[10px] text-amber-600 font-medium mb-1">⚠️ Duplicate point_id — existing record will be overwritten</p>
                  )}
                  <div className="grid grid-cols-2 gap-1">
                    <div><span className="text-muted-foreground">location_id: </span><span className="font-medium">{row.location_id || "—"}</span></div>
                    <div><span className="text-muted-foreground">point_id: </span><span className="font-medium">{row.point_id || "—"}</span></div>
                    <div><span className="text-muted-foreground">order: </span><span className="font-medium">{row.point_order || "—"}</span></div>
                    <div><span className="text-muted-foreground">title: </span><span className="font-medium">{row.point_title || "—"}</span></div>
                    <div><span className="text-muted-foreground">label: </span><span className="font-medium">{row.point_label || "—"}</span></div>
                    <div><span className="text-muted-foreground">active: </span><span className="font-medium">{row.is_active || "—"}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}