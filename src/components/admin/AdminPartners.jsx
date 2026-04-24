import React, { useState, useEffect } from "react";
import { base44 } from "@/api/client";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, Link2, Eye, EyeOff, RefreshCw } from "lucide-react";

const STATUS_CONFIG = {
  pending:   { color: "bg-amber-100 text-amber-700",   icon: Clock },
  approved:  { color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  rejected:  { color: "bg-red-100 text-red-700",       icon: XCircle },
  suspended: { color: "bg-slate-100 text-slate-600",   icon: XCircle },
};

// ─── Partner Row ──────────────────────────────────────────────────────────────

function PartnerRow({ partner, locations, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [experiences, setExperiences] = useState([]);
  const [loadingExps, setLoadingExps] = useState(false);
  const [linkLocationId, setLinkLocationId] = useState(partner.location_id || "");
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState(partner.admin_notes || "");

  const config = STATUS_CONFIG[partner.status] || STATUS_CONFIG.pending;
  const Icon = config.icon;

  const loadExperiences = async () => {
    setLoadingExps(true);
    const exps = await base44.entities.PartnerExperience.filter({ partner_id: partner.id });
    setExperiences(exps);
    setLoadingExps(false);
  };

  const toggle = () => {
    setExpanded(e => !e);
    if (!expanded && experiences.length === 0) loadExperiences();
  };

  const updateStatus = async (status) => {
    setSaving(true);
    await base44.entities.PartnerAccount.update(partner.id, { status, admin_notes: notes });
    setSaving(false);
    onRefresh();
  };

  const linkLocation = async () => {
    if (!linkLocationId) return;
    const loc = locations.find(l => l.id === linkLocationId);
    setSaving(true);
    await base44.entities.PartnerAccount.update(partner.id, {
      location_id: linkLocationId,
      location_name: loc?.name || "",
      location_link_status: "approved",
    });
    setSaving(false);
    onRefresh();
  };

  const toggleExpApproval = async (exp) => {
    await base44.entities.PartnerExperience.update(exp.id, { admin_approved: !exp.admin_approved });
    setExperiences(prev => prev.map(e => e.id === exp.id ? { ...e, admin_approved: !e.admin_approved } : e));
  };

  const toggleExpVisible = async (exp) => {
    await base44.entities.PartnerExperience.update(exp.id, { is_active: !exp.is_active });
    setExperiences(prev => prev.map(e => e.id === exp.id ? { ...e, is_active: !e.is_active } : e));
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors" onClick={toggle}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">{partner.business_name}</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 ${config.color}`}>
              <Icon className="w-2.5 h-2.5" /> {partner.status}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">{partner.category} · {partner.contact_email}</p>
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="border-t border-border px-4 py-4 space-y-4 bg-muted/5">
              {/* Status controls */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Account Status</p>
                <div className="flex gap-2 flex-wrap">
                  {["pending", "approved", "rejected", "suspended"].map(s => (
                    <button key={s} onClick={() => updateStatus(s)}
                      className={`text-[11px] px-3 py-1.5 rounded-lg font-medium border transition-colors ${partner.status === s ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/40"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Admin notes */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Admin Notes</p>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-muted/50 border border-border text-xs focus:outline-none focus:border-primary/40 resize-none" />
                <button onClick={() => updateStatus(partner.status)}
                  className="mt-1.5 text-xs text-primary hover:underline">{saving ? "Saving…" : "Save notes"}</button>
              </div>

              {/* Location link */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Link to Location</p>
                {partner.location_id && partner.location_link_status === "approved" ? (
                  <p className="text-xs text-emerald-600 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Linked to: {partner.location_name}
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <select value={linkLocationId} onChange={e => setLinkLocationId(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-muted/50 border border-border text-xs focus:outline-none focus:border-primary/40">
                      <option value="">— Select a location —</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.city})</option>)}
                    </select>
                    <Button size="sm" className="rounded-xl text-xs gap-1" onClick={linkLocation} disabled={!linkLocationId || saving}>
                      <Link2 className="w-3 h-3" /> Link
                    </Button>
                  </div>
                )}
              </div>

              {/* Experiences */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Experiences</p>
                  <button onClick={loadExperiences} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <RefreshCw className="w-2.5 h-2.5" /> Refresh
                  </button>
                </div>

                {loadingExps ? (
                  <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin" />
                ) : experiences.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No experiences yet.</p>
                ) : (
                  <div className="space-y-2">
                    {experiences.map(exp => (
                      <div key={exp.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{exp.title}</p>
                          <p className="text-[10px] text-muted-foreground">{exp.experience_type?.replace(/_/g, " ")} · {exp.price > 0 ? `${exp.price} ${exp.currency}` : "Free"}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${exp.admin_approved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {exp.admin_approved ? "Approved" : "Pending"}
                          </span>
                          <button onClick={() => toggleExpApproval(exp)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Toggle approval">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => toggleExpVisible(exp)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Toggle visibility">
                            {exp.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminPartners() {
  const [partners, setPartners] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [p, l] = await Promise.all([
      base44.entities.PartnerAccount.list("-created_date", 100),
      base44.entities.Location.filter({ review_status: "approved" }, "name", 500),
    ]);
    setPartners(p);
    setLocations(l);
    setLoading(false);
  };

  const filtered = filter === "all" ? partners : partners.filter(p => p.status === filter);
  const pendingCount = partners.filter(p => p.status === "pending").length;

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: partners.length, color: "text-foreground" },
          { label: "Pending", value: pendingCount, color: "text-amber-600" },
          { label: "Approved", value: partners.filter(p => p.status === "approved").length, color: "text-emerald-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-3 text-center">
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {["all", "pending", "approved", "rejected", "suspended"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors relative ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            {f === "pending" && pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">{pendingCount}</span>
            )}
          </button>
        ))}
        <button onClick={load} className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="text-center py-8 text-sm text-muted-foreground">No partners found.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <PartnerRow key={p.id} partner={p} locations={locations} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  );
}