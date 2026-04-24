import { useState } from "react";
import { base44 } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

const STATUS_COLORS = {
  ready: "bg-green-100 text-green-700",
  missing: "bg-muted text-muted-foreground",
  failed: "bg-red-100 text-red-600",
  generating: "bg-yellow-100 text-yellow-700",
};

export default function AdminTranslations() {
  const [filterLang, setFilterLang] = useState("all");
  const [filterText, setFilterText] = useState("all");
  const [filterAudio, setFilterAudio] = useState("all");

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["location-translations"],
    queryFn: () => base44.entities.LocationTranslation.list("-generated_at", 200),
  });

  const filtered = records.filter((r) => {
    if (filterLang !== "all" && r.language_code !== filterLang) return false;
    if (filterText !== "all" && r.text_status !== filterText) return false;
    if (filterAudio !== "all" && r.audio_status !== filterAudio) return false;
    return true;
  });

  const langs = [...new Set(records.map(r => r.language_code))].sort();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold mb-1">Translation Records</h2>
        <p className="text-xs text-muted-foreground">{records.length} total records</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 text-xs">
        <select value={filterLang} onChange={e => setFilterLang(e.target.value)}
          className="border border-input rounded-md px-2 py-1 bg-background text-foreground text-xs">
          <option value="all">All languages</option>
          {langs.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={filterText} onChange={e => setFilterText(e.target.value)}
          className="border border-input rounded-md px-2 py-1 bg-background text-foreground text-xs">
          <option value="all">Any text status</option>
          <option value="ready">Text ready</option>
          <option value="missing">Text missing</option>
          <option value="failed">Text failed</option>
        </select>
        <select value={filterAudio} onChange={e => setFilterAudio(e.target.value)}
          className="border border-input rounded-md px-2 py-1 bg-background text-foreground text-xs">
          <option value="all">Any audio status</option>
          <option value="ready">Audio ready</option>
          <option value="missing">Audio missing</option>
          <option value="generating">Generating</option>
          <option value="failed">Audio failed</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No translation records found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Location ID</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Lang</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Name</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Text</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Audio</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Generated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground max-w-[120px] truncate">{r.location_id}</td>
                  <td className="px-3 py-2 font-bold uppercase">{r.language_code}</td>
                  <td className="px-3 py-2 max-w-[140px] truncate">{r.name || <span className="text-muted-foreground italic">—</span>}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[r.text_status] || STATUS_COLORS.missing}`}>
                      {r.text_status || "missing"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[r.audio_status] || STATUS_COLORS.missing}`}>
                      {r.audio_status || "missing"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.generated_at ? new Date(r.generated_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}