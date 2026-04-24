import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plane, Hotel, Map, Wifi, Shield } from "lucide-react";
import { toast } from "sonner";

const CATEGORY_CONFIG = {
  flights: { label: "Find Flights", icon: Plane, defaultUrl: "https://www.kiwi.com" },
  hotels: { label: "Find Hotels", icon: Hotel, defaultUrl: "https://www.booking.com" },
  tours: { label: "Book Tours", icon: Map, defaultUrl: "https://www.viator.com" },
  esim: { label: "Get eSIM", icon: Wifi, defaultUrl: "https://www.airalo.com" },
  insurance: { label: "Travel Insurance", icon: Shield, defaultUrl: "https://www.worldnomads.com" },
};

export default function AffiliateButtons({ city, country, hotel_booking_link, flight_booking_link, attraction_booking_link }) {
  const { data: partners = [] } = useQuery({
    queryKey: ["affiliate-links"],
    queryFn: () => base44.entities.AffiliateLink.filter({ active: true }),
    staleTime: 300000,
  });

  const { data: settingsRows = [] } = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => base44.entities.SiteSettings.list(),
    staleTime: 300000,
  });
  const siteSettings = {};
  settingsRows.forEach(r => { siteSettings[r.key] = r.value; });

  const trackAndOpen = async (partner, fallbackUrl, customUrl) => {
    // Custom link from location overrides everything
    if (customUrl) { window.open(customUrl, "_blank"); return; }
    if (partner) {
      await base44.entities.AffiliateLink.update(partner.id, { click_count: (partner.click_count || 0) + 1 });
      let url = partner.deep_link_template || partner.base_url;
      if (city) url = url.replace("{to}", encodeURIComponent(city)).replace("{destination}", encodeURIComponent(city));
      if (country) url = url.replace("{country}", encodeURIComponent(country));
      window.open(url, "_blank");
    } else {
      window.open(fallbackUrl, "_blank");
    }
  };

  const categories = ["flights", "hotels", "tours", "esim", "insurance"];
  // Override default URLs with admin settings
  const resolvedDefaults = {
    flights: siteSettings.flight_default_link || CATEGORY_CONFIG.flights.defaultUrl,
    hotels: siteSettings.hotel_default_link || CATEGORY_CONFIG.hotels.defaultUrl,
    tours: siteSettings.attraction_default_link || CATEGORY_CONFIG.tours.defaultUrl,
  };
  // Override labels with admin settings
  const resolvedLabels = {
    flights: siteSettings.flight_button_label || CATEGORY_CONFIG.flights.label,
    hotels: siteSettings.hotel_button_label || CATEGORY_CONFIG.hotels.label,
    tours: siteSettings.attraction_button_label || CATEGORY_CONFIG.tours.label,
  };
  const customLinks = { flights: flight_booking_link, hotels: hotel_booking_link, tours: attraction_booking_link };
  const disclaimers = {
    hotels: siteSettings.hotel_disclaimer,
    flights: siteSettings.flight_disclaimer,
    tours: siteSettings.attraction_disclaimer,
  };

  return (
    <Card className="mt-4 p-4">
      <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Book for your trip</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {categories.map(cat => {
          const config = CATEGORY_CONFIG[cat];
          const partner = partners.find(p => p.category === cat);
          const Icon = config.icon;
          const label = resolvedLabels[cat] || config.label;
          const defaultUrl = resolvedDefaults[cat] || config.defaultUrl;
          return (
            <Button
              key={cat}
              variant="outline"
              size="sm"
              className="h-11 justify-start px-3 text-[10px]"
              onClick={() => trackAndOpen(partner, defaultUrl, customLinks[cat])}
            >
              <Icon className="w-3.5 h-3.5 mr-2 text-primary shrink-0" />
              <span className="truncate leading-tight">{label}</span>
            </Button>
          );
        })}
      </div>
      {/* Per-category disclaimers */}
      {(disclaimers.hotels || disclaimers.flights || disclaimers.tours) && (
        <div className="mt-2 space-y-0.5">
          {disclaimers.hotels && <p className="text-[9px] text-muted-foreground">🏨 {disclaimers.hotels}</p>}
          {disclaimers.flights && <p className="text-[9px] text-muted-foreground">✈️ {disclaimers.flights}</p>}
          {disclaimers.tours && <p className="text-[9px] text-muted-foreground">🎟️ {disclaimers.tours}</p>}
        </div>
      )}
      <p className="text-[9px] text-muted-foreground mt-2">Bookings handled by third parties. Prices may vary.</p>
    </Card>
  );
}