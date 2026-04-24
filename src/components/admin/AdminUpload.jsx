import React, { useState, useRef, useEffect, useMemo } from "react";
import { AlertTriangle as AlertTriangleIcon } from "lucide-react";
import { base44 } from "@/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Download, Eye, Check, X, Trash2, FileSpreadsheet, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";

// All supported fields (order used for full export / template)
// location_id FIRST, name SECOND
const ALL_FIELDS = [
  "location_id","name","city","country","category","latitude","longitude",
  "built_year","architect_creator","original_purpose","evolution_over_time","why_it_matters_today",
  "mystery_teaser","quick_story","deep_story","quick_story_voice","deep_story_voice","fun_fact",
  "look_closely_tip","best_photo_spot","nearby_recommendation",
  "opening_hours","typical_visit_duration","is_free","has_story",
  "image_url","quick_audio_url","deep_audio_url","quick_audio_generated","deep_audio_generated",
  "status"
];

const BOOLEAN_FIELDS = new Set(["is_free","has_story"]);

// --- ID generation helpers (mirrors backend logic) ---
function makePrefix(country, city) {
  const c3 = (country || "UNK").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 3).padEnd(3, "X");
  const city3 = (city || "UNK").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 3).padEnd(3, "X");
  return `TP_${c3}_${city3}`;
}
function formatSeq(n) { return String(n).padStart(6, "0"); }
const NUMERIC_FIELDS = new Set(["latitude","longitude","credit_cost"]);

// Parse CSV with dynamic header detection — supports partial column sets
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { rows: [], headers: [] };
  const sep = lines[0].includes("\t") ? "\t" : ",";

  function splitLine(line) {
    const cols = [];
    let cur = ""; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === sep && !inQ) { cols.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    return cols;
  }

  const headers = splitLine(lines[0]).map(h => h.replace(/^"|"$/g, "").trim().toLowerCase());

  const rows = lines.slice(1).map(line => {
    if (!line.trim()) return null;
    const cols = splitLine(line);
    const row = {};
    headers.forEach((h, i) => {
      const raw = (cols[i] ?? "").replace(/^"|"$/g, "").trim();
      row[h] = raw;
    });
    return row;
  }).filter(Boolean);

  return { rows, headers };
}

// Convert raw string values to proper types for known fields
function coerceRow(rawRow) {
  const row = {};
  for (const [key, val] of Object.entries(rawRow)) {
    if (val === "" || val === undefined) continue; // skip empty = preserve existing
    if (BOOLEAN_FIELDS.has(key)) { row[key] = val.toLowerCase() === "true"; }
    else if (NUMERIC_FIELDS.has(key)) { const n = parseFloat(val); if (!isNaN(n)) row[key] = n; }
    else { row[key] = val; }
  }
  return row;
}

function downloadTemplate(format = "csv") {
  const sep = format === "excel" ? "\t" : ",";
  const ext = format === "excel" ? "xls" : "csv";
  const header = ALL_FIELDS.join(sep);
  const sample = ALL_FIELDS.map(f => {
    const defaults = {
      location_id: "TP_FRA_PAR_000001", name: "Eiffel Tower", city: "Paris", country: "France",
      category: "landmark", latitude: "48.8584", longitude: "2.2945", is_free: "true", has_story: "true", status: "active"
    };
    return defaults[f] ?? "";
  }).join(sep);
  const content = `${header}\n${sample}\n`;
  const type = format === "excel" ? "application/vnd.ms-excel" : "text/csv";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = `locations_template.${ext}`;
  a.click();
}

