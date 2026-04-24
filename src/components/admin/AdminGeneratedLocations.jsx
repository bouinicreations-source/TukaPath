/**
 * AdminGeneratedLocations
 *
 * Two tabs:
 * 1. Coverage — log of recent ingestion activity (saved/needs_review/blocked/failed)
 * 2. Enrichment — manual selection + explicit batch run only
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/client";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import CoverageTab from "./generatedlocations/CoverageTab";
import EnrichmentTab from "./generatedlocations/EnrichmentTab";

const TABS = [
  { key: "coverage",    label: "Coverage" },
  { key: "enrichment",  label: "Enrichment" },
];

export default function AdminGeneratedLocations() {
  const [activeTab, setActiveTab] = useState("coverage");
  const [clearing, setClearing] = useState(false);

  const handleClearAllStale = async () => {
    if (!confirm("Clear ALL stuck processing items from the old queue? This does NOT delete any saved Location records.")) return;
    setClearing(true);
    try {
      const res = await base44.functions.invoke("clearOldQueue", {});
      toast.success(res.data?.message || "Queue cleared");
    } catch (e) {
      toast.error("Clear failed: " + e.message);
    }
    setClearing(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-bold">Generated Locations</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Coverage saves immediately · Enrichment is manual only</p>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={handleClearAllStale}
          disabled={clearing}
          className="gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {clearing ? "Clearing…" : "Clear Old Queue"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "coverage"   && <CoverageTab />}
      {activeTab === "enrichment" && <EnrichmentTab />}
    </div>
  );
}