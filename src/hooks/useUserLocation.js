import { useState, useEffect } from "react";

// Returns user's current country/city via browser geolocation + ipapi reverse geocode
export default function useUserLocation() {
  const [location, setLocation] = useState({
    country: null,       // e.g. "Qatar"
    country_code: null,  // e.g. "QA"
    city: null,          // e.g. "Doha"
    loading: true,
    denied: false,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation(l => ({ ...l, loading: false, denied: true }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 4000);
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
            { signal: controller.signal }
          ).finally(() => clearTimeout(timeout));
          const data = await res.json();
          setLocation({
            country: data.countryName || null,
            country_code: data.countryCode || null,
            city: data.city || data.locality || null,
            loading: false,
            denied: false,
          });
        } catch {
          // Geo succeeded but reverse geocode failed — still not denied
          setLocation(l => ({ ...l, loading: false }));
        }
      },
      () => {
        // User denied or unavailable
        setLocation({ country: null, country_code: null, city: null, loading: false, denied: true });
      },
      { timeout: 6000, maximumAge: 300000 }
    );
  }, []);

  return location;
}