function exportToCSV(locations) {
  const header = ALL_FIELDS.join(",");
  const rows = locations.map(loc =>
    ALL_FIELDS.map(h => {
      // Always use TukaPath location_id — never fall back to Base44 internal id
      const val = loc[h] ?? "";
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(",")
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([[header, ...rows].join("\n")], { type: "text/csv" }));
  a.download = "locations_export.csv";
  a.click();
}

export default function AdminUpload() {
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [previewRows, setPreviewRows] = useState(null);   // { parsed, headers }
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [existingLocations, setExistingLocations] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);

  useEffect(() => {
    base44.entities.Location.list('-created_date', 9999).then(setExistingLocations).catch(() => {});
  }, []);

  useEffect(() => {
    if (!saving) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = "Upload in progress."; return e.returnValue; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saving]);

  // lookup: location_id → existing record
  const existingById = useMemo(() => {
    const map = {};
    existingLocations.forEach(loc => { if (loc.location_id) map[loc.location_id] = loc; });
    return map;
  }, [existingLocations]);

  // lookup: lowercase name → existing record (for safety check when location_id missing)
  const existingByName = useMemo(() => {
    const map = {};
    existingLocations.forEach(loc => { if (loc.name) map[loc.name.trim().toLowerCase()] = loc; });
    return map;
  }, [existingLocations]);

  // prefix counters built from existing location_ids — used to generate next sequence
  const prefixCounters = useMemo(() => {
    const counters = {};
    existingLocations.forEach(loc => {
      if (!loc.location_id) return;
      const match = loc.location_id.match(/^TP_([A-Z]{3})_([A-Z]{3})_(\d{6})$/);
      if (match) {
        const prefix = `TP_${match[1]}_${match[2]}`;
        const seq = parseInt(match[3], 10);
        if (!counters[prefix] || seq > counters[prefix]) counters[prefix] = seq;
      }
    });
    return counters;
  }, [existingLocations]);

  // Generate the next available ID for a given country+city (does NOT mutate counters)
  const previewNextId = (country, city, offsetMap) => {
    const prefix = makePrefix(country, city);
    const base = prefixCounters[prefix] || 0;
    const extra = offsetMap[prefix] || 0;
    return `${prefix}_${formatSeq(base + extra + 1)}`;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { rows, headers } = parseCSV(ev.target.result);
      // location_id column is strongly recommended but not mandatory — we handle missing IDs
      if (rows.length === 0) { toast.error("No valid rows found."); return; }
      // Tag rows with their resolution status
      const offsetMap = {}; // prefix → count of new-IDs assigned in this batch preview
      const tagged = rows.map(row => {
        const locationId = row.location_id?.trim();
        if (locationId) {
          // Has ID — normal path
          return { ...row, _status: existingById[locationId] ? "update" : "new_with_id" };
        }
        // Missing ID — check name collision
        const nameLower = row.name?.trim().toLowerCase();
        if (nameLower && existingByName[nameLower]) {
          return { ...row, _status: "name_match", _matched_loc: existingByName[nameLower] };
        }
        // No match — will auto-generate ID
        const genId = previewNextId(row.country, row.city, offsetMap);
        const prefix = makePrefix(row.country, row.city);
        offsetMap[prefix] = (offsetMap[prefix] || 0) + 1;
        return { ...row, _status: "auto_generate", _generated_id: genId };
      });
      setPreviewRows({ parsed: tagged, headers });
      setUploadProgress(null);
      const namMatches = tagged.filter(r => r._status === "name_match").length;
      if (namMatches > 0) toast.warning(`${namMatches} row(s) require review — name matched existing location`);
      else toast.success(`${rows.length} rows ready to preview`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // Allow admin to confirm a name_match row for processing
  const confirmNameMatch = (i) => {
    setPreviewRows(prev => ({
      ...prev,
      parsed: prev.parsed.map((r, idx) => {
        if (idx !== i) return r;
        // Assign matched record's location_id so it becomes a normal update
        return { ...r, location_id: r._matched_loc?.location_id || r.location_id, _status: "update", _confirmed: true };
      })
    }));
  };

  const handleSaveImport = async () => {
    if (!previewRows?.parsed?.length) return;
    setSaving(true);
    // Recompute prefix counters fresh for save (include existing IDs)
    const saveCounters = { ...prefixCounters };
    const rows = previewRows.parsed;
    const total = rows.length;
    let added = 0, updated = 0, failed = 0, skipped = 0;
    const failedRows = [];
    setUploadProgress({ total, done: 0, added: 0, updated: 0, failed: 0, failedRows: [], finished: false });

    const BATCH = 5;
    for (let i = 0; i < rows.length; i++) {
      if (i > 0 && i % BATCH === 0) await sleep(2000);
      const rawRow = rows[i];
      const status = rawRow._status;

      // Skip unconfirmed name_match rows
      if (status === "name_match") {
        skipped++;
        failedRows.push({ label: rawRow.name || `Row ${i+2}`, error: "Skipped — name matched existing location. Confirm in preview to include." });
        setUploadProgress({ total, done: i+1, added, updated, failed, failedRows: [...failedRows], finished: false });
        continue;
      }

      // Determine effective location_id
      let locationId = rawRow.location_id?.trim();
      if (!locationId && status === "auto_generate") {
        // Generate the next ID at save time
        const prefix = makePrefix(rawRow.country, rawRow.city);
        const nextSeq = (saveCounters[prefix] || 0) + 1;
        saveCounters[prefix] = nextSeq;
        locationId = `${prefix}_${formatSeq(nextSeq)}`;
      }

      if (!locationId) {
        failed++;
        failedRows.push({ label: rawRow.name || `Row ${i+2}`, error: "Could not determine location_id" });
        setUploadProgress({ total, done: i+1, added, updated, failed, failedRows: [...failedRows], finished: false });
        continue;
      }

      const coerced = coerceRow(rawRow);
      // Strip internal tagging fields
      delete coerced._status; delete coerced._matched_loc; delete coerced._generated_id; delete coerced._confirmed;
      coerced.location_id = locationId;

      try {
        const existing = existingById[locationId];
        if (existing) {
          await base44.entities.Location.update(existing.id, coerced);
          updated++;
        } else {
          if (!coerced.name) throw new Error("name is required for new records");
          await base44.entities.Location.create({ status: "active", ...coerced });
          added++;
        }
      } catch (err) {
        failed++;
        failedRows.push({ label: rawRow.name || locationId, error: err?.response?.data?.error || err.message || "Unknown error" });
      }
      setUploadProgress({ total, done: i+1, added, updated, failed, failedRows: [...failedRows], finished: i === rows.length - 1 });
    }

    queryClient.invalidateQueries({ queryKey: ['admin-locations'] });
    base44.entities.Location.list('-created_date', 9999).then(setExistingLocations).catch(() => {});
    setSaving(false);
    setPreviewRows(null);
    if (failed === 0 && skipped === 0) {
      toast.success(`Upload complete — ${added} created, ${updated} updated`);
    } else if (skipped > 0) {
      toast.warning(`Upload done — ${added} created, ${updated} updated, ${skipped} skipped (name conflicts)`);
    } else {
      toast.error(`Upload done with ${failed} failures — check summary below`);
    }
  };

  const removeRow = (i) => setPreviewRows(prev => ({ ...prev, parsed: prev.parsed.filter((_, idx) => idx !== i) }));
  const updateCell = (i, key, val) => setPreviewRows(prev => ({
    ...prev,
    parsed: prev.parsed.map((r, idx) => idx === i ? { ...r, [key]: val } : r)
  }));

  const handleExport = async () => {
    setExporting(true);
    const locations = await base44.entities.Location.list('-created_date', 9999);
    exportToCSV(locations);
    setExporting(false);
    toast.success("Exported!");
  };

  const previewCols = previewRows?.headers?.filter(h => h !== "") ?? [];

  return (
    <div className="space-y-4">
      {/* Info card */}
      <Card className="p-4 bg-muted/30 border-dashed">
        <div className="flex items-start gap-2 mb-2">
          <FileSpreadsheet className="w-4 h-4 text-primary mt-0.5" />
          <div>
            <p className="text-xs font-semibold">CSV Upload — Partial Updates Supported</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              <strong>location_id</strong> (col 1) is required. <strong>name</strong> is only required for new records.
              Only columns present in the CSV will be updated — other fields are preserved.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
          <Info className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-amber-700">
            Matching is done via <strong>location_id</strong> only. If location_id exists → update. If not → create new record.
          </p>
        </div>
        <div className="flex gap-2 mt-3">
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => downloadTemplate("csv")}>
            <Download className="w-3 h-3 mr-1" /> CSV Template
          </Button>
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => downloadTemplate("excel")}>
            <Download className="w-3 h-3 mr-1" /> Excel Template
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 font-medium">Full column order (for reference):</p>
        <code className="text-[9px] text-muted-foreground break-all block mt-1">{ALL_FIELDS.join(", ")}</code>
      </Card>

      {/* Upload + Export */}
      <div className="flex gap-2">
        <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={() => fileRef.current?.click()}>
          <Upload className="w-4 h-4 mr-2" /> Upload CSV / Excel
        </Button>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden" onChange={handleFileChange} />
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          <Download className="w-4 h-4 mr-1" /> {exporting ? "Exporting..." : "Export"}
        </Button>
      </div>

      {/* Upload progress */}
      {uploadProgress && (
        <Card className={`p-4 border-2 ${
          uploadProgress.finished
            ? uploadProgress.failed > 0 ? "border-amber-300 bg-amber-50/50" : "border-green-300 bg-green-50/50"
            : "border-primary/30 bg-primary/5"
        }`}>
          <div className="flex items-center gap-2 mb-3">
            {uploadProgress.finished ? (
              uploadProgress.failed > 0
                ? <AlertTriangle className="w-4 h-4 text-amber-600" />
                : <Check className="w-4 h-4 text-green-600" />
            ) : (
              <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin" />
            )}
            <p className="text-sm font-semibold">
              {uploadProgress.finished ? "Upload Completed" : `Uploading… (${uploadProgress.done} / ${uploadProgress.total})`}
            </p>
          </div>

          {!uploadProgress.finished && (
            <div className="w-full bg-muted rounded-full h-2 mb-3">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.round((uploadProgress.done / uploadProgress.total) * 100)}%` }}
              />
            </div>
          )}

          <div className="grid grid-cols-4 gap-2 text-center mb-2">
            {[
              { label: "Total", val: uploadProgress.total, cls: "bg-white border-border" },
              { label: "Created", val: uploadProgress.added, cls: "bg-green-50 border-green-100 text-green-700" },
              { label: "Updated", val: uploadProgress.updated, cls: "bg-blue-50 border-blue-100 text-blue-700" },
              { label: "Failed", val: uploadProgress.failed, cls: uploadProgress.failed > 0 ? "bg-red-50 border-red-200 text-red-600" : "bg-muted border-border text-muted-foreground" },
            ].map(({ label, val, cls }) => (
              <div key={label} className={`rounded-lg p-2 border ${cls}`}>
                <p className="text-lg font-bold">{val}</p>
                <p className="text-[10px]">{label}</p>
              </div>
            ))}
          </div>

          {uploadProgress.failedRows.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs font-semibold text-destructive">Failed Records:</p>
              {uploadProgress.failedRows.map((r, i) => (
                <p key={i} className="text-[10px] text-destructive bg-red-50 rounded px-2 py-1">
                  ⚠ {r.label} — {r.error}
                </p>
              ))}
            </div>
          )}

          {uploadProgress.finished && (
            <Button size="sm" variant="outline" className="mt-3 text-xs w-full" onClick={() => setUploadProgress(null)}>
              Dismiss
            </Button>
          )}
        </Card>
      )}

      {/* Preview */}
      {previewRows && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">Preview — {previewRows.parsed.length} rows</p>
              <span className="text-[10px] text-muted-foreground">({previewCols.length} columns detected)</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setPreviewRows(null)}>
                <X className="w-3 h-3 mr-1" /> Discard
              </Button>
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-xs" onClick={handleSaveImport} disabled={saving}>
                <Check className="w-3 h-3 mr-1" />
                {saving
                  ? `Saving… (${uploadProgress?.done ?? 0}/${uploadProgress?.total ?? previewRows.parsed.length})`
                  : `Save ${previewRows.parsed.length} Rows`}
              </Button>
            </div>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {previewRows.parsed.map((row, i) => {
              const status = row._status;
              const locationId = row.location_id?.trim() || row._generated_id || "";
              const existing = locationId ? existingById[locationId] : null;
              const isNameMatch = status === "name_match";
              const isAutoGenerate = status === "auto_generate";
              const isNew = status === "new_with_id" || isAutoGenerate;
              const isUpdate = status === "update";
              const missingName = isNew && !row.name?.trim();

              const borderClass = isNameMatch
                ? "border-amber-300 bg-amber-50/30"
                : missingName ? "border-red-300 bg-red-50/30"
                : "border-border bg-muted/20";

              return (
                <div key={i} className={`rounded-xl p-3 text-xs border ${borderClass}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isUpdate && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">UPDATE</span>}
                        {(isNew && !isAutoGenerate) && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">NEW</span>}
                        {isAutoGenerate && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">NEW · ID will be generated</span>}
                        {isNameMatch && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 flex items-center gap-0.5"><AlertTriangleIcon className="w-2.5 h-2.5" /> NAME MATCH — Review required</span>}
                        <p className="font-semibold text-sm">{row.name || existing?.name || "—"}</p>
                        {row.city && <span className="text-muted-foreground text-xs">({row.city})</span>}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        ID: {isAutoGenerate ? <span className="text-violet-600 font-mono">{row._generated_id} (auto)</span> : locationId || <span className="text-red-500">missing</span>}
                      </p>
                      {isNameMatch && (
                        <div className="mt-1.5 p-2 rounded-lg bg-amber-100 border border-amber-200">
                          <p className="text-[10px] text-amber-800 font-medium">⚠ Found existing location: <span className="font-mono">{row._matched_loc?.location_id}</span> — {row._matched_loc?.name}</p>
                          <p className="text-[10px] text-amber-700 mt-0.5">This row has no location_id. Confirm below to apply as update to the matched record.</p>
                          <button
                            onClick={() => confirmNameMatch(i)}
                            className="mt-1.5 px-2 py-1 rounded bg-amber-600 text-white text-[10px] font-semibold hover:bg-amber-700"
                          >
                            ✓ Confirm — update matched location
                          </button>
                        </div>
                      )}
                      {isAutoGenerate && <p className="text-[10px] text-violet-600 mt-0.5">No existing location found — will create new with auto-generated ID</p>}
                      {isNew && !isAutoGenerate && <p className="text-[10px] text-green-600 mt-0.5">Will create a new location</p>}
                      {isUpdate && (() => {
                        const updatingFields = previewCols.filter(c => !c.startsWith("_") && c !== "location_id" && row[c]?.trim());
                        const skippedFields = previewCols.filter(c => !c.startsWith("_") && c !== "location_id" && !row[c]?.trim());
                        return (
                          <div className="mt-1.5 space-y-1">
                            {updatingFields.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                <span className="text-[9px] text-blue-600 font-semibold">Updating:</span>
                                {updatingFields.map(f => (
                                  <span key={f} className="text-[9px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 font-mono">{f}</span>
                                ))}
                              </div>
                            )}
                            {skippedFields.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                <span className="text-[9px] text-muted-foreground font-semibold">Blank (keeping existing):</span>
                                {skippedFields.map(f => (
                                  <span key={f} className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-mono">{f}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {missingName && <p className="text-[10px] text-red-600 font-medium mt-0.5">⚠ name is required for new records</p>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeRow(i)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  {isUpdate && (
                    <div className="grid grid-cols-2 gap-1.5 mt-2">
                      {previewCols.filter(c => !c.startsWith("_") && c !== "location_id" && row[c]?.trim()).map(col => (
                        <div key={col}>
                          <Label className="text-[9px] text-blue-600">{col}</Label>
                          <Input
                            value={row[col] ?? ""}
                            onChange={e => updateCell(i, col, e.target.value)}
                            className="h-6 text-[10px] px-2 border-blue-200"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {!isUpdate && (
                    <div className="grid grid-cols-2 gap-1.5 mt-2">
                      {previewCols.filter(c => !c.startsWith("_") && c !== "location_id" && row[c] !== undefined).slice(0, 8).map(col => (
                        <div key={col}>
                          <Label className="text-[9px] text-muted-foreground">{col}</Label>
                          <Input
                            value={row[col] ?? ""}
                            onChange={e => updateCell(i, col, e.target.value)}
                            className="h-6 text-[10px] px-2"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}