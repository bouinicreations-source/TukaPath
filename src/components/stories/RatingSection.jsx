import React, { useState } from "react";
import { base44 } from "@/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { motion } from "framer-motion";

function StarRating({ value, onChange, label }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} onClick={() => onChange(star)} type="button">
            <Star
              className={`w-6 h-6 transition-colors ${
                star <= value ? "fill-accent text-accent" : "text-muted-foreground/30"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function RatingSection({ locationId }) {
  const [placeRating, setPlaceRating] = useState(0);
  const [storyRating, setStoryRating] = useState(0);
  const [remarks, setRemarks] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (placeRating === 0 && storyRating === 0) return;
    setSubmitting(true);
    await base44.entities.Rating.create({
      location_id: locationId,
      place_rating: placeRating,
      story_rating: storyRating,
      remarks,
    });
    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <Card className="mt-6 p-5 bg-primary/5 border-primary/10 text-center">
          <p className="text-sm font-semibold text-primary">Thank you for your feedback!</p>
        </Card>
      </motion.div>
    );
  }

  return (
    <Card className="mt-6 p-5 border-border">
      <h3 className="text-sm font-semibold mb-4">Rate this Experience</h3>
      <div className="space-y-4">
        <StarRating value={placeRating} onChange={setPlaceRating} label="Rate the place" />
        <StarRating value={storyRating} onChange={setStoryRating} label="Rate the story" />
        <Textarea
          placeholder="Any feedback? (optional)"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          className="h-20 text-sm"
        />
        <Button
          onClick={handleSubmit}
          disabled={submitting || (placeRating === 0 && storyRating === 0)}
          className="w-full rounded-xl bg-primary hover:bg-primary/90"
        >
          {submitting ? "Submitting..." : "Submit Rating"}
        </Button>
      </div>
    </Card>
  );
}