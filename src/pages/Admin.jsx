import React, { useState, useEffect } from "react";
import { supabase } from '@/api/supabase';
import { base44 } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, ChevronRight,
  MapPin, Image, Globe, Plane, Languages,
  MessageSquare, Star, Users, Wallet, Tag,
  ToggleLeft, Layers, Coins, Palette, Link2,
  Upload, Download, FileSpreadsheet,
  BarChart3, TrendingUp, ScrollText,
  AlertCircle, ShieldCheck, GitBranch, Activity, Store, RotateCcw
} from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { Link } from "react-router-dom";
import AdminStats from "@/components/admin/AdminStats";
import AdminLocations from "@/components/admin/AdminLocations";
import AdminDataHub from "@/components/admin/AdminDataHub";
import AdminDiscoveryLogs from "@/components/admin/AdminDiscoveryLogs";
import AdminDiscoveries from "@/components/admin/AdminDiscoveries";
import AdminBrand from "@/components/admin/AdminBrand";
import AdminPromoCode from "@/components/admin/AdminPromoCode";
import AdminAffiliates from "@/components/admin/AdminAffiliates";
import AdminVisaRules from "@/components/admin/AdminVisaRules";
import AdminVisaExceptions from "@/components/admin/AdminVisaExceptions";
import AdminVisaReview from "@/components/admin/AdminVisaReview";
import AdminOnboarding from "@/components/admin/AdminOnboarding";
import AdminUsers from "@/components/admin/AdminUsers";
import AdminCreditManagement from "@/components/admin/AdminCreditManagement";
import AdminLegal from "@/components/admin/AdminLegal";
import AdminEngagement from "@/components/admin/AdminEngagement";
import AdminAirports from "@/components/admin/AdminAirports";
import AdminCorrectionReview from "@/components/admin/AdminCorrectionReview";
import AdminSuggestions from "@/components/admin/AdminSuggestions";
import AdminMediaSettings from "@/components/admin/AdminMediaSettings";
import AdminFeatures from "@/components/admin/AdminFeatures";
import AdminLogicLab from "@/components/admin/AdminLogicLab";
import AdminIncidents from "@/components/admin/AdminIncidents";
import AdminEventLogs from "@/components/admin/AdminEventLogs";
import AdminJourneyDebug from "@/components/admin/AdminJourneyDebug";
import AdminJourneyRequestLog from "@/components/admin/AdminJourneyRequestLog";
import AdminGeneratedLocations from "@/components/admin/AdminGeneratedLocations";
import AdminJourneyQuality from "@/components/admin/AdminJourneyQuality";
import AdminBulkGenerator from "@/components/admin/AdminBulkGenerator";
import AdminPartners from "@/components/admin/AdminPartners";
import AdminAddMenu from "@/components/admin/AdminAddMenu";
import AdminConciergeProfile from "@/components/admin/AdminConciergeProfile";
import AdminImageEnrichment from "@/components/admin/AdminImageEnrichment";

