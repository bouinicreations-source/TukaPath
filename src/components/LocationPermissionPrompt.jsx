import React from "react";
import { MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LocationPermissionPrompt({ onAllow, onDeny }) {
  return (
    <div className="fixed inset-0 z-[2000] bg-background flex flex-col items-center justify-center px-8 text-center">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <MapPin className="w-10 h-10 text-primary" />
      </div>
      <h2 className="text-xl font-bold mb-3">Enable Location</h2>
      <p className="text-sm text-muted-foreground leading-relaxed mb-2">
        TukaPath uses your location to show stories and hidden places near you.
      </p>
      <p className="text-xs text-muted-foreground mb-8">
        Your location is only used in real time and is never stored.
      </p>
      <Button className="w-full max-w-xs mb-3 rounded-full" onClick={onAllow}>
        <Navigation className="w-4 h-4 mr-2" /> Allow Location Access
      </Button>
      <button
        onClick={onDeny}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Not now — browse without location
      </button>
    </div>
  );
}