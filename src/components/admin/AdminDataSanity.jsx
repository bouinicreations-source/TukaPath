import React, { useState } from "react";
import { base44 } from "@/api/client";
import { Button } from "@/components/ui/button";
import { AlertTriangle, AlertCircle, CheckCircle2, RefreshCw, ChevronDown, ChevronUp, Wrench, Zap } from "lucide-react";

const VALID_VISA_TYPES = ["Visa Free", "Visa on Arrival", "eVisa", "Visa Required", "Not Allowed", "ETA"];
const VALID_LANG_CODES = ["ar", "es", "fr", "it", "zh"];
const CURRENT_YEAR = new Date().getFullYear();
const PLACEHOLDER_PATTERNS = [/^test$/i, /^lorem/i, /^sample$/i, /^placeholder$/i, /^tbd$/i, /^n\/a$/i];

function isPlaceholder(val) {
  if (!val) return false;
  return PLACEHOLDER_PATTERNS.some(p => p.test(String(val).trim()));
}

function simpleHash(str) {
  if (!str) return "";
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h.toString(36);
}

// ─── Validators ──────────────────────────────────────────────────────────────

async function validateLocations(locations) {
  const issues = [];
  const autoFixed = [];

  for (const loc of locations) {
    const id = loc.id;
    const name = loc.name || "(no name)";

    // Required fields
    for (const f of ["name", "city", "country", "latitude", "longitude", "quick_story_voice", "deep_story_voice"]) {
      if (!loc[f] && loc[f] !== 0) {
        issues.push({ id, name, field: f, value: null, problem: `Missing required field`, severity: "critical", action: "Needs manual review" });
      }
    }

    // Placeholder text
    for (const f of ["name", "city", "country", "description", "quick_story_voice", "deep_story_voice"]) {
      if (loc[f] && isPlaceholder(loc[f])) {
        issues.push({ id, name, field: f, value: String(loc[f]).slice(0, 40), problem: `Placeholder or test value detected`, severity: "warning", action: "Needs manual review" });
      }
    }

    // Coordinates
    if (loc.latitude != null && (loc.latitude < -90 || loc.latitude > 90)) {
      issues.push({ id, name, field: "latitude", value: loc.latitude, problem: `Out of range (-90 to 90)`, severity: "critical", action: "Needs manual review" });
    }
    if (loc.longitude != null && (loc.longitude < -180 || loc.longitude > 180)) {
      issues.push({ id, name, field: "longitude", value: loc.longitude, problem: `Out of range (-180 to 180)`, severity: "critical", action: "Needs manual review" });
    }

    // built_year
    if (loc.built_year !== undefined && loc.built_year !== null && loc.built_year !== "") {
      const yr = parseFloat(loc.built_year);
      if (isNaN(yr)) {
        issues.push({ id, name, field: "built_year", value: loc.built_year, problem: `Non-numeric value`, severity: "warning", action: "Needs manual review" });
      } else {
        if (yr !== Math.floor(yr)) {
          const fixed = Math.round(yr);
          try {
            await base44.entities.Location.update(id, { built_year: String(fixed) });
            autoFixed.push({ id, name, field: "built_year", value: loc.built_year, problem: `Decimal year`, severity: "auto-fixed", action: `Auto-fixed to ${fixed}` });
          } catch {
            issues.push({ id, name, field: "built_year", value: loc.built_year, problem: `Decimal year (auto-fix failed)`, severity: "warning", action: "Needs manual review" });
          }
        } else if (yr < 1000 || yr > CURRENT_YEAR) {
          issues.push({ id, name, field: "built_year", value: yr, problem: `Year out of range (1000–${CURRENT_YEAR})`, severity: "warning", action: "Needs manual review" });
        }
      }
    }

    // Audio consistency
    if (loc.quick_story_voice && !loc.quick_audio_url) {
      issues.push({ id, name, field: "quick_audio_url", value: null, problem: `Voice script exists but no audio generated`, severity: "warning", action: "Needs manual review" });
    }
    if (loc.deep_story_voice && !loc.deep_audio_url) {
      issues.push({ id, name, field: "deep_audio_url", value: null, problem: `Deep voice script exists but no audio generated`, severity: "warning", action: "Needs manual review" });
    }
  }

  return { issues, autoFixed };
}

