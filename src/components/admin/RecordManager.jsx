import React, { useState, useEffect } from "react";
import { base44 } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, CheckCircle, XCircle, Download, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

function exportRowsToCSV(rows, fields, filename) {
  const header = ["source", ...fields].join(",");
  const lines = rows.map(r =>
    ["", ...fields].map(f => `"${String(r[f] ?? "").replace(/"/g, '""')}"`).join(",")
  );
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = filename; a.click();
}

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="p-6 max-w-sm w-full mx-4 space-y-4">
        <p className="text-sm font-semibold">{message}</p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" className="flex-1" onClick={onConfirm}>Confirm</Button>
        </div>
      </Card>
    </div>
  );
}

export default function RecordManager({
  entity,
  label,
  displayFields,
  supportsApproval = false,
  statusField = "status",
  approvedValue = "approved",
  rejectedValue = "rejected",
}) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [confirm, setConfirm] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities[entity].list();
    setRecords(data);
    setSelected(new Set());
    setLoading(false);
  };

  useEffect(() => { if (expanded) load(); }, [expanded, entity]);

  const toggleAll = (e) => {
    if (e.target.checked) setSelected(new Set(records.map(r => r.id)));
    else setSelected(new Set());
  };

  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedList = records.filter(r => selected.has(r.id));

  const handleDelete = () => {
    setConfirm({
      message: `Delete ${selected.size} record(s)? This cannot be undone.`,
      action: async () => {
        for (const id of selected) await base44.entities[entity].delete(id);
        toast.success(`${selected.size} records deleted`);
        load();
      }
    });
  };

  const handleApprove = () => {
    setConfirm({
      message: `Approve ${selected.size} record(s)?`,
      action: async () => {
        for (const id of selected) await base44.entities[entity].update(id, { [statusField]: approvedValue });
        toast.success(`${selected.size} records approved`);
        load();
      }
    });
  };

  const handleReject = () => {
    setConfirm({
      message: `Reject ${selected.size} record(s)?`,
      action: async () => {
        for (const id of selected) await base44.entities[entity].update(id, { [statusField]: rejectedValue });
        toast.success(`${selected.size} records rejected`);
        load();
      }
    });
  };

  const handleExportSelected = () => {
    const fields = displayFields.map(f => f.key);
    exportRowsToCSV(selectedList.map(r => ({ source: entity, ...r })), ["source", ...fields], `${entity}_selected.csv`);
  };

  return (
    <div className="mt-4 border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/70 transition-colors text-sm font-semibold"
      >
        <span>Manage Records — {label}</span>
        <div className="flex items-center gap-2">
          {records.length > 0 && !loading && (
            <Badge variant="secondary" className="text-xs">{records.length}</Badge>
          )}
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {expanded && (
        <div>
          {/* Bulk Action Bar */}
          {selected.size > 0 && (
            <div className="sticky top-0 z-10 bg-primary text-primary-foreground px-4 py-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold mr-2">{selected.size} selected</span>
              {supportsApproval && (
                <>
                  <Button size="sm" variant="secondary" className="h-7 text-xs gap-1" onClick={handleApprove}>
                    <CheckCircle className="w-3 h-3" /> Approve
                  </Button>
                  <Button size="sm" variant="secondary" className="h-7 text-xs gap-1" onClick={handleReject}>
                    <XCircle className="w-3 h-3" /> Reject
                  </Button>
                </>
              )}
              <Button size="sm" variant="secondary" className="h-7 text-xs gap-1" onClick={handleExportSelected}>
                <Download className="w-3 h-3" /> Export
              </Button>
              <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={handleDelete}>
                <Trash2 className="w-3 h-3" /> Delete
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-primary-foreground/70" onClick={() => setSelected(new Set())}>
                Cancel
              </Button>
            </div>
          )}

          {/* Table Header */}
          <div className="px-4 py-2 flex items-center justify-between border-b border-border bg-muted/20">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                className="w-3.5 h-3.5"
                checked={records.length > 0 && selected.size === records.length}
                onChange={toggleAll}
              />
              <span className="text-xs text-muted-foreground">Select all</span>
            </div>
            <button onClick={load} disabled={loading} className="text-muted-foreground hover:text-foreground">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Records */}
          <div className="max-h-96 overflow-y-auto divide-y divide-border">
            {loading ? (
              <div className="py-8 text-center text-xs text-muted-foreground">Loading...</div>
            ) : records.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No records found</div>
            ) : records.map(r => (
              <div
                key={r.id}
                onClick={() => toggleOne(r.id)}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-xs transition-colors ${selected.has(r.id) ? "bg-primary/10" : "hover:bg-muted/30"}`}
              >
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 flex-shrink-0"
                  checked={selected.has(r.id)}
                  onChange={() => {}}
                  onClick={e => e.stopPropagation()}
                />
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 flex-1 min-w-0">
                  {displayFields.map(f => (
                    <div key={f.key} className="truncate">
                      <span className="text-muted-foreground">{f.label}: </span>
                      <span className="font-medium">{String(r[f.key] ?? "—")}</span>
                    </div>
                  ))}
                </div>
                {supportsApproval && r[statusField] && (
                  <Badge
                    variant={r[statusField] === approvedValue ? "default" : r[statusField] === rejectedValue ? "destructive" : "secondary"}
                    className="text-[10px] flex-shrink-0"
                  >
                    {r[statusField]}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={async () => { await confirm.action(); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}