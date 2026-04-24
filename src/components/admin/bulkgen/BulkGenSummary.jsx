import React from "react";

export default function BulkGenSummary({ meta }) {
  if (!meta) return null;

  const topStats = [
    { label: "Fetched",          value: meta.total_fetched,                    color: "text-foreground" },
    { label: "Type gate",        value: meta.total_after_type_gate ?? "—",     color: "text-blue-600" },
    { label: "Quality gate",     value: meta.total_after_quality_gate ?? "—",  color: "text-violet-600" },
    { label: "Clean new",        value: meta.new_places ?? 0,                  color: "text-emerald-600" },
  ];

  const grayZoneCount = meta.gray_zone_count ?? 0;

  const bottomStats = [
    { label: "Probable dupes",   value: meta.probable_duplicates_found || 0,   color: "text-amber-600" },
    { label: "Hard dupes (hidden)", value: meta.duplicates_found || 0,         color: "text-red-500" },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {topStats.map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl px-3 py-3 text-center">
            <div className={`text-lg font-bold ${color}`}>{value}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{label}</div>
          </div>
        ))}
      </div>
      {grayZoneCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-50 border border-violet-200">
          <span className="text-sm font-bold text-violet-700">{grayZoneCount}</span>
          <span className="text-[11px] text-violet-600">borderline place{grayZoneCount !== 1 ? "s" : ""} — AI review available</span>
        </div>
      )}
      {(meta.probable_duplicates_found > 0 || meta.duplicates_found > 0) && (
        <div className="grid grid-cols-2 gap-2">
          {bottomStats.map(({ label, value, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl px-3 py-2 text-center">
              <div className={`text-base font-bold ${color}`}>{value}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}