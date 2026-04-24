import { useState } from "react";
import { base44 } from "@/api/client";
import { Button } from "@/components/ui/button";
import BenchmarkSummaryBar from "./benchmark/BenchmarkSummaryBar";
import BenchmarkCard from "./benchmark/BenchmarkCard";
import BenchmarkCustomRunner from "./benchmark/BenchmarkCustomRunner";

const BENCHMARK_IDS = ["BM01", "BM02", "BM03", "BM04", "BM05", "BM06", "BM07", "BM08"];

const BENCHMARK_LABELS = {
  BM01: "Dubai → Doha",
  BM02: "Dubai → Al Zubara",
  BM03: "Doha → Salwa",
  BM04: "Dubai → Fujairah",
  BM05: "Malaga → Cordoba (EU)",
  BM06: "Al Khor (force gen)",
  BM07: "Motorcycle Dxb→Fujairah",
  BM08: "Milan → Geneva (Alpine)",
};

export default function AdminJourneyDebug() {
  const [running, setRunning] = useState(false);
  const [runningId, setRunningId] = useState(null);
  const [results, setResults] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  const runBenchmark = async (benchmarkId, customInput) => {
    setRunning(true);
    setRunningId(benchmarkId);
    setResults(prev => ({ ...prev, [benchmarkId]: { loading: true } }));
    try {
      // Step 1: get benchmark spec from runner
      const specRes = await base44.functions.invoke("runBenchmark", {
        benchmark_id: benchmarkId,
        ...(benchmarkId === "CUSTOM" ? { custom_input: customInput, custom_mode: customInput?.mode, custom_routeStyle: customInput?.routeStyle } : {}),
      });
      const spec = specRes.data?.spec;
      const inp  = spec?.input || customInput || {};
      const bMode = spec?.mode || customInput?.mode || "drive";
      const bStyle = spec?.routeStyle || customInput?.routeStyle || "scenic";

      // Step 2: call buildJourneyV2 with user auth
      const journeyRes = await base44.functions.invoke("buildJourneyV2", {
        description: inp.description || "",
        startLat:    inp.startLat,
        startLng:    inp.startLng,
        destLat:     inp.destLat || null,
        destLng:     inp.destLng || null,
        destName:    inp.destName || null,
        timeMinutes: inp.timeMinutes,
        mode:        bMode,
        routeStyle:  bStyle,
        themes:      inp.themes || [],
      });

      // Step 3: evaluate
      const evalRes = await base44.functions.invoke("runBenchmark", {
        benchmark_id:   benchmarkId,
        journey_result: journeyRes.data,
        ...(benchmarkId === "CUSTOM" ? { custom_input: customInput, custom_mode: bMode, custom_routeStyle: bStyle } : {}),
      });
      setResults(prev => ({ ...prev, [benchmarkId]: evalRes.data }));
    } catch (err) {
      setResults(prev => ({ ...prev, [benchmarkId]: { error: err.message } }));
    }
    setRunning(false);
    setRunningId(null);
  };

  const runAll = async () => {
    for (const id of BENCHMARK_IDS) {
      await runBenchmark(id);
    }
  };

  const completed = BENCHMARK_IDS.filter(id => results[id] && !results[id].loading && !results[id].error);
  const passing = completed.filter(id => results[id]?.overall === "PASS");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold">Journey Engine — Benchmark Harness</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          8 deterministic cases · Zone purity + early stop + anchor + constraint + strong&gt;many + scarcity + mode checks
        </p>
      </div>

      {completed.length > 0 && (
        <BenchmarkSummaryBar
          total={completed.length}
          passing={passing.length}
          results={BENCHMARK_IDS.map(id => ({ id, result: results[id] }))}
        />
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={runAll} disabled={running} className="rounded-lg">
          {running ? `Running ${runningId}…` : "▶ Run All 8 Benchmarks"}
        </Button>
        {BENCHMARK_IDS.map(id => (
          <Button key={id} size="sm" variant="outline"
            onClick={() => runBenchmark(id)} disabled={running} className="rounded-lg text-xs">
            {results[id] && !results[id].loading && !results[id].error
              ? (results[id].overall === "PASS" ? "✅ " : "❌ ")
              : ""}
            {id}: {BENCHMARK_LABELS[id]}
          </Button>
        ))}
      </div>

      <BenchmarkCustomRunner onRun={(inp) => runBenchmark("CUSTOM", inp)} running={running} />

      <div className="space-y-3">
        {BENCHMARK_IDS.map(id => {
          const result = results[id];
          if (!result) return null;
          return (
            <BenchmarkCard
              key={id}
              benchmarkId={id}
              label={BENCHMARK_LABELS[id]}
              result={result}
              expanded={expandedId === id}
              onToggle={() => setExpandedId(prev => prev === id ? null : id)}
            />
          );
        })}
        {results["CUSTOM"] && (
          <BenchmarkCard
            benchmarkId="CUSTOM"
            label="Custom Run"
            result={results["CUSTOM"]}
            expanded={expandedId === "CUSTOM"}
            onToggle={() => setExpandedId(prev => prev === "CUSTOM" ? null : "CUSTOM")}
          />
        )}
      </div>
    </div>
  );
}