// ─── Navigation config ───────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: "content",
    label: "Content",
    icon: MapPin,
    color: "bg-emerald-50 text-emerald-700",
    items: [
      { id: "locations",          label: "Locations",           icon: MapPin,          description: "Stories, audio, tour points" },
      { id: "generatedlocations", label: "Generated Locations", icon: Activity,        description: "On-demand generated places — review, approve" },
      { id: "bulkgenerator",      label: "Bulk Generator",      icon: Layers,          description: "Generate locations in bulk (Phase 2)" },
      { id: "media",              label: "Media",               icon: Image,           description: "Audio gating and media settings" },
      { id: "image_enrichment",   label: "Image Enrichment",    icon: Image,           description: "Auto-fetch images for locations without one" },
      { id: "translations",       label: "Translations",        icon: Languages,       description: "Multi-language story translations" },
    ],
  },
  {
    id: "discovery",
    label: "Discovery",
    icon: Globe,
    color: "bg-blue-50 text-blue-700",
    items: [
      { id: "visa",        label: "Visa Rules",  icon: Globe,    description: "Base rules, exceptions, review queue" },
      { id: "airports",    label: "Airports",    icon: Plane,    description: "Airport reference data" },
      { id: "discoveries", label: "Discoveries", icon: Star,     description: "Adventure finder destinations" },
    ],
  },
  {
    id: "userinput",
    label: "User Input",
    icon: MessageSquare,
    color: "bg-orange-50 text-orange-700",
    items: [
      { id: "corrections",  label: "Corrections",      icon: MessageSquare, description: "User-submitted content corrections" },
      { id: "suggestions",  label: "Place Suggestions", icon: MapPin,        description: "User-submitted places for review" },
      { id: "engagement",   label: "Reviews",           icon: Star,          description: "Ratings and user engagement" },
    ],
  },
  {
    id: "partners",
    label: "Partners",
    icon: Store,
    color: "bg-rose-50 text-rose-700",
    items: [
      { id: "partners", label: "Partner Accounts", icon: Store, description: "Approve partners, link locations, manage experiences" },
    ],
  },
  {
    id: "users",
    label: "Users & Revenue",
    icon: Users,
    color: "bg-violet-50 text-violet-700",
    items: [
      { id: "userlist", label: "Users",       icon: Users,   description: "Manage accounts and roles" },
      { id: "credits",  label: "Wallet",      icon: Wallet,  description: "Credits management" },
      { id: "promos",   label: "Promo Codes", icon: Tag,     description: "Discount and reward codes" },
      { id: "affiliates", label: "Affiliates", icon: Link2,  description: "Booking and affiliate links" },
    ],
  },
  {
    id: "system",
    label: "System",
    icon: ToggleLeft,
    color: "bg-slate-100 text-slate-700",
    items: [
      { id: "features",   label: "Features",     icon: ToggleLeft,    description: "Feature flag toggles" },
      { id: "onboarding", label: "Experience",   icon: Layers,        description: "Onboarding slides" },
      { id: "monetize",   label: "Monetization", icon: Coins,         description: "Audio gating settings" },
      { id: "brand",      label: "Brand",        icon: Palette,       description: "Colors, logo, app identity" },
      { id: "legal",      label: "Legal",        icon: ScrollText,    description: "Terms and privacy content" },
      { id: "access",     label: "Access",       icon: ShieldCheck,   description: "Access control configuration" },
    ],
  },
  {
    id: "data",
    label: "Data Management",
    icon: Upload,
    color: "bg-teal-50 text-teal-700",
    items: [
      { id: "import",     label: "Import",     icon: Upload,          description: "CSV / Excel bulk upload" },
      { id: "export",     label: "Export",     icon: Download,        description: "Download and export data" },
      { id: "templates",  label: "Templates",  icon: FileSpreadsheet, description: "Download CSV templates" },
      { id: "validation", label: "Validation", icon: ShieldCheck,     description: "Data sanity checks" },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    icon: BarChart3,
    color: "bg-indigo-50 text-indigo-700",
    items: [
      { id: "stats",          label: "Analytics",      icon: BarChart3,  description: "Key metrics and usage stats" },
      { id: "journeyrequests",label: "Journey Logs",   icon: ScrollText, description: "Live journey request log with debug" },
      { id: "incidents",      label: "Incidents",      icon: AlertCircle,description: "Failures and operational issues" },
      { id: "eventlogs",      label: "Event Logs",     icon: Activity,   description: "Product analytics events" },
      { id: "journeyquality", label: "Journey Quality",icon: ShieldCheck,description: "Auto-evaluated journey quality scores" },
    ],
  },
  {
    id: "logiclab",
    label: "Logic Lab",
    icon: GitBranch,
    color: "bg-violet-50 text-violet-700",
    items: [
      { id: "logiclab",     label: "Logic Modules",    icon: GitBranch, description: "Versioned journey logic specs" },
      { id: "journeydebug", label: "Journey Engine V2",icon: Activity,  description: "Benchmark and debug panel" },
      { id: "benchmarks",   label: "Benchmarks",       icon: TrendingUp,description: "Deterministic route benchmarks" },
      { id: "journeyrequests_debug", label: "Debug",   icon: ScrollText,description: "Journey request debug layers" },
      { id: "ailoop",           label: "AI Behavior Loop",   icon: RotateCcw, description: "Audit logs, FAIL tracking, recurrence" },
      { id: "concierge_profiles", label: "User Behavior Profiles", icon: RotateCcw, description: "Per-user travel memory and preference confidence" },
    ],
  },
];

