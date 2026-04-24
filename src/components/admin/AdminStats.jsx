import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MapPin, Headphones, Star, Gift, Coins } from "lucide-react";

export default function AdminStats() {
  const { data: locations = [] } = useQuery({
    queryKey: ["admin-locations"],
    queryFn: () => base44.entities.Location.list(),
  });
  const { data: ratings = [] } = useQuery({
    queryKey: ["admin-ratings"],
    queryFn: () => base44.entities.Rating.list(),
  });
  const { data: discoveries = [] } = useQuery({
    queryKey: ["admin-discoveries"],
    queryFn: () => base44.entities.Discovery.list(),
  });
  const { data: storyPlays = [] } = useQuery({
    queryKey: ["admin-plays"],
    queryFn: () => base44.entities.StoryPlay.list(),
  });

  const totalListens = storyPlays.length;
  const avgRating = ratings.length > 0
    ? (ratings.reduce((s, r) => s + (r.place_rating || 0), 0) / ratings.length).toFixed(1)
    : "N/A";

  const topCities = Object.entries(
    locations.reduce((acc, l) => { acc[l.city] = (acc[l.city] || 0) + (l.total_listens || 0); return acc; }, {})
  ).sort(([, a], [, b]) => b - a).slice(0, 5);

  const stats = [
    { label: "Locations", value: locations.length, icon: MapPin, color: "text-primary" },
    { label: "Total Listens", value: totalListens, icon: Headphones, color: "text-accent" },
    { label: "Ratings", value: ratings.length, icon: Star, color: "text-accent" },
    { label: "Avg Rating", value: avgRating, icon: Star, color: "text-destructive" },
    { label: "Discoveries", value: discoveries.length, icon: Gift, color: "text-primary" },
    { label: "Pending", value: discoveries.filter(d => d.status === "pending").length, icon: Coins, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {topCities.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top Cities by Listens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topCities.map(([city, listens]) => (
                <div key={city} className="flex items-center justify-between text-sm">
                  <span>{city}</span>
                  <span className="font-medium">{listens} listens</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}