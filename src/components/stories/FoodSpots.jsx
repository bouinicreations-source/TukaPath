import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UtensilsCrossed, ExternalLink } from "lucide-react";

export default function FoodSpots({ spots }) {
  const displaySpots = spots.slice(0, 3);

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
        <UtensilsCrossed className="w-4 h-4 text-accent" /> Worth a Stop Nearby
      </h3>
      <div className="space-y-2">
        {displaySpots.map((spot, i) => (
          <Card key={i} className="p-3 border-border">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{spot.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{spot.description}</p>
                {spot.distance && (
                  <p className="text-[10px] text-muted-foreground/60 mt-1">{spot.distance}</p>
                )}
              </div>
              {spot.maps_url && (
                <Button variant="ghost" size="icon" className="w-8 h-8 flex-shrink-0" onClick={() => window.open(spot.maps_url, "_blank")}>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}