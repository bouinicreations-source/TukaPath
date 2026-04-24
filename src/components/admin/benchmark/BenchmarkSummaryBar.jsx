export default function BenchmarkSummaryBar({ total, passing, results }) {
  const allPass = passing === total;
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${allPass ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
      <span className={`text-sm font-bold ${allPass ? "text-emerald-800" : "text-amber-800"}`}>
        {passing}/{total} passing
      </span>
      <div className="flex flex-wrap gap-1.5">
        {results.map(({ id, result }) => {
          if (!result || result.loading || result.error) return null;
          return (
            <span key={id} className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${result.overall === "PASS" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
              {id}
            </span>
          );
        })}
      </div>
    </div>
  );
}