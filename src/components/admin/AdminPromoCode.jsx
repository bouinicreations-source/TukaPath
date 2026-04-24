import React, { useState } from "react";
import { base44 } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";

export default function AdminPromoCode() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", reward_type: "credits", value: "", expiry: "", usage_limit: "", description: "" });

  const { data: codes = [] } = useQuery({
    queryKey: ["promo-codes"],
    queryFn: () => base44.entities.PromoCode.list("-created_date"),
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    await base44.entities.PromoCode.create({ ...form, value: Number(form.value), usage_limit: Number(form.usage_limit) || 0, active: true });
    queryClient.invalidateQueries({ queryKey: ["promo-codes"] });
    toast.success("Promo code created!");
    setShowForm(false);
    setForm({ code: "", reward_type: "credits", value: "", expiry: "", usage_limit: "", description: "" });
  };

  const toggleActive = async (code) => {
    await base44.entities.PromoCode.update(code.id, { active: !code.active });
    queryClient.invalidateQueries({ queryKey: ["promo-codes"] });
  };

  const handleDelete = async (id) => {
    await base44.entities.PromoCode.delete(id);
    queryClient.invalidateQueries({ queryKey: ["promo-codes"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-1" /> New Promo Code
        </Button>
      </div>

      {showForm && (
        <Card className="p-4">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Code</Label>
                <Input placeholder="WELCOME10" value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Reward Type</Label>
                <Select value={form.reward_type} onValueChange={v => setForm({...form, reward_type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credits">Credits</SelectItem>
                    <SelectItem value="discount_percent">Discount %</SelectItem>
                    <SelectItem value="discount_fixed">Discount Fixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Value</Label>
                <Input type="number" placeholder="10" value={form.value} onChange={e => setForm({...form, value: e.target.value})} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Usage Limit (0 = unlimited)</Label>
                <Input type="number" placeholder="100" value={form.usage_limit} onChange={e => setForm({...form, usage_limit: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Expiry Date</Label>
                <Input type="date" value={form.expiry} onChange={e => setForm({...form, expiry: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Input placeholder="Optional note" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90">Create Code</Button>
          </form>
        </Card>
      )}

      <div className="space-y-2">
        {codes.map(code => (
          <Card key={code.id} className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm">{code.code}</span>
                  <Badge variant={code.active ? "default" : "secondary"} className="text-[10px]">
                    {code.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {code.value} {code.reward_type} · Used: {code.used_count || 0}/{code.usage_limit || "∞"}
                  {code.expiry && ` · Expires: ${code.expiry}`}
                </p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => toggleActive(code)}>
                  {code.active ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                </Button>
                <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleDelete(code.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {codes.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">No promo codes yet</p>}
      </div>
    </div>
  );
}