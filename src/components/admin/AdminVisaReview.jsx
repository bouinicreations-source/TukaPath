import React, { useState } from "react";
import { supabase } from '@/api/supabase';
import { base44 } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, Clock, Search, ChevronDown, ChevronUp, Download } from "lucide-react";
import { toast } from "sonner";
import { VISA_TYPES, ENTRY_STATUSES, APPLICATION_ROUTES } from "@/components/visa/visaLogic";

export default function AdminVisaReview() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [ruleEdit, setRuleEdit] = useState({});

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["visa-feedback"],
    queryFn: () => base44.entities.VisaFeedback.list("-created_date"),
  });

  const { data: baseRules = [] } = useQuery({
    queryKey: ["visa-base-rules"],
    queryFn: () => base44.entities.VisaBaseRule.list(),
  });

  const { data: currentUser } = useQuery({
    queryKey: ["me"],
    queryFn: () => supabase.auth.getUser().then(r => r.data.user),
  });

  const logAudit = (entityType, entityId, action, oldVal, newVal) => {
    base44.entities.VisaAuditLog.create({
      entity_type: entityType, entity_id: entityId, action,
      changed_by: currentUser?.email || "admin",
      old_value: oldVal ? JSON.stringify(oldVal) : "",
      new_value: newVal ? JSON.stringify(newVal) : "",
    }).catch(() => {});
  };

  const markReviewed = async (s) => {
    await base44.entities.VisaFeedback.update(s.id, { status: "reviewed" });
    logAudit("VisaFeedback", s.id, "review", { status: "pending" }, { status: "reviewed" });
    queryClient.invalidateQueries({ queryKey: ["visa-feedback"] });
    toast.success("Marked as reviewed");
  };

  const updateBaseRule = async (submission) => {
    const edit = ruleEdit[submission.id];
    if (!edit) return;
    const existing = baseRules.find(r =>
      r.passport_country?.toLowerCase().trim() === submission.passport_country?.toLowerCase().trim() &&
      r.destination_country?.toLowerCase().trim() === submission.destination_country?.toLowerCase().trim()
    );
    if (existing) {
      logAudit("VisaBaseRule", existing.id, "update", existing, { ...existing, ...edit });
      await base44.entities.VisaBaseRule.update(existing.id, edit);
      toast.success("Base Rule updated");
    } else {
      const created = await base44.entities.VisaBaseRule.create({
        passport_country: submission.passport_country,
        destination_country: submission.destination_country,
        ...edit,
      });
      logAudit("VisaBaseRule", created.id, "create", null, edit);
      toast.success("New Base Rule created");
    }
    queryClient.invalidateQueries({ queryKey: ["visa-base-rules"] });
    await markReviewed(submission);
    setExpandedId(null);
  };

  const filtered = submissions.filter(s =>
    (s.passport_country || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.destination_country || "").toLowerCase().includes(search.toLowerCase())
  );

  const pending = submissions.filter(s => s.status === "pending");
  const reviewed = submissions.filter(s => s.status === "reviewed");

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>;

  const handleExport = () => {
    const fields = ["passport_country","residence_country","destination_country","has_us_visa","has_uk_visa","has_schengen_visa","result_shown","user_note","status","created_date"];
    const header = fields.join(",");
    const lines = submissions.map(r => fields.map(f => `"${String(r[f] ?? "").replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "visa_reviews_export.csv"; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center flex-wrap justify-between">
        <div className="flex gap-2 items-center">
          <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full">{pending.length} pending</span>
          <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">{reviewed.length} reviewed</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="text-xs" onClick={handleExport}>
            <Download className="w-3 h-3 mr-1" /> Download Data
          </Button>
        </div>
      </div>
      <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Filter by passport / destination..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-xs" />
      </div>

      {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No feedback submissions yet.</p>}

      {filtered.map(s => {
        const isOpen = expandedId === s.id;
        const existingRule = baseRules.find(r =>
          r.passport_country?.toLowerCase().trim() === s.passport_country?.toLowerCase().trim() &&
          r.destination_country?.toLowerCase().trim() === s.destination_country?.toLowerCase().trim()
        );
        const edit = ruleEdit[s.id] || {};

        return (
          <Card key={s.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-sm font-semibold flex-wrap">
                  <span>{s.passport_country}</span>
                  {s.residence_country && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">living in {s.residence_country}</span>}
                  <span className="text-muted-foreground">→</span>
                  <span>{s.destination_country}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">System showed: <strong>{s.result_shown}</strong></p>
              </div>
              <Badge variant={s.status === "pending" ? "outline" : "secondary"} className="text-xs flex-shrink-0">
                {s.status === "pending" ? <Clock className="w-3 h-3 mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                {s.status}
              </Badge>
            </div>

            <div className="flex gap-2 flex-wrap text-[10px]">
              {s.has_us_visa && <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">🇺🇸 US Visa</span>}
              {s.has_uk_visa && <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full">🇬🇧 UK Visa</span>}
              {s.has_schengen_visa && <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">🇪🇺 Schengen</span>}
            </div>

            {s.user_note && <p className="text-xs bg-muted/40 rounded-lg px-3 py-2 text-muted-foreground">💬 "{s.user_note}"</p>}
            <p className="text-[10px] text-muted-foreground">Submitted: {new Date(s.created_date).toLocaleDateString()}</p>

            {s.status === "pending" && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => markReviewed(s)}>
                  <CheckCircle className="w-3 h-3 mr-1" /> Mark Reviewed
                </Button>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setExpandedId(isOpen ? null : s.id)}>
                  {isOpen ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                  {isOpen ? "Close" : "Update Rule"}
                </Button>
              </div>
            )}

            {isOpen && (
              <div className="bg-muted/30 rounded-xl p-4 space-y-3 mt-2">
                <p className="text-xs font-semibold">
                  {existingRule ? "Edit Existing Base Rule" : "Create New Base Rule"} for {s.passport_country} → {s.destination_country}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Visa Type</Label>
                    <Select value={edit.visa_type || existingRule?.visa_type || "Visa Required"} onValueChange={v => setRuleEdit(r => ({ ...r, [s.id]: { ...r[s.id], visa_type: v } }))}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{VISA_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Entry Status</Label>
                    <Select value={edit.entry_status || existingRule?.entry_status || "Open"} onValueChange={v => setRuleEdit(r => ({ ...r, [s.id]: { ...r[s.id], entry_status: v } }))}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{ENTRY_STATUSES.map(st => <SelectItem key={st} value={st} className="text-xs">{st}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Application Route</Label>
                    <Select value={edit.application_route || existingRule?.application_route || ""} onValueChange={v => setRuleEdit(r => ({ ...r, [s.id]: { ...r[s.id], application_route: v } }))}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{APPLICATION_ROUTES.map(rt => <SelectItem key={rt} value={rt} className="text-xs">{rt}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Cost (USD)</Label>
                    <Input type="number" defaultValue={existingRule?.visa_cost_usd || 0} onChange={e => setRuleEdit(r => ({ ...r, [s.id]: { ...r[s.id], visa_cost_usd: Number(e.target.value) } }))} className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Processing Days</Label>
                    <Input type="number" defaultValue={existingRule?.processing_days || 0} onChange={e => setRuleEdit(r => ({ ...r, [s.id]: { ...r[s.id], processing_days: Number(e.target.value) } }))} className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Duration Days</Label>
                    <Input type="number" defaultValue={existingRule?.visa_duration_days || 0} onChange={e => setRuleEdit(r => ({ ...r, [s.id]: { ...r[s.id], visa_duration_days: Number(e.target.value) } }))} className="h-7 text-xs" />
                  </div>
                </div>
                <Button size="sm" className="text-xs h-7 w-full bg-primary" onClick={() => updateBaseRule(s)}>
                  {existingRule ? "Update Base Rule & Mark Reviewed" : "Create Base Rule & Mark Reviewed"}
                </Button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}