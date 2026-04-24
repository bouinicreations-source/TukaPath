import React, { useState } from "react";
import { base44 } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Eye, CheckCircle2, XCircle, Edit3, ExternalLink, Trash2, Filter, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import CorrectionEditPanel from "./CorrectionEditPanel";

const STATUS_CONFIG = {
  pending:   { label: "Pending",   cls: "bg-amber-100 text-amber-700 border-amber-200" },
  in_review: { label: "In Review", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  approved:  { label: "Approved",  cls: "bg-green-100 text-green-700 border-green-200" },
  rejected:  { label: "Rejected",  cls: "bg-red-100 text-red-700 border-red-200" },
  applied:   { label: "Applied",   cls: "bg-primary/10 text-primary border-primary/20" },
};

const TYPE_LABELS = { location: "📍 Location", story: "📖 Story", visa: "🛂 Visa", other: "💡 Other" };

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return <Badge className={`text-[10px] border ${cfg.cls}`}>{cfg.label}</Badge>;
}

function CorrectionCard({ correction, onAction, onEditApply }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={`p-4 transition-all ${correction.status === "applied" || correction.status === "rejected" ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-semibold text-sm truncate">{correction.location_name || "Unknown Location"}</p>
            <StatusBadge status={correction.status} />
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">
              {TYPE_LABELS[correction.correction_type] || correction.correction_type}
            </span>
          </div>
          <p className={`text-xs text-muted-foreground leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
            {correction.message}
          </p>
          {correction.message?.length > 120 && (
            <button
              className="text-[10px] text-primary mt-0.5 hover:underline flex items-center gap-0.5"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Show less" : "Show more"} <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          )}
          <p className="text-[10px] text-muted-foreground mt-1.5">
            {new Date(correction.created_date).toLocaleDateString()} {new Date(correction.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          {correction.status === "applied" && correction.applied_at && (
            <p className="text-[10px] text-primary mt-0.5">✓ Applied {new Date(correction.applied_at).toLocaleDateString()}</p>
          )}
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          {(correction.status === "pending" || correction.status === "in_review") && (
            <>
              <Button
                size="sm"
                className="text-[10px] h-7 bg-primary hover:bg-primary/90 whitespace-nowrap"
                onClick={() => onEditApply(correction)}
              >
                <Edit3 className="w-3 h-3 mr-1" /> Approve & Edit
              </Button>
              {correction.location_id && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-[10px] h-7 whitespace-nowrap"
                  onClick={() => onAction("open", correction)}
                >
                  <ExternalLink className="w-3 h-3 mr-1" /> Open Location
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="text-[10px] h-7 text-green-700 border-green-200 hover:bg-green-50 whitespace-nowrap"
                onClick={() => onAction("approve", correction)}
              >
                <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-[10px] h-7 text-red-600 border-red-200 hover:bg-red-50 whitespace-nowrap"
                onClick={() => onAction("reject", correction)}
              >
                <XCircle className="w-3 h-3 mr-1" /> Reject
              </Button>
            </>
          )}
          {(correction.status === "approved" || correction.status === "applied") && correction.location_id && (
            <Button
              size="sm"
              variant="outline"
              className="text-[10px] h-7 whitespace-nowrap"
              onClick={() => onAction("open", correction)}
            >
              <ExternalLink className="w-3 h-3 mr-1" /> Open Location
            </Button>
          )}
          {(correction.status === "approved") && (
            <Button
              size="sm"
              className="text-[10px] h-7 bg-primary hover:bg-primary/90 whitespace-nowrap"
              onClick={() => onEditApply(correction)}
            >
              <Edit3 className="w-3 h-3 mr-1" /> Apply Now
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive mt-1"
            onClick={() => onAction("delete", correction)}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Applied content history */}
      {correction.status === "applied" && correction.final_content && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">Applied Content</p>
          <p className="text-[10px] text-muted-foreground whitespace-pre-wrap line-clamp-3">{correction.final_content}</p>
        </div>
      )}
    </Card>
  );
}

export default function AdminCorrectionReview() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [editCorrection, setEditCorrection] = useState(null);

  const { data: corrections = [] } = useQuery({
    queryKey: ["user-corrections"],
    queryFn: () => base44.entities.UserCorrection.list("-created_date", 200),
  });

  const filtered = corrections.filter(c => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (typeFilter !== "all" && c.correction_type !== typeFilter) return false;
    return true;
  });

  const counts = {
    pending: corrections.filter(c => c.status === "pending").length,
    in_review: corrections.filter(c => c.status === "in_review").length,
    approved: corrections.filter(c => c.status === "approved").length,
  };

  const handleAction = async (action, correction) => {
    const qc = () => queryClient.invalidateQueries({ queryKey: ["user-corrections"] });

    if (action === "delete") {
      if (!window.confirm("Delete this correction?")) return;
      await base44.entities.UserCorrection.delete(correction.id);
      qc();
      toast.success("Deleted");
      return;
    }

    if (action === "open") {
      // Open the location in LocationEditor via Admin tab
      // Mark as in_review if pending
      if (correction.status === "pending") {
        await base44.entities.UserCorrection.update(correction.id, { status: "in_review" });
        qc();
      }
      const sectionMap = { location: "", story: "&section=story", visa: "&section=visa", other: "" };
      const section = sectionMap[correction.correction_type] || "";
      window.open(`/LocationDetail?id=${correction.location_id}${section}`, "_blank");
      return;
    }

    if (action === "approve") {
      await base44.entities.UserCorrection.update(correction.id, { status: "approved" });
      qc();
      toast.success("Marked as Approved");
      return;
    }

    if (action === "reject") {
      await base44.entities.UserCorrection.update(correction.id, { status: "rejected" });
      qc();
      toast.success("Marked as Rejected");
    }
  };

  const handleEditApply = async (correction) => {
    if (correction.status === "pending") {
      await base44.entities.UserCorrection.update(correction.id, { status: "in_review" });
      queryClient.invalidateQueries({ queryKey: ["user-corrections"] });
    }
    setEditCorrection(correction);
  };

  const handleApplied = () => {
    setEditCorrection(null);
    queryClient.invalidateQueries({ queryKey: ["user-corrections"] });
  };

  if (editCorrection) {
    return (
      <CorrectionEditPanel
        correction={editCorrection}
        onClose={() => setEditCorrection(null)}
        onApplied={handleApplied}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Pending", count: counts.pending, cls: "bg-amber-50 border-amber-200 text-amber-700" },
          { label: "In Review", count: counts.in_review, cls: "bg-blue-50 border-blue-200 text-blue-700" },
          { label: "Approved", count: counts.approved, cls: "bg-green-50 border-green-200 text-green-700" },
        ].map(({ label, count, cls }) => (
          <div key={label} className={`rounded-xl border p-3 text-center ${cls}`}>
            <p className="text-xl font-bold">{count}</p>
            <p className="text-[10px] font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Status:</span>
        </div>
        {["all", "pending", "in_review", "approved", "applied", "rejected"].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
              statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border text-muted-foreground"
            }`}
          >
            {s === "all" ? "All" : STATUS_CONFIG[s]?.label || s}
          </button>
        ))}
        <span className="text-xs text-muted-foreground ml-2">Type:</span>
        {["all", "location", "story", "visa", "other"].map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
              typeFilter === t ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border text-muted-foreground"
            }`}
          >
            {t === "all" ? "All" : TYPE_LABELS[t] || t}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.map(c => (
          <CorrectionCard
            key={c.id}
            correction={c}
            onAction={handleAction}
            onEditApply={handleEditApply}
          />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-sm font-medium">No corrections found</p>
            <p className="text-xs mt-1">User suggestions will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}