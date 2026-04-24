import React, { useState, useEffect } from "react";
import { supabase } from '@/api/supabase';
import { base44 } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Edit2, Eye, EyeOff, Trash2, Image as ImageIcon,
  CheckCircle2, Clock, XCircle, ArrowLeft, Store
} from "lucide-react";
import ExperienceCard from "@/components/partner/ExperienceCard";

// ─── Constants ────────────────────────────────────────────────────────────────

const EXPERIENCE_TYPES = [
  "coffee_stop", "quick_bite", "meal", "fine_dining", "bar", "pub",
  "brunch", "liquid_brunch", "dessert", "shisha", "rooftop", "sunset_spot"
];

const TYPE_LABELS = {
  coffee_stop: "☕ Coffee Stop", quick_bite: "🥐 Quick Bite", meal: "🍽️ Meal",
  fine_dining: "✨ Fine Dining", bar: "🍸 Bar", pub: "🍺 Pub",
  brunch: "🥂 Brunch", liquid_brunch: "🍹 Liquid Brunch", dessert: "🍰 Dessert",
  shisha: "💨 Shisha", rooftop: "🌇 Rooftop", sunset_spot: "🌅 Sunset Spot"
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const CURRENCIES = ["QAR", "USD", "EUR", "GBP", "AED", "SAR"];

// ─── Experience Form ──────────────────────────────────────────────────────────

function ExperienceForm({ partnerId, locationId, experience, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: 0,
    currency: "QAR",
    experience_type: "meal",
    day_of_week: [],
    time_window_start: "",
    time_window_end: "",
    tags: "",
    image_url: "",
    is_active: true,
    ...experience,
    tags: experience?.tags?.join(", ") || "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleDay = (day) => {
    set("day_of_week", form.day_of_week.includes(day)
      ? form.day_of_week.filter(d => d !== day)
      : [...form.day_of_week, day]);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set("image_url", file_url);
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.experience_type) return;
    setSaving(true);
    const payload = {
      ...form,
      partner_id: partnerId,
      location_id: locationId,
      tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
    };
    if (experience?.id) {
      await base44.entities.PartnerExperience.update(experience.id, payload);
    } else {
      await base44.entities.PartnerExperience.create(payload);
    }
    setSaving(false);
    onSave();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl p-5 space-y-4"
    >
      <h3 className="text-sm font-bold">{experience ? "Edit Experience" : "New Experience"}</h3>

      {/* Title */}
      <div>
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Title</label>
        <input value={form.title} onChange={e => set("title", e.target.value)}
          placeholder="e.g. Friday Brunch at Nobu"
          className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:border-primary/40" />
      </div>

      {/* Description */}
      <div>
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Short Description</label>
        <textarea value={form.description} onChange={e => set("description", e.target.value)}
          placeholder="What makes this experience special?"
          rows={2}
          className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:border-primary/40 resize-none" />
      </div>

      {/* Type */}
      <div>
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Experience Type</label>
        <div className="grid grid-cols-2 gap-1.5">
          {EXPERIENCE_TYPES.map(t => (
            <button key={t} onClick={() => set("experience_type", t)}
              className={`text-left text-xs px-3 py-2 rounded-xl border transition-colors ${form.experience_type === t ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"}`}>
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Price */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Price</label>
          <input type="number" value={form.price} onChange={e => set("price", parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:border-primary/40" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Currency</label>
          <select value={form.currency} onChange={e => set("currency", e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:border-primary/40">
            {CURRENCIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Days */}
      <div>
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Available Days (leave empty = all days)</label>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map(day => (
            <button key={day} onClick={() => toggleDay(day)}
              className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-colors ${form.day_of_week.includes(day) ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"}`}>
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {/* Time window */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">From</label>
          <input type="time" value={form.time_window_start} onChange={e => set("time_window_start", e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:border-primary/40" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">To</label>
          <input type="time" value={form.time_window_end} onChange={e => set("time_window_end", e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:border-primary/40" />
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Tags (comma-separated)</label>
        <input value={form.tags} onChange={e => set("tags", e.target.value)}
          placeholder="e.g. Luxury, Friday, Poolside, Live Music"
          className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:border-primary/40" />
      </div>

      {/* Image */}
      <div>
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Image</label>
        {form.image_url ? (
          <div className="relative rounded-xl overflow-hidden h-28">
            <img src={form.image_url} alt="" className="w-full h-full object-cover" />
            <button onClick={() => set("image_url", "")}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center h-20 bg-muted/40 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-muted/60 transition-colors">
            {uploading ? <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <><ImageIcon className="w-5 h-5 text-muted-foreground mb-1" /><span className="text-[11px] text-muted-foreground">Upload image</span></>}
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" className="rounded-xl" onClick={onCancel}>Cancel</Button>
        <Button size="sm" className="flex-1 rounded-xl" onClick={handleSave} disabled={saving || !form.title.trim()}>
          {saving ? "Saving…" : "Save Experience"}
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Status banner ────────────────────────────────────────────────────────────

function StatusBanner({ partner }) {
  if (partner.status === "approved") return (
    <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-medium">
      <CheckCircle2 className="w-4 h-4" /> Account approved — your experiences are live
    </div>
  );
  if (partner.status === "pending") return (
    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-medium">
      <Clock className="w-4 h-4" /> Account pending admin approval
    </div>
  );
  if (partner.status === "rejected") return (
    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
      <XCircle className="w-4 h-4" /> Account rejected — contact support
    </div>
  );
  return null;
}

// ─── Registration form ────────────────────────────────────────────────────────

function RegistrationForm({ user, onRegistered }) {
  const [form, setForm] = useState({ business_name: "", category: "restaurant", sub_category: "casual", contact_email: user?.email || "", phone: "", website: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.business_name.trim() || !form.contact_email.trim()) return;
    setSaving(true);
    await base44.entities.PartnerAccount.create({ ...form, status: "pending" });
    setSaving(false);
    onRegistered();
  };

  return (
    <div className="max-w-lg mx-auto px-5 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Become a Partner</h1>
        <p className="text-sm text-muted-foreground mt-1">Showcase your venue to travelers on route.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        {[
          { label: "Business Name", key: "business_name", placeholder: "e.g. Nobu Doha" },
          { label: "Contact Email", key: "contact_email", placeholder: "hello@yourvenue.com" },
          { label: "Phone", key: "phone", placeholder: "+974 …" },
          { label: "Website", key: "website", placeholder: "https://…" },
        ].map(({ label, key, placeholder }) => (
          <div key={key}>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">{label}</label>
            <input value={form[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder}
              className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:border-primary/40" />
          </div>
        ))}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Category</label>
            <select value={form.category} onChange={e => set("category", e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:border-primary/40">
              {["restaurant", "cafe", "bar", "hotel"].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Style</label>
            <select value={form.sub_category} onChange={e => set("sub_category", e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:border-primary/40">
              {["fine_dining","casual","pub","brunch","lounge","rooftop","bistro","bakery","shisha","other"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <Button className="w-full rounded-xl" onClick={handleSubmit} disabled={saving || !form.business_name.trim()}>
          {saving ? "Submitting…" : "Submit for Review"}
        </Button>
      </div>

      <p className="text-[11px] text-center text-muted-foreground/60">
        Your account will be reviewed within 24–48 hours. We'll link you to a verified TukaPath location.
      </p>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function PartnerDashboard() {
  const [user, setUser] = useState(null);
  const [partner, setPartner] = useState(null);
  const [experiences, setExperiences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExp, setEditingExp] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const u = await supabase.auth.getUser().then(r => r.data.user);
    setUser(u);
    if (u) {
      const partners = await base44.entities.PartnerAccount.filter({ contact_email: u.email });
      if (partners.length > 0) {
        setPartner(partners[0]);
        const exps = await base44.entities.PartnerExperience.filter({ partner_id: partners[0].id });
        setExperiences(exps);
      }
    }
    setLoading(false);
  };

  const toggleActive = async (exp) => {
    await base44.entities.PartnerExperience.update(exp.id, { is_active: !exp.is_active });
    setExperiences(prev => prev.map(e => e.id === exp.id ? { ...e, is_active: !e.is_active } : e));
  };

  const deleteExp = async (exp) => {
    if (!confirm(`Delete "${exp.title}"?`)) return;
    await base44.entities.PartnerExperience.delete(exp.id);
    setExperiences(prev => prev.filter(e => e.id !== exp.id));
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!user) return (
    <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
      Please sign in to access the partner dashboard.
    </div>
  );

  if (!partner) return <RegistrationForm user={user} onRegistered={load} />;

  return (
    <div className="max-w-lg mx-auto px-5 py-6 pb-28 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Store className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold">{partner.business_name}</h1>
          <p className="text-xs text-muted-foreground capitalize">{partner.category} · {partner.sub_category}</p>
        </div>
      </div>

      {/* Status */}
      <StatusBanner partner={partner} />

      {/* Location link */}
      <div className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${partner.location_id && partner.location_link_status === "approved" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
        {partner.location_id && partner.location_link_status === "approved"
          ? <><CheckCircle2 className="w-4 h-4" /> Linked to {partner.location_name || "a verified location"}</>
          : <><Clock className="w-4 h-4" /> Awaiting location link from admin</>
        }
      </div>

      {/* Experiences */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold">Your Experiences</p>
          {partner.status === "approved" && partner.location_id && (
            <Button size="sm" className="rounded-xl gap-1.5 text-xs" onClick={() => { setEditingExp(null); setShowForm(true); }}>
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          )}
        </div>

        <AnimatePresence>
          {showForm && (
            <div className="mb-3">
              <ExperienceForm
                partnerId={partner.id}
                locationId={partner.location_id}
                experience={editingExp}
                onSave={() => { setShowForm(false); setEditingExp(null); load(); }}
                onCancel={() => { setShowForm(false); setEditingExp(null); }}
              />
            </div>
          )}
        </AnimatePresence>

        {experiences.length === 0 && !showForm && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {partner.status !== "approved" ? "Your account needs approval before adding experiences." : "No experiences yet. Add your first one."}
          </div>
        )}

        <div className="space-y-3">
          {experiences.map(exp => (
            <motion.div key={exp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-semibold">{exp.title}</p>
                      {!exp.is_active && <span className="text-[10px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground">Paused</span>}
                      {!exp.admin_approved && <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full border border-amber-200">Pending approval</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{exp.experience_type?.replace(/_/g, " ")} · {exp.price > 0 ? `${exp.price} ${exp.currency}` : "Free"}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPreview(preview?.id === exp.id ? null : exp)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => toggleActive(exp)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      {exp.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => { setEditingExp(exp); setShowForm(true); }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteExp(exp)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {preview?.id === exp.id && (
                  <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t border-border">
                    <div className="p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Preview</p>
                      <ExperienceCard experience={exp} compact />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}