function validateAirports(airports) {
  const issues = [];
  const seen = {};
  for (const ap of airports) {
    const id = ap.id;
    const name = ap.airport_name || ap.airport_iata || "(no name)";
    const iata = ap.airport_iata || "";

    if (!/^[A-Z]{3}$/.test(iata)) {
      issues.push({ id, name, field: "airport_iata", value: iata || "(empty)", problem: `Must be exactly 3 uppercase letters`, severity: "critical", action: "Needs manual review" });
    }
    if (seen[iata]) {
      issues.push({ id, name, field: "airport_iata", value: iata, problem: `Duplicate IATA code`, severity: "critical", action: "Needs manual review" });
    } else if (iata) {
      seen[iata] = true;
    }

    if (ap.latitude != null && (ap.latitude < -90 || ap.latitude > 90)) {
      issues.push({ id, name, field: "latitude", value: ap.latitude, problem: `Invalid latitude`, severity: "critical", action: "Needs manual review" });
    }
    if (ap.longitude != null && (ap.longitude < -180 || ap.longitude > 180)) {
      issues.push({ id, name, field: "longitude", value: ap.longitude, problem: `Invalid longitude`, severity: "critical", action: "Needs manual review" });
    }
    if (!ap.latitude && ap.latitude !== 0) {
      issues.push({ id, name, field: "latitude", value: null, problem: `Missing latitude`, severity: "critical", action: "Needs manual review" });
    }
    if (!ap.longitude && ap.longitude !== 0) {
      issues.push({ id, name, field: "longitude", value: null, problem: `Missing longitude`, severity: "critical", action: "Needs manual review" });
    }
  }
  return { issues, autoFixed: [] };
}

function validateVisaRules(rules) {
  const issues = [];
  for (const rule of rules) {
    const id = rule.id;
    const name = `${rule.passport_country || "?"} → ${rule.destination_country || "?"}`;

    if (!rule.passport_country) issues.push({ id, name, field: "passport_country", value: null, problem: `Missing`, severity: "critical", action: "Needs manual review" });
    if (!rule.destination_country) issues.push({ id, name, field: "destination_country", value: null, problem: `Missing`, severity: "critical", action: "Needs manual review" });
    if (!VALID_VISA_TYPES.includes(rule.visa_type)) {
      issues.push({ id, name, field: "visa_type", value: rule.visa_type, problem: `Invalid value`, severity: "critical", action: "Needs manual review" });
    }
    if (rule.processing_days != null && rule.processing_days < 0) {
      issues.push({ id, name, field: "processing_days", value: rule.processing_days, problem: `Negative value`, severity: "warning", action: "Needs manual review" });
    }
    if (rule.visa_cost_usd != null && rule.visa_cost_usd < 0) {
      issues.push({ id, name, field: "visa_cost_usd", value: rule.visa_cost_usd, problem: `Negative value`, severity: "warning", action: "Needs manual review" });
    }
  }
  return { issues, autoFixed: [] };
}

function validateTranslations(translations, locations) {
  const issues = [];
  const locMap = {};
  for (const loc of locations) locMap[loc.id] = loc;

  for (const tr of translations) {
    const id = tr.id;
    const name = `${tr.location_id} / ${tr.language_code}`;

    if (!VALID_LANG_CODES.includes(tr.language_code)) {
      issues.push({ id, name, field: "language_code", value: tr.language_code, problem: `Unsupported language code`, severity: "critical", action: "Needs manual review" });
    }

    const loc = locMap[tr.location_id];
    if (loc) {
      const currentHash = simpleHash((loc.quick_story_voice || "") + "||" + (loc.deep_story_voice || ""));
      if (tr.source_english_hash && tr.source_english_hash !== currentHash) {
        issues.push({ id, name, field: "source_english_hash", value: null, problem: `English source changed — translation is outdated`, severity: "warning", action: "Needs manual review" });
      }
    }

    if (tr.quick_story_voice && !tr.quick_audio_url) {
      issues.push({ id, name, field: "quick_audio_url", value: null, problem: `Translated script exists but no audio URL`, severity: "warning", action: "Needs manual review" });
    }
    if (tr.deep_story_voice && !tr.deep_audio_url) {
      issues.push({ id, name, field: "deep_audio_url", value: null, problem: `Translated script exists but no audio URL`, severity: "warning", action: "Needs manual review" });
    }
  }
  return { issues, autoFixed: [] };
}

