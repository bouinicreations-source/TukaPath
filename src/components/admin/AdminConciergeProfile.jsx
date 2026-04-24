/**
 * AdminConciergeProfile — Admin debug view for user behavior profiles.
 * Shows all UserProfile records with confidence values and preference fields.
 * Read-only inspection panel.
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/client";
import { RefreshCw, ChevronDown, ChevronUp, User } from "lucide-react";

function tryParseJson(val, fallback = {}) {
  if (!val) return fallback;
  if (typeof val !== "string") return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

function ConfidenceBar({ value = 0 }) {
  const pct = Math.round((value || 0) * 100);
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-slate-300";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground w-7 text-right">{pct}%</span>
    </div>
  );
}

function ProfileRow({ profile }) {
  const [open, setOpen] = useState(false);
  const conf = tryParseJson(profile._confidence, {});
  const favored = tryParseJson(profile.favored_tags, []);
  const disliked = tryParseJson(profile.disliked_tags, []);

  const FIELDS = [
    { key: "preferred_mode",            label: "Transport mode" },
    { key: "preferred_trip_length",     label: "Trip length (days)" },
    { key: "preferred_trip_type",       label: "Trip type" },
    { key: "route_style_preference",    label: "Route style" },
    { key: "driving_rhythm_preference", label: "Driving rhythm" },
    { key: "overnight_preference",      label: "Overnight ok" },
    { key: "stop_density_preference",   label: "Stop density" },
  ];

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{profile.user_id}</p>
          <p className="text-[11px] text-muted-foreground">
            {profile.preferred_mode || "—"} · {profile.route_style_preference || "—"} · updated {profile.last_updated ? new Date(profile.last_updated).toLocaleDateString() : "never"}
          </p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border/40 space-y-3 pt-3">
          {/* Preference fields with confidence */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Preferences + Confidence</p>
            {FIELDS.map(({ key, label }) => {
              const val = profile[key];
              const c   = conf[key] || 0;
              if (val === null || val === undefined) return null;
              return (
                <div key={key} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold">{String(val)}</span>
                  </div>
                  <ConfidenceBar value={c} />
                </div>
              );
            })}
          </div>

          {/* Tags */}
          {favored.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-1">Favoured Tags</p>
              <div className="flex flex-wrap gap-1">
                {favored.map(t => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">{t}</span>
                ))}
              </div>
            </div>
          )}
          {disliked.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-1">Disliked Tags</p>
              <div className="flex flex-wrap gap-1">
                {disliked.map(t => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 font-medium">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Raw confidence dump */}
          <details>
            <summary className="text-[10px] text-muted-foreground/50 cursor-pointer">Raw confidence JSON</summary>
            <pre className="text-[10px] bg-muted/40 rounded-lg p-2 mt-1 overflow-x-auto text-muted-foreground">
              {JSON.stringify(conf, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

export default function AdminConciergeProfile() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading]   = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.UserProfile.list("-last_updated", 100);
      setProfiles(data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">User Behavior Profiles</p>
          <p className="text-xs text-muted-foreground">{profiles.length} profiles stored</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground border border-border rounded-xl hover:text-foreground transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="py-10 flex justify-center">
          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : profiles.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">No behavior profiles yet.</p>
      ) : (
        <div className="space-y-2">
          {profiles.map(p => <ProfileRow key={p.id} profile={p} />)}
        </div>
      )}
    </div>
  );
}