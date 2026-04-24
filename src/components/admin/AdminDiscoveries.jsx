import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, MapPin, Calendar } from "lucide-react";
import { toast } from "sonner";
import moment from "moment";

export default function AdminDiscoveries() {
  const queryClient = useQueryClient();
  const [selectedDiscovery, setSelectedDiscovery] = useState(null);
  const [adminNotes, setAdminNotes] = useState("");

  const { data: discoveries = [], isLoading } = useQuery({
    queryKey: ["admin-discoveries"],
    queryFn: () => base44.entities.Discovery.list("-created_date"),
  });

  const handleApprove = async (discovery) => {
    // Create location from discovery as user_contribution
    await base44.entities.Location.create({
      name: discovery.place_name,
      description: discovery.description,
      latitude: discovery.latitude,
      longitude: discovery.longitude,
      city: "",
      country: "",
      source: "user_contribution",
      contributor_name: "Tuka Explorer",
      contributor_email: discovery.created_by,
      status: "active",
    });

    await base44.entities.Discovery.update(discovery.id, {
      status: "approved",
      admin_notes: adminNotes,
    });

    // Reward user with credits
    const creator = await base44.entities.User.filter({ email: discovery.created_by });
    if (creator.length > 0) {
      const user = creator[0];
      await base44.entities.User.update(user.id, { credits: (user.credits || 10) + 10 });
    }

    toast.success("Approved! Added to Explorer Contributions.");
    setSelectedDiscovery(null);
    setAdminNotes("");
    queryClient.invalidateQueries({ queryKey: ["admin-discoveries"] });
    queryClient.invalidateQueries({ queryKey: ["admin-locations"] });
  };

  const handleReject = async (discovery) => {
    await base44.entities.Discovery.update(discovery.id, {
      status: "rejected",
      admin_notes: adminNotes,
    });
    toast.success("Discovery rejected");
    setSelectedDiscovery(null);
    setAdminNotes("");
    queryClient.invalidateQueries({ queryKey: ["admin-discoveries"] });
  };

  const pending = discoveries.filter((d) => d.status === "pending");

  if (selectedDiscovery) {
    return (
      <div>
        <Button variant="ghost" onClick={() => setSelectedDiscovery(null)} className="mb-4">
          ← Back to List
        </Button>

        <Card className="p-5">
          <h3 className="font-bold mb-4">{selectedDiscovery.place_name}</h3>

          <div className="space-y-3 text-sm mb-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>GPS: {selectedDiscovery.latitude?.toFixed(4)}, {selectedDiscovery.longitude?.toFixed(4)}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{moment(selectedDiscovery.created_date).format("MMM D, YYYY")}</span>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Submitted by</p>
              <p className="text-sm">{selectedDiscovery.created_by}</p>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
            <p className="text-sm leading-relaxed">{selectedDiscovery.description}</p>
          </div>

          {selectedDiscovery.video_proof_url && (
            <div className="mb-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">Proof</p>
              <a href={selectedDiscovery.video_proof_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                View attachment
              </a>
            </div>
          )}

          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Admin Notes</p>
            <Textarea
              placeholder="Internal notes (optional)"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className="h-20"
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => handleReject(selectedDiscovery)}
              className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
            >
              <XCircle className="w-4 h-4 mr-1" /> Reject
            </Button>
            <Button
              onClick={() => handleApprove(selectedDiscovery)}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              <CheckCircle2 className="w-4 h-4 mr-1" /> Approve (+10 credits)
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pending.length > 0 ? (
        <>
          <p className="text-xs text-muted-foreground">{pending.length} pending review</p>
          <div className="space-y-2">
            {pending.map((d) => (
              <Card key={d.id} className="p-4 hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setSelectedDiscovery(d)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{d.place_name}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-1.5">{moment(d.created_date).fromNow()} • {d.created_by}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">{isLoading ? "Loading..." : "No pending submissions"}</p>
        </Card>
      )}
    </div>
  );
}