// ─── Content renderer ────────────────────────────────────────────────────────

function SectionContent({ itemId, user, pendingVisa, pendingReviews }) {
  switch (itemId) {
    case "locations":           return <AdminLocations />;
    case "generatedlocations":  return <AdminGeneratedLocations />;
    case "bulkgenerator":       return <AdminBulkGenerator />;
    case "media":               return <AdminMediaSettings />;
    case "monetize":            return <AdminMediaSettings />;
    case "translations":        return <AdminDataHub initialTab="locations" />;
    case "visa":                return <VisaSubTabs pendingVisa={pendingVisa} />;
    case "airports":            return <AdminAirports />;
    case "discoveries":         return <AdminDiscoveries />;
    case "corrections":         return <AdminCorrectionReview />;
    case "suggestions":         return <AdminSuggestions />;
    case "engagement":          return <AdminEngagement />;
    case "userlist":            return <AdminUsers />;
    case "credits":             return <AdminCreditManagement />;
    case "promos":              return <AdminPromoCode />;
    case "affiliates":          return <AdminAffiliates />;
    case "features":            return <AdminFeatures />;
    case "onboarding":          return <AdminOnboarding />;
    case "brand":               return <AdminBrand />;
    case "legal":               return <AdminLegal />;
    case "access":              return <AdminFeatures />;
    case "import":              return <AdminDataHub initialTab="locations" />;
    case "export":              return <AdminDataHub initialTab="locations" />;
    case "templates":           return <AdminDataHub initialTab="locations" />;
    case "validation":          return <AdminDataHub initialTab="locations" />;
    case "stats":               return <AdminStats />;
    case "journeyrequests":     return <AdminJourneyRequestLog />;
    case "journeyrequests_debug": return <AdminJourneyRequestLog />;
    case "incidents":           return <AdminIncidents />;
    case "eventlogs":           return <AdminEventLogs />;
    case "journeyquality":      return <AdminJourneyQuality />;
    case "logiclab":            return <AdminLogicLab />;
    case "journeydebug":        return <AdminJourneyDebug />;
    case "benchmarks":          return <AdminJourneyDebug />;
    case "partners":            return <AdminPartners />;
    case "concierge_profiles":  return <AdminConciergeProfile />;
    case "image_enrichment":    return <AdminImageEnrichment />;
    case "ailoop":              return (
      <div className="text-center py-6 space-y-3">
        <p className="text-sm text-muted-foreground">The AI Behavior Loop runs on its own page.</p>
        <RouterLink to="/AIBehaviorLoop" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
          <RotateCcw className="w-4 h-4" /> Open AI Behavior Loop →
        </RouterLink>
      </div>
    );
    default:                    return null;
  }
}

function VisaSubTabs({ pendingVisa }) {
  const [sub, setSub] = useState("rules");
  const tabs = [
    { id: "rules", label: "Rules" },
    { id: "exceptions", label: "Exceptions" },
    { id: "review", label: "Review", badge: pendingVisa },
  ];
  return (
    <div>
      <div className="flex gap-2 mb-5">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${sub === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            {t.label}
            {t.badge > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{t.badge}</span>
            )}
          </button>
        ))}
      </div>
      {sub === "rules" && <AdminVisaRules />}
      {sub === "exceptions" && <AdminVisaExceptions />}
      {sub === "review" && <AdminVisaReview />}
    </div>
  );
}

// ─── Main Admin Page ─────────────────────────────────────────────────────────

