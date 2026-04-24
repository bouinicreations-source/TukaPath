import React from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowUpDown } from "lucide-react";

export default function BulkGenFilters({ filters, onChange, totalCount, visibleCount, selectedCount }) {
  return (
    <div className="flex flex-wrap items-center gap-4 py-3 px-4 bg-muted/40 rounded-xl border border-border text-sm">
      <span className="text-xs text-muted-foreground font-medium">
        Showing <strong>{visibleCount}</strong> of {totalCount} · <strong>{selectedCount}</strong> selected
      </span>

      <div className="flex items-center gap-2 ml-auto flex-wrap">
        {/* Show existing (duplicates shown when OFF, hidden when ON) */}
        <div className="flex items-center gap-1.5">
          <Switch
            id="hide-dups"
            checked={!filters.hideDuplicates}
            onCheckedChange={v => onChange({ hideDuplicates: !v })}
            className="scale-75"
          />
          <Label htmlFor="hide-dups" className="text-xs cursor-pointer text-muted-foreground">Show already-existing places</Label>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1">
          <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
          <select
            value={filters.sortBy}
            onChange={e => onChange({ sortBy: e.target.value })}
            className="text-xs border border-border rounded-md px-2 py-1 bg-background"
          >
            <option value="default">Default order</option>
            <option value="rating">Sort by rating</option>
            <option value="reviews">Sort by reviews</option>
            <option value="name">Sort by name</option>
          </select>
        </div>
      </div>
    </div>
  );
}