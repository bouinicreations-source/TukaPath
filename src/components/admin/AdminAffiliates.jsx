import React, { useState } from "react";
import { base44 } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["flights", "hotels", "tours", "insurance", "esim"];

export default function AdminAffiliates() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ partner_name: "", category: "flights", affiliate_id: "", base_url: "", deep_link_template: "" });

  const { data: partners = [] } = useQuery({
    queryKey: ["affiliate-links"],
    queryFn: () => base44.entities.AffiliateLink.list(),
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    await base44.entities.AffiliateLink.create({ ...form, active: true, click_count: 0 });
    queryClient.invalidateQueries({ queryKey: ["affiliate-links"] });
    toast.success("Affiliate partner added!");
    setShowForm(false);
    setForm({ partner_name: "", category: "flights", affiliate_id: "", base_url: "", deep_link_template: "" });
  };

  const handleDelete = async (id) => {
    await base44.entities.AffiliateLink.delete(id);
    queryClient.invalidateQueries({ queryKey: ["affiliate-links"] });
  };

  const toggleActive = async (partner) => {
    await base44.entities.AffiliateLink.update(partner.id, { active: !partner.active });
    queryClient.invalidateQueries({ queryKey: ["affiliate-links"] });
  };

  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = partners.filter(p => p.category === cat);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-1" /> Add Partner
        </Button>
      </div>

      {showForm && (
        <Card className="p-4">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Partner Name</Label>
                <Input placeholder="Kiwi.com" value={form.partner_name} onChange={e => setForm({...form, partner_name: e.target.value})} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Base URL</Label>
                <Input placeholder="https://kiwi.com" value={form.base_url} onChange={e => setForm({...form, base_url: e.target.value})} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Affiliate ID</Label>
                <Input placeholder="tukapath123" value={form.affiliate_id} onChange={e => setForm({...form, affiliate_id: e.target.value})} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Deep Link Template (optional)</Label>
              <Input placeholder="https://kiwi.com/search?affiliate={id}&from={from}&to={to}" value={form.deep_link_template} onChange={e => setForm({...form, deep_link_template: e.target.value})} />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90">Add Partner</Button>
          </form>
        </Card>
      )}

      {CATEGORIES.map(cat => (
        grouped[cat].length > 0 && (
          <div key={cat}>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{cat}</h4>
            <div className="space-y-2">
              {grouped[cat].map(p => (
                <Card key={p.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{p.partner_name}</span>
                        <Badge variant={p.active ? "default" : "secondary"} className="text-[10px]">
                          {p.active ? "Active" : "Off"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{p.base_url} · {p.click_count || 0} clicks</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => toggleActive(p)}>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleDelete(p.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )
      ))}
    </div>
  );
}