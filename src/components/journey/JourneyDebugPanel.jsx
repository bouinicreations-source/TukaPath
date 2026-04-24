import { useState } from "react";
import { ChevronDown, ChevronUp, Bug } from "lucide-react";

// Admin-only debug overlay — shows full journey engine debug layers
// Only rendered when user.role === "admin" AND debugMode is true

function Tag({ children, color = "slate" }) {
  const colors = {
    green:  "bg-emerald-50 text-emerald-700 border border-emerald-200",
    red:    "bg-red-50 text-red-700 border border-red-200",
    amber:  "bg-amber-50 text-amber-700 border border-amber-200",
    blue:   "bg-blue-50 text-blue-700 border border-blue-200",
    slate:  "bg-slate-100 text-slate-600 border border-slate-200",
    primary:"bg-primary/10 text-primary border border-primary/20",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${colors[color] || colors.slate}`}>
      {children}
    </span>
  );
}

function Section({ title, badge, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-foreground/60">{title}</span>
          {badge && <Tag>{badge}</Tag>}
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {open && <div className="p-3 space-y-2">{children}</div>}
    </div>
  );
}

function Row({ label, value, color }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[11px]">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`font-mono font-semibold text-right truncate max-w-[60%] ${color || ""}`}>{String(value ?? "—")}</span>
    </div>
  );
}

function StopRow({ stop, type }) {
  const roleColors = {
    main_highlight: "primary", secondary_highlight: "green", scenic_pass: "blue",
    sunset_anchor: "amber", quick_stop: "slate", coffee_stop: "amber",
  };
  return (
    <div className="flex items-center gap-2 py-1 text-[11px] border-b border-border/30 last:border-0">
      <span className="font-mono text-muted-foreground w-8 shrink-0">{(stop._progress || 0).toFixed(2)}</span>
      <span className="font-semibold truncate flex-1">{stop.location?.name || stop.name || "?"}</span>
      <Tag color={roleColors[stop.stop_role || stop.role] || "slate"}>{stop.stop_role || stop.role || "?"}</Tag>
      {stop._score != null && <span className="text-muted-foreground shrink-0">s:{stop._score}</span>}
      <Tag color={type === "main" ? "primary" : "slate"}>{type}</Tag>
    </div>
  );
}

export default function JourneyDebugPanel({ journey }) {
  const [visible, setVisible] = useState(false);

  if (!journey) return null;
  const d = journey.debug?.layers || {};
  // Multi-day: use top-level debug object directly
  const md = journey.debug || {};
  const isMultiDay = journey.multi_day_roadtrip === true;
  const allStops = [...(journey.main_stops || []), ...(journey.quick_stops || [])];

  const statusColor = {
    complete: "green", partial: "amber", arrival_only: "blue",
    minimal: "amber", empty: "red",
  }[journey.result_status] || "slate";

  return (
    <div className="mt-4 border border-dashed border-amber-300/60 rounded-2xl overflow-hidden bg-amber-50/30">

      {/* Header toggle */}
      <button
        onClick={() => setVisible(v => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-amber-50/60 transition-colors text-left"
      >
        <Bug className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Journey Debug</span>
        {isMultiDay && <Tag color="blue">multi-day</Tag>}
        <Tag color={statusColor}>{journey.result_status}</Tag>
        <Tag color="slate">{allStops.length} stops</Tag>
        {isMultiDay
          ? <Tag color="slate">{md.route_facts?.total_distance_km ?? "?"}km · {journey.segment_count} legs</Tag>
          : <Tag color="slate">{d.route?.distance_km ?? "?"}km · {d.route?.duration_minutes ?? "?"}min</Tag>
        }
        <span className="ml-auto text-[10px] text-amber-600/70">{visible ? "hide ▲" : "show ▼"}</span>
      </button>

      {visible && (
        <div className="px-4 pb-4 space-y-3">

          {/* ── MULTI-DAY PLANNER SECTION ─────────────────────────────────────── */}
          {isMultiDay && (
            <>
              <Section title="Route Architect" defaultOpen>
                <Row label="architect_called" value={String(md.architect_called ?? md.planner_called)} color="text-blue-600" />
                <Row label="planner_accepted" value={String(md.planner_accepted)} color={md.planner_accepted ? "text-emerald-600" : "text-red-500"} />
                <Row label="route_shaped_by_ai" value={String(md.google_route_shaped ?? false)} color={md.google_route_shaped ? "text-emerald-600" : "text-amber-600"} />
                <Row label="waypoints_to_google" value={md.waypoints_passed_to_google?.length ?? 0} />
                <Row label="fallback_reason" value={md.fallback_reason || "none"} color={md.fallback_reason ? "text-red-500" : "text-muted-foreground"} />
              </Section>

              <Section title="Semantic Interpretation" defaultOpen>
                {(() => {
                  const si = journey.semantic_interpretation || md.semantic_interpretation || {};
                  return <>
                    <Row label="normalized_intent" value={si.normalized_intent || "—"} />
                    <Row label="route_style" value={si.route_style || "—"} />
                    <Row label="pacing" value={si.pacing || "—"} />
                    <Row label="theme_priority" value={(si.theme_priority || []).join(', ') || "—"} />
                    <Row label="region_anchor" value={si.preferred_region_anchor || "none"} color={si.preferred_region_anchor ? "text-blue-600" : ""} />
                    <Row label="after_region_bias" value={si.after_region_bias || "none"} color={si.after_region_bias ? "text-blue-600" : ""} />
                    <Row label="max_km_per_leg" value={si.hard_constraints?.max_km_per_leg ?? "—"} />
                    <Row label="overnight_req" value={String(si.overnight_requirement ?? true)} />
                    <Row label="hotel_req" value={String(si.hotel_requirement ?? true)} />
                    {si.support_requirement?.length > 0 && <Row label="support_req" value={si.support_requirement.join(', ')} />}
                  </>;
                })()}
              </Section>

              <Section title="Route Shaping Points">
                {(md.route_shaping_points || journey.route_shaping_points || []).length === 0
                  ? <p className="text-xs text-muted-foreground italic">No shaping waypoints used</p>
                  : (md.route_shaping_points || journey.route_shaping_points || []).map((wp, i) => (
                    <div key={i} className="text-[10px] font-mono flex gap-2 items-start">
                      <Tag color="blue">{wp.purpose || 'waypoint'}</Tag>
                      <span>{wp.name}</span>
                      <span className="text-muted-foreground">{wp.lat?.toFixed(2)},{wp.lng?.toFixed(2)}</span>
                    </div>
                  ))
                }
              </Section>

              <Section title="Route Facts">
                <Row label="straight_line_km" value={md.route_facts?.straight_line_km} />
                <Row label="google_default_km" value={md.route_facts?.google_default_km} />
                <Row label="max_leg_km" value={md.route_facts?.max_leg_km} />
                <Row label="country_context" value={md.route_facts?.country_context || "—"} />
                <Row label="polyline_points" value={(journey.route_metadata?.polyline?.length) || "—"} />
              </Section>

              <Section title="Overnight Cities">
                {(md.overnight_city_candidates || journey.overnight_city_candidates || []).length === 0
                  ? <p className="text-xs text-muted-foreground italic">None proposed</p>
                  : (md.overnight_city_candidates || journey.overnight_city_candidates || []).map((c, i) => <Row key={i} label={`city ${i+1}`} value={typeof c === 'string' ? c : c.city} />)
                }
              </Section>

              <Section title="Architect Segment Plan">
                {(journey.segments || []).map((seg, i) => (
                  <div key={i} className="pb-2 mb-2 border-b border-border/40 last:border-0">
                    <p className="text-[10px] font-bold text-primary mb-1">Day {seg.leg_number}: → {seg.overnight_city}</p>
                    <Row label="character" value={seg.route_character} />
                    <Row label="route_bias" value={seg.route_bias || "—"} />
                    <Row label="max_km_ok" value={String(seg.max_km_respected ?? "?")} color={seg.max_km_respected ? "text-emerald-600" : "text-red-500"} />
                    <Row label="distance_km" value={seg.distance_km} />
                    <Row label="shaping_wps" value={seg.shaping_waypoints?.length ?? 0} />
                    <Row label="stops" value={seg.stops?.length ?? 0} />
                    <Row label="hotels" value={seg.hotels?.length ?? 0} />
                    <Row label="booking_links" value={seg.hotels?.filter(h => h.booking_link_attached).length ?? 0} color="text-emerald-600" />
                    {(seg.stops || []).map((s, j) => (
                      <div key={j} className="ml-2 text-[10px] font-mono text-muted-foreground">
                        → {s.location?.name || s._proposed_name} [{s.stop_role}] {s._resolved ? '✓db' : '⚡ai'}
                      </div>
                    ))}
                  </div>
                ))}
              </Section>

              <Section title="Stop Resolution">
                {(md.stop_resolution_summary || []).map((r, i) => (
                  <div key={i} className="text-[10px] font-mono flex gap-2">
                    <Tag color={r.resolved ? "green" : "amber"}>{r.source}</Tag>
                    <span>{r.name}</span>
                    <span className="text-muted-foreground">leg {r.leg}</span>
                    {r.thematic_fit && <Tag color="slate">{r.thematic_fit}</Tag>}
                  </div>
                ))}
                <div className="mt-1 pt-1 border-t border-border/30 flex gap-3 text-[10px] font-mono">
                  <span className="text-emerald-600">db_hits: {md.existing_db_matches ?? 0}</span>
                  <span className="text-amber-600">ai_generated: {(md.stop_resolution_summary?.length ?? 0) - (md.existing_db_matches ?? 0)}</span>
                  <span className="text-blue-600">booking_links: {md.booking_links_attached ?? 0}</span>
                </div>
              </Section>
            </>
          )}

          {/* ── 0. PLACE RESOLUTION PROOF ────────────────────────────────────── */}
          {(() => {
            const pr = isMultiDay ? md.place_resolution : d.place_resolution;
            if (!pr) return null;
            return (
              <Section title="Place Resolution" defaultOpen badge={pr.planner_received_resolved_places ? "✓ resolved" : "⚠ raw text"}>
                <Row label="origin_display" value={pr.raw_origin_text || "—"} color="text-blue-600" />
                <Row label="origin_country" value={pr.resolved_origin?.country || "—"} />
                <Row label="origin_place_kind" value={pr.resolved_origin?.place_kind || "—"} />
                <Row label="origin_confidence" value={pr.origin_resolution_confidence ?? "—"} color={pr.origin_resolution_confidence > 60 ? "text-emerald-600" : "text-amber-600"} />
                <Row label="origin_user_confirmed" value={String(pr.origin_user_confirmed ?? "—")} color={pr.origin_user_confirmed ? "text-emerald-600" : ""} />
                <Row label="origin_source_id" value={pr.resolved_origin?.source_place_id || "—"} />
                <div className="h-px bg-border/40 my-1" />
                <Row label="dest_display" value={pr.raw_destination_text || "—"} color="text-blue-600" />
                <Row label="dest_country" value={pr.resolved_destination?.country || "—"} />
                <Row label="dest_place_kind" value={pr.resolved_destination?.place_kind || "—"} />
                <Row label="dest_confidence" value={pr.destination_resolution_confidence ?? "—"} color={pr.destination_resolution_confidence > 60 ? "text-emerald-600" : "text-amber-600"} />
                <Row label="dest_user_confirmed" value={String(pr.destination_user_confirmed ?? "—")} color={pr.destination_user_confirmed ? "text-emerald-600" : ""} />
                <Row label="dest_source_id" value={pr.resolved_destination?.source_place_id || "—"} />
                <div className="h-px bg-border/40 my-1" />
                <Row label="planner_received_resolved" value={String(pr.planner_received_resolved_places)} color={pr.planner_received_resolved_places ? "text-emerald-600" : "text-red-500"} />
              </Section>
            );
          })()}

          {/* ── 1. INTERPRETED REQUEST ────────────────────────────────────────── */}
          {!isMultiDay && <Section title="Interpreted Request" defaultOpen>
            <Row label="Blueprint" value={d.blueprint} />
            <Row label="Intent tags" value={(d.intent?.structured_intent?.intent_tags || []).join(", ")} />
            <Row label="Time mode" value={d.intent?.time_mode} />
            <Row label="Eff. time" value={d.intent?.effective_time_minutes != null ? `${d.intent.effective_time_minutes} min` : "flexible"} />
            <Row label="Mode" value={d.intent?.mode} />
            <Row label="Route style" value={d.intent?.route_style} />
            <Row label="Pace mode" value={d.pace_mode || "none"} />
            <Row label="Time constraint" value={d.time_constraint} />
            {d.intent?.conflict_flags?.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {d.intent.conflict_flags.map((f, i) => <Tag key={i} color="amber">{f}</Tag>)}
              </div>
            )}
          </Section>}

          {/* ── 2. ROUTE METADATA ─────────────────────────────────────────────── */}
          {!isMultiDay && <Section title="Route" badge={d.route?.provider}>
            <Row label="Distance" value={`${d.route?.distance_km} km`} />
            <Row label="Duration" value={`${d.route?.duration_minutes} min`} />
            <Row label="Route points" value={d.route?.route_points} />
            <Row label="Corridor buffer" value={`${d.corridor_buffer_km?.toFixed(1)} km`} />
            <Row label="Candidates loaded" value={d.total_candidates_loaded} />
            {d.polyline_downgrade && <Tag color="amber">{d.polyline_downgrade}</Tag>}
          </Section>}

          {/* ── 3. CANDIDATE COUNTS ───────────────────────────────────────────── */}
          {!isMultiDay && <Section title="Candidate Pipeline" badge={`${d.corridor_eligible} eligible`}>
            <Row label="Zone: corridor" value={d.zones?.CORRIDOR} />
            <Row label="Zone: origin" value={d.zones?.ORIGIN_ZONE} />
            <Row label="Zone: dest" value={d.zones?.DESTINATION_ZONE} />
            <Row label="Zone: invalid" value={d.zones?.INVALID} />
            <Row label="Origin purged" value={d.origin_zone_purged} color="text-red-500" />
            <Row label="Corridor eligible" value={d.corridor_eligible} color="text-emerald-600" />
            <Row label="Scored candidates" value={d.scored_count} />
            <Row label="L5 rejected" value={d.l5_classified_reject} color="text-amber-600" />
          </Section>}

          {/* ── 4. SCORING SUMMARY — top 10 ───────────────────────────────────── */}
          {!isMultiDay && d.scored_top10?.length > 0 && (
            <Section title="Top Scored Candidates">
              <div className="overflow-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left pb-1 pr-2">Name</th>
                      <th className="text-right pb-1 pr-1">Score</th>
                      <th className="text-right pb-1 pr-1">Int</th>
                      <th className="text-right pb-1 pr-1">Pos</th>
                      <th className="text-right pb-1 pr-1">Flow</th>
                      <th className="text-right pb-1 pr-1">Prog</th>
                      <th className="text-left pb-1">Class</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.scored_top10.map((c, i) => (
                      <tr key={i} className="border-b border-border/30 last:border-0">
                        <td className="py-1 pr-2 font-semibold truncate max-w-[120px]">{c.name}</td>
                        <td className="py-1 pr-1 text-right font-bold text-primary">{c.total_score}</td>
                        <td className="py-1 pr-1 text-right text-muted-foreground">{c.intrinsic}</td>
                        <td className="py-1 pr-1 text-right text-muted-foreground">{c.position}</td>
                        <td className="py-1 pr-1 text-right text-muted-foreground">{c.flow}</td>
                        <td className="py-1 pr-1 text-right font-mono">{c.progress}</td>
                        <td className="py-1 text-[9px] text-muted-foreground">{c.classification?.replace("_candidate","")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* ── 5. STOPS SELECTED ─────────────────────────────────────────────── */}
          <Section title="Stops Selected" badge={`${allStops.length} total`} defaultOpen>
            {allStops.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No stops selected</p>
            ) : (
              <div>
                {journey.main_stops?.map((s, i) => <StopRow key={i} stop={s} type="main" />)}
                {journey.quick_stops?.map((s, i) => <StopRow key={i} stop={s} type="quick" />)}
              </div>
            )}
            {d.l7_compose_trace?.filter(t => t.reason?.includes("cluster") || t.reason?.includes("redundant")).length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Compose rejections</p>
                {d.l7_compose_trace.filter(t => !t.reason?.includes("at")).map((t, i) => (
                  <div key={i} className="text-[10px] font-mono text-amber-700">
                    [{t.step}] {t.name || "—"} → {t.reason}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ── 6. WHY STOPS REJECTED ─────────────────────────────────────────── */}
          {!isMultiDay && (d.l8_validation?.removed?.length > 0 || d.corridor_rejected_sample?.length > 0) && (
            <Section title="Why Stops Rejected">
              {d.l8_validation?.removed?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">L8 Removed</p>
                  {d.l8_validation.removed.map((r, i) => (
                    <div key={i} className="text-[10px] font-mono text-red-600">{r.name}: <span className="text-amber-700">{r.reason}</span></div>
                  ))}
                </div>
              )}
              {d.corridor_rejected_sample?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1 mt-2">Corridor Gate</p>
                  <div className="max-h-28 overflow-auto space-y-0.5">
                    {d.corridor_rejected_sample.slice(0, 12).map((r, i) => (
                      <div key={i} className="text-[10px] font-mono text-muted-foreground">{r.name}: <span className="text-amber-600">{r.reason}</span></div>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* ── 7. L8 VALIDATION STATUS ───────────────────────────────────────── */}
          {!isMultiDay && <Section title="L8 Validation" badge={d.l8_status}>
            <Row label="Status" value={d.l8_status} color={d.l8_status?.startsWith("PASS") ? "text-emerald-600" : "text-red-500"} />
            <Row label="Result status" value={journey.result_status} color={`text-${statusColor}-600`} />
            <Row label="Stops before" value={d.l8_validation?.stops_before} />
            <Row label="Stops after" value={d.l8_validation?.stops_after} />
            <Row label="Removed" value={d.l8_validation?.removed_count} color={d.l8_validation?.removed_count > 0 ? "text-amber-600" : ""} />
            <Row label="Route mode" value={d.l8_validation?.route_mode_used} />
            <Row label="Anchor present" value={d.l8_validation?.anchor_present ? "✓ yes" : "✗ no"} />
            {d.l8_validation?.credibility_flags?.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {d.l8_validation.credibility_flags.map((f, i) => (
                  <Tag key={i} color={f.fatal ? "red" : "amber"}>{f.reason}</Tag>
                ))}
              </div>
            )}
          </Section>}

          {/* ── 8. ON-DEMAND ──────────────────────────────────────────────────── */}
          {!isMultiDay && d.on_demand_triggered && (
            <Section title="On-Demand Generation">
              <Row label="Triggered" value={d.on_demand_triggered ? "yes" : "no"} color={d.on_demand_triggered ? "text-amber-600" : ""} />
              <Row label="Injected" value={d.on_demand_injected ?? "—"} />
              <Row label="Result" value={d.on_demand_result || "—"} />
            </Section>
          )}

          {/* ── 9. PARTIAL NOTE ───────────────────────────────────────────────── */}
          {journey.partial_match_note && (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-[11px] text-amber-800 italic">{journey.partial_match_note}</p>
            </div>
          )}

        </div>
      )}
    </div>
  );
}