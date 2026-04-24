/**
 * AirportGenerator — fetches commercial passenger airports via Google Places API,
 * lets admin review and approve, then saves to the Airport entity.
 */
import React, { useState } from "react";
import { base44 } from "@/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Plane, Search, Check, X, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function AirportGenerator({ onBack }) {
  const queryClient = useQueryClient();
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [approved, setApproved] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleFetch = async () => {
    if (!country.trim()) { toast.error("Country is required"); return; }
    setLoading(true);
    setCandidates([]);
    setApproved(new Set());
    setSaved(false);

    const res = await base44.functions.invoke("generateAirports", {
      country: country.trim(),
      city: city.trim() || null,
    });

    setLoading(false);

    if (res.data?.error) {
      toast.error(res.data.error);
      return;
    }

    const results = res.data?.airports || [];
    setCandidates(results);
    // Pre-approve all non-duplicate results
    setApproved(new Set(results.filter(a => !a.duplicate_flag).map(a => a.place_id)));
    if (results.length === 0) toast.info("No airports found for that query.");
    else toast.success(`Found ${results.length} airports`);
  };

  const toggleApprove = (placeId) => {
    setApproved(prev => {
      const next = new Set(prev);
      next.has(placeId) ? next.delete(placeId) : next.add(placeId);
      return next;
    });
  };

  const handleSave = async () => {
    const toSave = candidates.filter(a => approved.has(a.place_id));
    if (!toSave.length) { toast.error("Select at least one airport to save"); return; }
    setSaving(true);

    let saved = 0, failed = 0;
    for (const airport of toSave) {
      try {
        await base44.entities.Airport.create({
          airport_iata: airport.iata || "",
          airport_name: airport.name,
          city: airport.city,
          country: airport.country,
          latitude: airport.latitude,
          longitude: airport.longitude,
        });
        saved++;
      } catch { failed++; }
    }

    queryClient.invalidateQueries(["airports"]);
    setSaving(false);
    setSaved(true);
    if (failed === 0) toast.success(`Saved ${saved} airports`);
    else toast.warning(`Saved ${saved}, failed ${failed}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Plane className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold">Generate Airports via API</h3>
          <p className="text-xs text-muted-foreground">Fetch commercial airports from Google Places</p>
        </div>
      </div>

      {/* Query form */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Country *</Label>
            <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. Qatar" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">City (optional)</Label>
            <Input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Doha" />
          </div>
        </div>
        <Button
          className="w-full bg-primary hover:bg-primary/90"
          onClick={handleFetch}
          disabled={loading}
        >
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Fetching…</> : <><Search className="w-4 h-4 mr-2" /> Fetch Airports</>}
        </Button>
      </Card>

      {/* Candidates */}
      {candidates.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{candidates.length} airports found</p>
            <p className="text-xs text-muted-foreground">{approved.size} selected</p>
          </div>

          <div className="space-y-2">
            {candidates.map(airport => {
              const isApproved = approved.has(airport.place_id);
              const isDupe = airport.duplicate_flag;
              return (
                <Card
                  key={airport.place_id}
                  className={`p-3 flex items-center gap-3 cursor-pointer transition-all border-2 ${
                    isDupe ? "opacity-50 border-border" :
                    isApproved ? "border-primary/40 bg-primary/5" : "border-border hover:border-muted-foreground/30"
                  }`}
                  onClick={() => !isDupe && toggleApprove(airport.place_id)}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                    isApproved && !isDupe ? "bg-primary border-primary" : "border-border"
                  }`}>
                    {isApproved && !isDupe && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <div className="w-12 text-center">
                    <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      {airport.iata || "—"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{airport.name}</p>
                    <p className="text-[11px] text-muted-foreground">{airport.city}, {airport.country}</p>
                  </div>
                  {isDupe && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">
                      Already in DB
                    </span>
                  )}
                </Card>
              );
            })}
          </div>

          {!saved && (
            <Button
              className="w-full bg-primary hover:bg-primary/90"
              onClick={handleSave}
              disabled={saving || approved.size === 0}
            >
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : `Save ${approved.size} Airport${approved.size !== 1 ? "s" : ""}`}
            </Button>
          )}

          {saved && (
            <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-center">
              <Check className="w-5 h-5 text-green-600 mx-auto mb-1" />
              <p className="text-sm font-semibold text-green-700">Airports saved successfully</p>
              <button onClick={() => { setCandidates([]); setSaved(false); }} className="text-xs text-green-600 underline mt-1">
                Search again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}