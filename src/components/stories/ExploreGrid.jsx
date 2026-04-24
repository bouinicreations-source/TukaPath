import React from "react";
import { Link } from "react-router-dom";
import { Headphones, MapPin, Lock, Play, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function walkMinutes(m) { return Math.max(1, Math.round(m / 80)); }

function AudioBadge({ loc }) {
  const hasAudio = loc.quick_audio_url || loc.deep_audio_url;
  const hasStory = loc.has_story;
  if (!hasStory && !hasAudio) return null;
  if (hasStory && !hasAudio) {
    return (
      <div className="absolute top-2.5 right-2.5 bg-black/50 backdrop-blur-sm rounded-full p-1.5">
        <Lock className="w-3 h-3 text-white/70" />
      </div>
    );
  }
  return (
    <div className="absolute top-2.5 right-2.5 bg-primary/90 backdrop-blur-sm rounded-full p-1.5 shadow">
      <Headphones className="w-3 h-3 text-white" />
    </div>
  );
}

function MicroSignal({ loc }) {
  if (loc.total_listens > 50) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5">
        <TrendingUp className="w-2.5 h-2.5" /> Popular
      </span>
    );
  }
  if (loc.total_listens > 0) {
    return (
      <span className="text-[9px] text-muted-foreground">{loc.total_listens} listens</span>
    );
  }
  return null;
}

function StoryCard({ loc, userPos, isHero = false }) {
  const dist = userPos ? getDistance(userPos.lat, userPos.lng, loc.latitude, loc.longitude) : null;
  const headline = loc.quick_story || loc.mystery_teaser || loc.description || loc.name;

  return (
    <Link to={`/LocationDetail?id=${loc.id}`} className="block group">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl overflow-hidden bg-card/70 backdrop-blur-sm border border-border/50 active:scale-[0.98] transition-transform"
      >
        {/* Image */}
        <div className={`relative w-full bg-muted overflow-hidden ${isHero ? "h-52" : "aspect-[4/3]"}`}>
          {loc.image_url ? (
            <img src={loc.image_url} alt={loc.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <MapPin className="w-8 h-8 text-muted-foreground/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <AudioBadge loc={loc} />
          {isHero && (
            <div className="absolute bottom-3 left-3 right-3">
              <p className="text-white text-sm font-semibold leading-snug line-clamp-2">{headline}</p>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3">
          {!isHero && (
            <p className="text-sm font-semibold leading-snug line-clamp-2 mb-1">{headline}</p>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground truncate">{loc.name}</p>
              {dist !== null && (
                <p className="text-[10px] text-muted-foreground/70">{walkMinutes(dist)} min walk</p>
              )}
            </div>
            <MicroSignal loc={loc} />
          </div>

          {/* Listen CTA */}
          {(loc.quick_audio_url || loc.has_story) && (
            <Link
              to={`/LocationDetail?id=${loc.id}&play=quick`}
              onClick={e => e.stopPropagation()}
              className="mt-2.5 flex items-center justify-center gap-1.5 w-full h-8 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              <Play className="w-3 h-3" /> Listen
            </Link>
          )}
        </div>
      </motion.div>
    </Link>
  );
}

export default function ExploreGrid({ locations, userPos }) {
  const sorted = [...locations].sort((a, b) => {
    const aAudio = !!(a.quick_audio_url || a.deep_audio_url);
    const bAudio = !!(b.quick_audio_url || b.deep_audio_url);
    if (aAudio !== bAudio) return bAudio - aAudio;
    if (userPos) {
      const dA = getDistance(userPos.lat, userPos.lng, a.latitude, a.longitude);
      const dB = getDistance(userPos.lat, userPos.lng, b.latitude, b.longitude);
      return dA - dB;
    }
    return new Date(b.created_date) - new Date(a.created_date);
  });

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <MapPin className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No places found</p>
      </div>
    );
  }

  const [hero, ...rest] = sorted;

  return (
    <div className="px-4 pb-24 pt-3 space-y-3">
      {/* Hero card — full width */}
      <StoryCard loc={hero} userPos={userPos} isHero />

      {/* Rest — 2-col grid */}
      <div className="grid grid-cols-2 gap-3">
        {rest.map(loc => (
          <StoryCard key={loc.id} loc={loc} userPos={userPos} />
        ))}
      </div>
    </div>
  );
}