export default function Admin() {
  const [user, setUser] = useState(null);
  const [pendingVisa, setPendingVisa] = useState(0);
  const [pendingReviews, setPendingReviews] = useState(0);
  const [pendingSuggestions, setPendingSuggestions] = useState(0);

  // Navigation state: null = home, string = sectionId, object = { section, item }
  const [nav, setNav] = useState(null);

  useEffect(() => {  supabase.auth.getUser().then(r => {
    const u = r.data.user;
    if (u) u.role = u.app_metadata?.role || u.user_metadata?.role || null;
    setUser(u);
  });
  base44.entities.VisaFeedback.filter({ status: "pending" }).then(r => setPendingVisa(r.length)).catch(() => {});
  base44.entities.Discovery.filter({ status: "pending" }).then(r => setPendingReviews(r.length)).catch(() => {});
  base44.entities.LocationSuggestion.filter({ status: "pending" }).then(r => setPendingSuggestions(r.length)).catch(() => {});
  }, []);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (user.role !== "admin" && user.role !== "owner" && user.role !== "editor" && user.role !== "analyst") {
    return (
      <div className="flex items-center justify-center h-screen px-6 text-center">
        <div>
          <p className="text-lg font-semibold">Admin Access Required</p>
          <p className="text-sm text-muted-foreground mt-2">You don't have permission to access this page.</p>
          <Link to="/Home"><Button className="mt-4">Back to Home</Button></Link>
        </div>
      </div>
    );
  }

  // Badge counts for items
  const getBadge = (itemId) => {
    if (itemId === "suggestions") return pendingSuggestions;
    if (itemId === "discoveries") return pendingReviews;
    if (itemId === "visa") return pendingVisa;
    return 0;
  };

  // ── ITEM VIEW (drill-down leaf) ──
  if (nav?.item) {
    const section = SECTIONS.find(s => s.id === nav.section);
    const item = section?.items.find(i => i.id === nav.item);
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setNav({ section: nav.section })} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">{section?.label}</p>
            <h1 className="text-lg font-bold leading-tight">{item?.label}</h1>
          </div>
          <AdminAddMenu
            onNavigate={(s, i) => setNav({ section: s, item: i })}
            onAction={(action) => {
              if (action === "location_manual") setNav({ section: "content", item: "locations" });
              if (action === "location_generate") setNav({ section: "content", item: "locations" });
              if (action === "airport_add") setNav({ section: "discovery", item: "airports" });
              if (action === "airport_csv") setNav({ section: "discovery", item: "airports" });
              if (action === "airport_generate") setNav({ section: "discovery", item: "airports" });
            }}
          />
        </div>
        <SectionContent itemId={nav.item} user={user} pendingVisa={pendingVisa} pendingReviews={pendingReviews} />
      </div>
    );
  }

  // ── SECTION VIEW (item list) ──
  if (nav?.section) {
    const section = SECTIONS.find(s => s.id === nav.section);
    if (!section) { setNav(null); return null; }
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setNav(null)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-bold">{section.label}</h1>
        </div>
        <div className="space-y-2">
          {section.items.map(item => {
            const Icon = item.icon;
            const badge = getBadge(item.id);
            return (
              <button
                key={item.id}
                onClick={() => setNav({ section: section.id, item: item.id })}
                className="w-full flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${section.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{item.label}</span>
                    {badge > 0 && (
                      <span className="bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none">{badge}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── HOME VIEW (7 sections) ──
  const totalPending = pendingVisa + pendingReviews + pendingSuggestions;
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/Home">
            <button className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <h1 className="text-lg font-bold">Admin Panel</h1>
            <p className="text-xs text-muted-foreground">TukaPath</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setNav("sanity")}
            className="flex items-center gap-1.5 text-xs font-medium bg-card border border-border hover:border-primary/40 hover:bg-primary/5 px-3 py-1.5 rounded-full transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            Validate Data
          </button>
          {totalPending > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
              <AlertCircle className="w-3.5 h-3.5" />
              {totalPending} pending
            </div>
          )}
          <AdminAddMenu
            onNavigate={(section, item) => setNav({ section, item })}
            onAction={(action) => {
              if (action === "location_manual") setNav({ section: "content", item: "locations" });
              if (action === "location_generate") setNav({ section: "content", item: "locations" });
              if (action === "airport_add") setNav({ section: "discovery", item: "airports" });
              if (action === "airport_csv") setNav({ section: "discovery", item: "airports" });
              if (action === "airport_generate") setNav({ section: "discovery", item: "airports" });
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SECTIONS.map(section => {
          const Icon = section.icon;
          const sectionBadge = section.items.reduce((sum, item) => sum + getBadge(item.id), 0);
          return (
            <button
              key={section.id}
              onClick={() => setNav({ section: section.id })}
              className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${section.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{section.label}</span>
                  {sectionBadge > 0 && (
                    <span className="bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none">{sectionBadge}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {section.items.map(i => i.label).join(" · ")}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}