// ─── UI ──────────────────────────────────────────────────────────────────────

const SEVERITY_STYLES = {
  critical: { bg: "bg-red-50/40", dot: "bg-red-500", badge: "bg-red-100 text-red-600", label: "Critical" },
  warning: { bg: "bg-amber-50/30", dot: "bg-amber-400", badge: "bg-amber-100 text-amber-700", label: "Warning" },
  "auto-fixed": { bg: "bg-green-50/30", dot: "bg-green-500", badge: "bg-green-100 text-green-700", label: "Auto-fixed" },
};

function IssueRow({ issue }) {
  const s = SEVERITY_STYLES[issue.severity] || SEVERITY_STYLES.warning;
  return (
    <div className={`flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 ${s.bg}`}>
      <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs font-semibold text-foreground">{issue.name}</p>
          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${s.badge}`}>{s.label}</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          <span className="font-medium text-foreground/70">{issue.field}</span>
          {issue.value !== null && issue.value !== undefined && (
            <span className="text-muted-foreground/70"> — current: <code className="font-mono bg-muted px-0.5 rounded text-[10px]">{String(issue.value)}</code></span>
          )}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{issue.problem}</p>
        <p className={`text-[10px] mt-1 font-medium ${issue.severity === "auto-fixed" ? "text-green-600" : "text-muted-foreground"}`}>
          {issue.severity === "auto-fixed" ? <span className="flex items-center gap-1"><Zap className="w-2.5 h-2.5" />{issue.action}</span> : issue.action}
        </p>
      </div>
    </div>
  );
}

function ModuleSection({ title, checked, issues, autoFixed }) {
  const [open, setOpen] = useState(true);
  const allItems = [...(autoFixed || []), ...issues];
  const criticals = issues.filter(i => i.severity === "critical").length;
  const warnings = issues.filter(i => i.severity === "warning").length;
  const fixedCount = (autoFixed || []).length;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold">{title}</span>
          <span className="text-[10px] text-muted-foreground">{checked} checked</span>
          {allItems.length === 0
            ? <span className="flex items-center gap-1 text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200"><CheckCircle2 className="w-2.5 h-2.5" /> Clean</span>
            : (
              <div className="flex items-center gap-1">
                {criticals > 0 && <span className="text-[10px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">{criticals} critical</span>}
                {warnings > 0 && <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">{warnings} warning{warnings > 1 ? "s" : ""}</span>}
                {fixedCount > 0 && <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">{fixedCount} auto-fixed</span>}
              </div>
            )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      </button>
      {open && (
        allItems.length === 0
          ? <p className="text-xs text-muted-foreground text-center py-4">No issues found.</p>
          : <div>
              {allItems.map((issue, idx) => (
                <IssueRow key={`${issue.id}-${issue.field}-${idx}`} issue={issue} />
              ))}
            </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const SEVERITY_FILTERS = ["all", "critical", "warning", "auto-fixed"];

export default function AdminDataSanity() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [runAt, setRunAt] = useState(null);
  const [severityFilter, setSeverityFilter] = useState("all");

  const runCheck = async () => {
    setRunning(true);
    setResults(null);
    try {
      const [locations, airports, visaRules, translations] = await Promise.all([
        base44.entities.Location.list("-updated_date", 500),
        base44.entities.Airport.list("-updated_date", 500),
        base44.entities.VisaBaseRule.list("-updated_date", 1000),
        base44.entities.LocationTranslation.list("-updated_date", 1000),
      ]);

      const [locResult, apResult, visaResult, trResult] = await Promise.all([
        validateLocations(locations),
        Promise.resolve(validateAirports(airports)),
        Promise.resolve(validateVisaRules(visaRules)),
        Promise.resolve(validateTranslations(translations, locations)),
      ]);

      setResults({
        locations: locResult,
        airports: apResult,
        visaRules: visaResult,
        translations: trResult,
        counts: {
          locations: locations.length,
          airports: airports.length,
          visaRules: visaRules.length,
          translations: translations.length,
        },
      });
      setRunAt(new Date());
    } finally {
      setRunning(false);
    }
  };

  const totalIssues = results
    ? results.locations.issues.length + results.airports.issues.length + results.visaRules.issues.length + results.translations.issues.length
    : 0;
  const totalFixed = results
    ? results.locations.autoFixed.length + results.airports.autoFixed.length + results.visaRules.autoFixed.length + results.translations.autoFixed.length
    : 0;

  const filterIssues = (items) =>
    severityFilter === "all" ? items : items.filter(i => i.severity === severityFilter);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Data Sanity Check</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Rule-based validation across all data modules</p>
        </div>
        <Button onClick={runCheck} disabled={running} className="gap-2 h-9 shrink-0">
          <RefreshCw className={`w-3.5 h-3.5 ${running ? "animate-spin" : ""}`} />
          {running ? "Scanning…" : "Run Check"}
        </Button>
      </div>

      {/* Summary bar */}
      {results && (
        <div className={`flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
          totalIssues === 0 && totalFixed === 0
            ? "bg-green-50 border-green-200 text-green-700"
            : "bg-amber-50 border-amber-200 text-amber-800"
        }`}>
          {totalIssues === 0 && totalFixed === 0
            ? <><CheckCircle2 className="w-4 h-4" /> Validation complete — no issues found</>
            : <>
                <AlertTriangle className="w-4 h-4" />
                <span>{totalIssues} issue{totalIssues !== 1 ? "s" : ""} found</span>
                {totalFixed > 0 && (
                  <span className="flex items-center gap-1 text-green-700 bg-green-100 px-2 py-0.5 rounded-full text-xs font-bold">
                    <Zap className="w-3 h-3" /> {totalFixed} auto-fixed
                  </span>
                )}
              </>
          }
          {runAt && <span className="ml-auto text-xs opacity-60">{runAt.toLocaleTimeString()}</span>}
        </div>
      )}

      {/* Filters */}
      {results && (totalIssues > 0 || totalFixed > 0) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">Filter:</span>
          {SEVERITY_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setSeverityFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                severityFilter === f
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-muted-foreground border-border hover:border-foreground/30"
              }`}
            >
              {f === "all" ? "All" : f === "auto-fixed" ? "Auto-fixed" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Module sections */}
      {results && (
        <div className="space-y-3">
          <ModuleSection
            title="Locations"
            checked={results.counts.locations}
            issues={filterIssues(results.locations.issues)}
            autoFixed={severityFilter === "all" || severityFilter === "auto-fixed" ? results.locations.autoFixed : []}
          />
          <ModuleSection
            title="Airports"
            checked={results.counts.airports}
            issues={filterIssues(results.airports.issues)}
            autoFixed={[]}
          />
          <ModuleSection
            title="Visa Rules"
            checked={results.counts.visaRules}
            issues={filterIssues(results.visaRules.issues)}
            autoFixed={[]}
          />
          <ModuleSection
            title="Audio / Translations"
            checked={results.counts.translations}
            issues={filterIssues(results.translations.issues)}
            autoFixed={[]}
          />
        </div>
      )}

      {!results && !running && (
        <div className="text-center py-14 text-muted-foreground text-sm">
          Press <span className="font-semibold text-foreground">Run Check</span> to scan all data modules.
        </div>
      )}
    </div>
  );
}