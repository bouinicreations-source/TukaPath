import React, { useState } from "react";
import { base44 } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, User, ChevronDown, ChevronUp, Download } from "lucide-react";
import { toast } from "sonner";

const ROLES = ["owner", "admin", "editor", "analyst", "user"];
const TIERS = ["Explorer", "Pioneer", "Trailblazer", "Legend"];

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [creditInputs, setCreditInputs] = useState({});

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => base44.entities.User.list("-created_date", 200),
  });

  const filtered = users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const updateUser = async (userId, data) => {
    await base44.entities.User.update(userId, data);
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    toast.success("Updated!");
  };

  const applyCredits = async (u) => {
    const delta = parseInt(creditInputs[u.id] || "0");
    if (isNaN(delta)) return toast.error("Enter a valid number");
    await updateUser(u.id, { credits: (u.credits || 0) + delta });
    setCreditInputs(prev => ({ ...prev, [u.id]: "" }));
  };

  const handleExport = () => {
    const fields = ["full_name","email","role","credits","explorer_level","passport_country","residence_country","created_date"];
    const header = fields.join(",");
    const lines = users.map(r => fields.map(f => `"${String(r[f] ?? "").replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "users_export.csv"; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{users.length} total users</p>
        <Button size="sm" variant="outline" className="text-xs" onClick={handleExport}>
          <Download className="w-3 h-3 mr-1" /> Download Data
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="space-y-2">
        {filtered.map(u => {
          const expanded = expandedId === u.id;
          return (
            <Card key={u.id} className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {u.profile_photo_url
                    ? <img src={u.profile_photo_url} alt="" className="w-full h-full object-cover" />
                    : <User className="w-4 h-4 text-primary" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.full_name || "—"}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                  <p className="text-[10px] text-muted-foreground">{u.credits || 0} credits · {u.explorer_level || "—"}</p>
                </div>
                <Select value={u.role || "user"} onValueChange={(v) => updateUser(u.id, { role: v })}>
                  <SelectTrigger className="w-24 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r} value={r} className="text-xs capitalize">{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setExpandedId(expanded ? null : u.id)}>
                  {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </Button>
              </div>

              {expanded && (
                <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-3">
                  {/* Tier */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Explorer Tier</p>
                    <Select value={u.explorer_level || ""} onValueChange={v => updateUser(u.id, { explorer_level: v })}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select tier" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIERS.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Credits */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Add / Remove Credits (current: {u.credits || 0})</p>
                    <div className="flex gap-1">
                      <Input
                        type="number"
                        placeholder="e.g. +10 or -5"
                        value={creditInputs[u.id] || ""}
                        onChange={e => setCreditInputs(prev => ({ ...prev, [u.id]: e.target.value }))}
                        className="h-8 text-xs"
                      />
                      <Button size="sm" className="h-8 text-xs px-3" onClick={() => applyCredits(u)}>Apply</Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
        {isLoading && <p className="text-center text-sm text-muted-foreground py-6">Loading...</p>}
      </div>
    </div>
  );
}