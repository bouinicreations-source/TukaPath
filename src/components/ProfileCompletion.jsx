import React, { useState, useEffect } from "react";
import { supabase } from '@/api/supabase';
import { base44 } from "@/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CountryAutocomplete from "@/components/adventure/CountryAutocomplete";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function ProfileCompletion({ user, onComplete }) {
  const [form, setForm] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    birthdate: user?.birthdate || "",
    gender: user?.gender || "",
    passport_country: user?.passport_country || "",
    country_of_residence: user?.country_of_residence || "",
  });
  const [consent, setConsent] = useState({ terms: false, privacy: false, disclaimer: false, certify: false });
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({});
  const [activeDoc, setActiveDoc] = useState(null);
  const [ageError, setAgeError] = useState("");

  useEffect(() => {
    base44.entities.SiteSettings.list().then(rows => {
      const map = {};
      rows.forEach(r => { map[r.key] = r.value; });
      setSettings(map);
    }).catch(() => {});
  }, []);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const allConsented = consent.terms && consent.privacy && consent.disclaimer && consent.certify;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim() || !form.birthdate || !form.gender) {
      toast.error("Please fill in all required fields."); return;
    }
    // Age check
    const minAge = parseInt(settings.min_age || "13", 10);
    const dob = new Date(form.birthdate);
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (age < minAge) {
      setAgeError(`You must be at least ${minAge} years old to register.`); return;
    }
    setAgeError("");
    if (!allConsented) { toast.error("Please accept all required consents."); return; }

    setSaving(true);
    const full_name = `${form.first_name.trim()} ${form.last_name.trim()}`;
    const storedRef = localStorage.getItem("tukapath_ref");
    await supabase.auth.updateUser({ data: {
      ...form,
      full_name,
      consent_terms_version: settings.terms_version || "1",
      consent_privacy_version: settings.privacy_version || "1",
      consent_disclaimer_version: settings.disclaimer_version || "1",
      ...(storedRef ? { referred_by: storedRef } : {}),
    } });
    if (storedRef) localStorage.removeItem("tukapath_ref");
    toast.success("Welcome to TukaPath! 🌍");
    onComplete({ ...user, ...form, full_name });
  };

  const docs = [
    { key: "terms", label: "Terms and Conditions" },
    { key: "privacy", label: "Privacy Policy" },
    { key: "disclaimer", label: "Disclaimer" },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-3">
            <span className="text-2xl font-black text-white">T</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Complete Your Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">Just a few details to get you started</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">First Name <span className="text-destructive">*</span></Label>
                <Input placeholder="Sara" value={form.first_name} onChange={e => update("first_name", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Last Name <span className="text-destructive">*</span></Label>
                <Input placeholder="Ahmed" value={form.last_name} onChange={e => update("last_name", e.target.value)} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Birthdate <span className="text-destructive">*</span></Label>
              <Input
                type="date"
                value={form.birthdate}
                onChange={e => { update("birthdate", e.target.value); setAgeError(""); }}
                required
                max={new Date().toISOString().split("T")[0]}
              />
              {ageError && <p className="text-xs text-destructive">{ageError}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Gender <span className="text-destructive">*</span></Label>
              <Select value={form.gender} onValueChange={v => update("gender", v)} required>
                <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                  <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-xs text-muted-foreground mb-3">Optional — used for personalised visa & travel suggestions</p>
              <div className="space-y-1.5 mb-3">
                <Label className="text-xs font-medium">Passport Country</Label>
                <CountryAutocomplete value={form.passport_country} onChange={v => update("passport_country", v)} placeholder="e.g. Netherlands" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Country of Residence</Label>
                <CountryAutocomplete value={form.country_of_residence} onChange={v => update("country_of_residence", v)} placeholder="e.g. Germany" />
              </div>
            </div>

            {/* Legal consent */}
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-xs font-semibold">Required Consents</p>

              {/* Active doc preview */}
              {activeDoc && (
                <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground max-h-40 overflow-y-auto whitespace-pre-wrap border border-border">
                  {settings[`${activeDoc}_text`] || "Content not yet configured."}
                </div>
              )}

              {docs.map(({ key, label }) => (
                <div key={key} className="flex items-start gap-2">
                  <Checkbox
                    id={`c-${key}`}
                    checked={consent[key]}
                    onCheckedChange={c => setConsent(s => ({ ...s, [key]: !!c }))}
                    className="mt-0.5"
                  />
                  <Label htmlFor={`c-${key}`} className="text-xs leading-relaxed cursor-pointer">
                    I have read and agree to the{" "}
                    <button type="button" className="text-primary underline" onClick={() => setActiveDoc(activeDoc === key ? null : key)}>
                      {label}
                    </button>
                  </Label>
                </div>
              ))}

              <div className="flex items-start gap-2">
                <Checkbox
                  id="c-certify"
                  checked={consent.certify}
                  onCheckedChange={c => setConsent(s => ({ ...s, certify: !!c }))}
                  className="mt-0.5"
                />
                <Label htmlFor="c-certify" className="text-xs leading-relaxed cursor-pointer">
                  I certify that the information I provided is correct.
                </Label>
              </div>
            </div>

            <Button
              type="submit"
              disabled={saving || !allConsented}
              className="w-full h-11 bg-primary hover:bg-primary/90 font-semibold"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : "Start Exploring →"}
            </Button>

            <p className="text-[10px] text-center text-muted-foreground">
              You can update your details anytime from your profile.
            </p>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}