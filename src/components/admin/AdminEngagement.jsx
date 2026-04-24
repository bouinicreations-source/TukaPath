import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { subDays, format, startOfDay, parseISO, isAfter } from "date-fns";

const EVENT_COLORS = {
  location_opened: "#16a34a",
  story_opened: "#2563eb",
  quick_played: "#d97706",
  full_played: "#7c3aed",
};

const EVENT_LABELS = {
  location_opened: "Places Viewed",
  story_opened: "Stories Opened",
  quick_played: "Quick Listens",
  full_played: "Full Listens",
};

const RANGES = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

export default function AdminEngagement() {
  const [rangeDays, setRangeDays] = useState(30);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["interaction-logs"],
    queryFn: () => base44.entities.InteractionLog.list("-timestamp", 9999),
    staleTime: 60_000,
  });

  const cutoff = useMemo(() => startOfDay(subDays(new Date(), rangeDays)), [rangeDays]);

  const filtered = useMemo(
    () => logs.filter(l => l.timestamp && isAfter(parseISO(l.timestamp), cutoff)),
    [logs, cutoff]
  );

  const summary = useMemo(() => {
    const counts = { location_opened: 0, story_opened: 0, quick_played: 0, full_played: 0 };
    filtered.forEach(l => { if (counts[l.event_type] !== undefined) counts[l.event_type]++; });
    return counts;
  }, [filtered]);

  const chartData = useMemo(() => {
    const days = {};
    for (let i = rangeDays; i >= 0; i--) {
      const key = format(subDays(new Date(), i), "MMM d");
      days[key] = { date: key, location_opened: 0, story_opened: 0, quick_played: 0, full_played: 0 };
    }
    filtered.forEach(l => {
      const key = format(parseISO(l.timestamp), "MMM d");
      if (days[key] && days[key][l.event_type] !== undefined) days[key][l.event_type]++;
    });
    return Object.values(days);
  }, [filtered, rangeDays]);

  const summaryCards = [
    { key: "location_opened", label: "Places Viewed", color: "text-green-600" },
    { key: "story_opened", label: "Stories Opened", color: "text-blue-600" },
    { key: "quick_played", label: "Quick Listens", color: "text-amber-600" },
    { key: "full_played", label: "Full Listens", color: "text-purple-600" },
  ];

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Range selector */}
      <div className="flex gap-2 flex-wrap">
        {RANGES.map(r => (
          <Button
            key={r.days}
            variant={rangeDays === r.days ? "default" : "outline"}
            size="sm"
            className="text-xs h-8"
            onClick={() => setRangeDays(r.days)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summaryCards.map(({ key, label, color }) => (
          <Card key={key} className="p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{summary[key].toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </Card>
        ))}
      </div>

      {/* Daily chart */}
      <Card className="p-4">
        <p className="text-sm font-semibold mb-4">Daily Engagement</p>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} interval={Math.floor(rangeDays / 7)} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12 }} formatter={(val, name) => [val, EVENT_LABELS[name] || name]} />
            <Legend formatter={name => EVENT_LABELS[name] || name} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            {Object.keys(EVENT_COLORS).map(key => (
              <Line key={key} type="monotone" dataKey={key} stroke={EVENT_COLORS[key]} dot={false} strokeWidth={2} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <p className="text-xs text-muted-foreground text-center">Showing last {rangeDays} days · {filtered.length.toLocaleString()} events recorded</p>
    </div>
  );
}