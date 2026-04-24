/**
 * AdminAddMenu — Unified "Add +" entry point for all admin data creation.
 *
 * Usage:
 *   <AdminAddMenu onNavigate={(section, item) => ...} onAction={(action) => ...} />
 *
 * onNavigate: used to deep-link into the Admin panel (e.g. open Locations → Bulk Generator)
 * onAction:   used for inline actions that don't need navigation (e.g. open a modal in the current page)
 */

import React, { useRef, useEffect, useState } from "react";
import {
  Plus, PenLine, Wand2, Layers, Upload, ListChecks,
  Store, Globe, Plane, FileSpreadsheet, ChevronRight, X, BriefcaseMedical
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Menu sections ─────────────────────────────────────────────────────────────

const MENU_GROUPS = [
  {
    label: "Locations",
    color: "bg-emerald-50 text-emerald-700",
    items: [
      { id: "location_manual",    icon: PenLine,      label: "Add Location Manually",           description: "Create a new location record" },
      { id: "location_generate",  icon: Wand2,        label: "Generate via Google API",          description: "Discover & enrich locations in background" },
      { id: "location_bulk",      icon: Layers,       label: "Bulk Generate (Google API)",       description: "Fetch + enrich many locations at once" },
      { id: "location_csv",       icon: FileSpreadsheet, label: "Import Locations (CSV)",       description: "Upload a spreadsheet of locations" },
      { id: "location_review",    icon: ListChecks,   label: "Review Generated Locations",      description: "Approve or reject pending locations" },
      { id: "job_manager",        icon: BriefcaseMedical, label: "Job Manager",                   description: "Monitor, cancel, retry generation jobs" },
    ],
  },
  {
    label: "Partners",
    color: "bg-rose-50 text-rose-700",
    items: [
      { id: "partner_add",        icon: Store,        label: "Add Partner Account",             description: "Register a new partner business" },
      { id: "partner_experience", icon: Store,        label: "Add Experience / Offer",          description: "Create a partner experience or deal" },
    ],
  },
  {
    label: "Discovery Data",
    color: "bg-blue-50 text-blue-700",
    items: [
      { id: "visa_add",           icon: Globe,        label: "Add Visa Rule",                   description: "Create a new visa requirement" },
      { id: "visa_csv",           icon: FileSpreadsheet, label: "Import Visa Rules (CSV)",      description: "Bulk import visa rules from spreadsheet" },
      { id: "airport_add",        icon: Plane,        label: "Add Airport",                     description: "Manually add an airport record" },
      { id: "airport_csv",        icon: FileSpreadsheet, label: "Import Airports (CSV)",        description: "Bulk import airports from spreadsheet" },
      { id: "airport_generate",   icon: Wand2,        label: "Generate Airports via API",       description: "Fetch airports from Google Places" },
    ],
  },
  {
    label: "System Data",
    color: "bg-slate-100 text-slate-700",
    items: [
      { id: "data_import",        icon: Upload,       label: "Import Data (CSV)",               description: "Generic CSV import into any entity" },
      { id: "data_export",        icon: FileSpreadsheet, label: "Export Data",                  description: "Download location data as CSV" },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminAddMenu({ onNavigate, onAction, className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleItem = (id) => {
    setOpen(false);
    // Route each action
    switch (id) {
      // Locations
      case "location_manual":    onAction?.("location_manual"); break;
      case "location_generate":  onNavigate?.("content", "bulkgenerator"); break;
      case "location_bulk":      onNavigate?.("content", "bulkgenerator"); break;
      case "location_csv":       onNavigate?.("data", "import"); break;
      case "location_review":    onNavigate?.("content", "generatedlocations"); break;
      case "job_manager":        onNavigate?.("content", "jobmanager"); break;

      // Partners
      case "partner_add":        onNavigate?.("partners", "partners"); break;
      case "partner_experience": onNavigate?.("partners", "partners"); break;

      // Discovery
      case "visa_add":           onNavigate?.("discovery", "visa"); break;
      case "visa_csv":           onNavigate?.("discovery", "visa"); break;
      case "airport_add":        onAction?.("airport_add"); break;
      case "airport_csv":        onAction?.("airport_csv"); break;
      case "airport_generate":   onAction?.("airport_generate"); break;

      // System
      case "data_import":        onNavigate?.("data", "import"); break;
      case "data_export":        onNavigate?.("data", "export"); break;

      default: break;
    }
  };

  return (
    <div className={`relative ${className}`} ref={ref}>
      <Button
        onClick={() => setOpen(v => !v)}
        className="bg-primary hover:bg-primary/90 gap-1.5"
      >
        <Plus className="w-4 h-4" /> Add
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <p className="text-sm font-bold">Create / Import</p>
            <button onClick={() => setOpen(false)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>

          {/* Groups */}
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-border/40">
            {MENU_GROUPS.map(group => (
              <div key={group.label}>
                <div className="px-4 py-2">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${group.color}`}>
                    {group.label}
                  </span>
                </div>
                {group.items.map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItem(item.id)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight">{item.label}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0 group-hover:text-muted-foreground transition-colors" />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}