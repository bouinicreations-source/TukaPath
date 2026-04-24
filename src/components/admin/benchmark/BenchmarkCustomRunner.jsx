import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function BenchmarkCustomRunner({ onRun, running }) {
  const [inp, setInp] = useState({
    startLat: 25.2048, startLng: 55.2708,
    destLat: 25.2854, destLng: 51.5310,
    destName: "Doha", timeMinutes: 180,
    description: "scenic drive", themes: [],
  });
  const [mode, setMode] = useState("drive");
  const [routeStyle, setRouteStyle] = useState("scenic");

  return (
    <div className="p-4 rounded-xl border border-border bg-card space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Custom Benchmark Run</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {[
          { key: "startLat", label: "Start Lat" },
          { key: "startLng", label: "Start Lng" },
          { key: "destLat", label: "Dest Lat" },
          { key: "destLng", label: "Dest Lng" },
          { key: "timeMinutes", label: "Minutes" },
          { key: "description", label: "Description" },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="block text-[10px] text-muted-foreground mb-0.5">{label}</label>
            <input
              type={typeof inp[key] === "number" ? "number" : "text"}
              value={inp[key] ?? ""}
              onChange={e => setInp(prev => ({
                ...prev,
                [key]: typeof prev[key] === "number" ? parseFloat(e.target.value) : e.target.value,
              }))}
              className="w-full px-2 py-1 rounded-lg border border-border bg-background text-xs font-mono focus:outline-none"
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        {["drive", "walk", "motorcycle"].map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`text-xs px-3 py-1 rounded-lg border transition-colors ${mode === m ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
            {m}
          </button>
        ))}
        {["standard", "scenic"].map(s => (
          <button key={s} onClick={() => setRouteStyle(s)}
            className={`text-xs px-3 py-1 rounded-lg border transition-colors ${routeStyle === s ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
            {s}
          </button>
        ))}
      </div>
      <Button size="sm" onClick={() => onRun({ ...inp, mode, routeStyle })} disabled={running} className="rounded-lg">
        Run Custom
      </Button>
    </div>
  );
}