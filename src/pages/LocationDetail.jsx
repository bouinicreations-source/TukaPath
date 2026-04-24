import React, { useState, useEffect } from "react";
import { supabase } from '@/api/supabase';
import { base44 } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import {
  ArrowLeft, Heart, MapPin, Clock, Train, Shield, Eye,
  Headphones, BookOpen, Share2, Copy, Bookmark, ChevronDown, ChevronUp,
  Calendar, Hammer, Lightbulb, RefreshCw, Star, Maximize2, ExternalLink } from
"lucide-react";
import ImageViewer from "@/components/ImageViewer";
import AudioPlayer from "../components/stories/AudioPlayer";
import RatingSection from "../components/stories/RatingSection";
import FoodSpots from "../components/stories/FoodSpots";
import SocialShare from "../components/stories/SocialShare";
import AffiliateButtons from "../components/stories/AffiliateButtons";
import IssueReportButton from "@/components/IssueReportButton";
import TourThisPlace from "../components/stories/TourThisPlace";
import LanguageSelector from "../components/stories/LanguageSelector";
import { motion } from "framer-motion";
import { trackEvent } from "../hooks/useTrackEvent";
import { useAuth } from "@/components/AuthContext";
import GuestSignupModal from "@/components/GuestSignupModal";

export default function LocationDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const locationId = urlParams.get("id");
  const autoPlay = urlParams.get("play");
  const queryClient = useQueryClient();
  const { isGuest } = useAuth();
  const [showGuestModal, setShowGuestModal] = useState(false);

  const [playingType, setPlayingType] = useState(autoPlay || null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [listenLater, setListenLater] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedLang, setSelectedLang] = useState("en");

  const { data: siteSettings = [] } = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => base44.entities.SiteSettings.list()
  });

  const getSetting = (key, fallback = "") => siteSettings.find((s) => s.key === key)?.value ?? fallback;
  const enableReporting = getSetting("enable_issue_reporting", "true") === "true";
  const enablePaidAudio = getSetting("enable_paid_audio", "false") === "true";
  const previewPct = parseInt(getSetting("audio_preview_pct", "70")) || 70;
  const enableVideo = getSetting("enable_video_tutorial", "false") === "true";
  const enableVideoByTier = getSetting("enable_video_by_tier", "false") === "true";
  const allowedTiers = getSetting("video_allowed_tiers", "free,premium").split(",").map((t) => t.trim());

  // Language switching — just update state; AudioPlayer handles translation+audio on play
  const handleLanguageChange = (langCode) => {
    setSelectedLang(langCode);
  };

  const { data: location, isLoading } = useQuery({
    queryKey: ["location", locationId],
    queryFn: async () => {
      const list = await base44.entities.Location.filter({ id: locationId });
      return list[0];
    },
    enabled: !!locationId
  });

  // Display text is always English — we only translate voice scripts for audio
  const displayName = location?.name;
  const displayQuickStory = location?.quick_story;
  const displayDeepStory = location?.deep_story;

  const [user, setUser] = React.useState(null);
  React.useEffect(() => {supabase.auth.getUser().then(r => r.data.user).then(setUser).catch(() => {});}, []);

  const canWatchVideo = !enableVideoByTier || allowedTiers.includes(user?.tier || "free");
  const [showVideo, setShowVideo] = React.useState(false);

  // Track location open once per mount
  useEffect(() => {
    if (locationId) trackEvent("location_opened", { locationId });
  }, [locationId]);

  const { data: favorites = [] } = useQuery({
    queryKey: ["favorites"],
    queryFn: () => base44.entities.Favorite.list()
  });

  const { data: listenLaterList = [] } = useQuery({
    queryKey: ["listenLater"],
    queryFn: () => base44.entities.ListenLater.list()
  });

  useEffect(() => {
    if (favorites.length > 0 && locationId) {
      setIsFavorite(favorites.some((f) => f.item_id === locationId));
    }
  }, [favorites, locationId]);

  useEffect(() => {
    if (listenLaterList.length > 0 && locationId) {
      setListenLater(listenLaterList.some((l) => l.location_id === locationId));
    }
  }, [listenLaterList, locationId]);

  const toggleFavorite = async () => {
    if (isGuest) {setShowGuestModal(true);return;}
    const next = !isFavorite;
    setIsFavorite(next); // optimistic
    if (!next) {
      const fav = favorites.find((f) => f.item_id === locationId);
      if (fav) await base44.entities.Favorite.delete(fav.id);
    } else {
      await base44.entities.Favorite.create({
        item_type: "location",
        item_id: locationId,
        item_name: location?.name,
        city: location?.city
      });
    }
    queryClient.invalidateQueries({ queryKey: ["favorites"] });
  };

  const toggleListenLater = async () => {
    if (isGuest) {setShowGuestModal(true);return;}
    const next = !listenLater;
    setListenLater(next); // optimistic
    if (!next) {
      const item = listenLaterList.find((l) => l.location_id === locationId);
      if (item) await base44.entities.ListenLater.delete(item.id);
    } else {
      await base44.entities.ListenLater.create({
        location_id: locationId,
        location_name: location?.name,
        city: location?.city
      });
    }
    queryClient.invalidateQueries({ queryKey: ["listenLater"] });
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setShowShare(false);
  };

  if (isLoading || !location) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>);

  }

  return (
    <>
    <div className="max-w-lg mx-auto pb-12">
      {/* Header image */}
      <div className="relative h-56 bg-muted overflow-hidden">
        {location.image_url ?
          <img src={location.image_url} alt={location.name} className="w-full h-full object-cover" /> :

          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <MapPin className="w-12 h-12 text-primary/40" />
          </div>
          }
        {enableReporting && location.image_url &&
          <div className="absolute bottom-2 right-2 z-10">
            <IssueReportButton locationId={locationId} locationName={location.name} section="Image" className="bg-black/50 text-white hover:text-white px-2 py-1 rounded-full backdrop-blur-sm" />
          </div>
          }

        {/* View image button */}
        {location.image_url &&
          <button
            onClick={() => setShowImageViewer(true)}
            className="absolute bottom-4 left-3 z-10 flex items-center justify-center bg-white/10 backdrop-blur-sm text-white p-2 rounded-full hover:bg-white/20 transition-colors">
          
            <Maximize2 className="my-2 lucide lucide-maximize2 w-4 h-4" />
          </button>
          }

        {/* Image attribution overlay */}
        {location.image_url && (location.image_source === "unsplash" ? location.image_photographer_name : location.image_source_name || location.image_photographer_name) &&
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2 flex justify-end">
            {location.image_source === "unsplash" ?
            <a
              href={location.image_photographer_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[9px] text-white/70 hover:text-white flex items-center gap-0.5">
            
                📷 {location.image_photographer_name} / <span className="underline">Unsplash</span>
                <ExternalLink className="w-2 h-2 ml-0.5" />
              </a> :

            <span className="text-[9px] text-white/70 flex items-center gap-0.5">
                📷{" "}
                {location.image_photographer_name &&
              <>{location.image_photographer_url ?
                <a href={location.image_photographer_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="underline hover:text-white">{location.image_photographer_name}</a> :
                location.image_photographer_name} via{" "}</>
              }
                {location.image_source_name && (
              location.image_source_url ?
              <a href={location.image_source_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="underline hover:text-white flex items-center gap-0.5">
                      {location.image_source_name} <ExternalLink className="w-2 h-2" />
                    </a> :
              location.image_source_name)
              }
              </span>
            }
          </div>
          }

        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />

        {/* Top buttons */}
        <div className="absolute top-4 left-4 right-4 flex justify-between">
          <Link to="/NearbyStories">
            <Button variant="ghost" size="icon" className="rounded-full bg-card/80 backdrop-blur-sm w-9 h-9">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="rounded-full bg-card/80 backdrop-blur-sm w-9 h-9" onClick={() => setShowShare(!showShare)}>
              <Share2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full bg-card/80 backdrop-blur-sm w-9 h-9" onClick={toggleFavorite}>
              <Heart className={`w-4 h-4 ${isFavorite ? "fill-destructive text-destructive" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Image Viewer modal */}
      {showImageViewer && location.image_url &&
        <ImageViewer
          images={[{
            url: location.image_url,
            alt: location.name,
            source: location.image_source,
            photographer_name: location.image_photographer_name,
            photographer_url: location.image_photographer_url,
            source_name: location.image_source_name,
            source_url: location.image_source_url
          }]}
          initialIndex={0}
          onClose={() => setShowImageViewer(false)} />

        }

      <div className="px-5 -mt-8 relative z-10">
        {/* Title */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="my-4">
          {location.category &&
            <Badge variant="secondary" className="inline-flex items-center rounded-md border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 mb-2 text-[10px] capitalize">{location.category.replace(/_/g, " ")}</Badge>
            }
          <h1 className="text-2xl font-bold">{displayName || location.name}</h1>
          <p className="text-sm text-muted-foreground">{location.city}, {location.country}</p>
          {location.location_id &&
            <p className="text-[10px] text-muted-foreground mt-0.5">ID: {location.location_id}</p>
            }
        </motion.div>

        {/* More Details expandable */}
        {(location.built_year || location.architect_creator || location.original_purpose || location.evolution_over_time || location.why_it_matters_today) &&
          <div className="mt-3">
            <button
              onClick={() => setShowMoreDetails((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
            
              {showMoreDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showMoreDetails ? "Hide Details" : "More Details"}
            </button>
            {showMoreDetails &&
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 space-y-3">
            
                {location.built_year &&
              <div className="flex items-start gap-2.5">
                    <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Built</p>
                      <p className="text-sm">{location.built_year}</p>
                    </div>
                  </div>
              }
                {location.architect_creator &&
              <div className="flex items-start gap-2.5">
                    <Hammer className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Architect / Creator</p>
                      <p className="text-sm">{location.architect_creator}</p>
                    </div>
                  </div>
              }
                {location.original_purpose &&
              <div className="flex items-start gap-2.5">
                    <Lightbulb className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Original Purpose</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{location.original_purpose}</p>
                    </div>
                  </div>
              }
                {location.evolution_over_time &&
              <div className="flex items-start gap-2.5">
                    <RefreshCw className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Evolution Over Time</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{location.evolution_over_time}</p>
                    </div>
                  </div>
              }
                {location.why_it_matters_today &&
              <div className="flex items-start gap-2.5">
                    <Star className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Why It Matters Today</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{location.why_it_matters_today}</p>
                    </div>
                  </div>
              }
              </motion.div>
            }
          </div>
          }

        {/* Mystery Teaser */}
        {location.mystery_teaser &&
          <div className="mt-5 pl-4 border-l-2 border-primary/30">
            <p className="text-sm italic text-foreground/75 leading-relaxed">"{location.mystery_teaser}"</p>
          </div>
          }

        {/* Quick Info */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          {location.typical_visit_duration &&
            <InfoPill icon={Clock} label={location.typical_visit_duration} />
            }
          {location.nearest_metro &&
            <InfoPill icon={Train} label={location.nearest_metro} />
            }
          {location.is_free &&
            <InfoPill icon={Bookmark} label="Free entry" />
            }
          {location.opening_hours &&
            <InfoPill icon={Clock} label={location.opening_hours} />
            }
        </div>
        <div className="mx-0 my-5 h-px bg-border/50" />
        {/* Audio Story Buttons */}
        {(location.has_story || location.quick_audio_url || location.deep_audio_url || location.quick_story || location.deep_story) &&
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Headphones className="w-4 h-4 text-primary" /> Listen
            </h3>

            {/* Language selector — only show langs that have translations ready */}
            <LanguageSelector
              selected={selectedLang}
              onChange={handleLanguageChange}
              loading={false} />
          

            <div className="flex gap-3">
              {(location.quick_audio_url || location.quick_story) &&
              <Button
                className="flex-1 rounded-xl h-12 bg-primary hover:bg-primary/90"
                onClick={() => {setPlayingType("quick");trackEvent("story_opened", { locationId, storyType: "quick" });}}
                disabled={false}>
              
                  <Headphones className="w-4 h-4 mr-2" />
                  Quick Story
                  <span className="ml-1 text-[10px] opacity-70">~90s</span>
                </Button>
              }
              {(location.deep_audio_url || location.deep_story) &&
              <Button
                className="flex-1 rounded-xl h-12"
                variant="outline"
                onClick={() => {setPlayingType("deep");trackEvent("story_opened", { locationId, storyType: "full" });}}
                disabled={false}>
              
                  <BookOpen className="w-4 h-4 mr-2" />
                  Deep History
                  <span className="ml-1 text-[10px] opacity-70">~3min</span>
                </Button>
              }
            </div>

            {playingType &&
            <AudioPlayer
              location={{
                ...location,
                quick_story: displayQuickStory,
                deep_story: displayDeepStory,
                _selectedLang: selectedLang
              }}
              storyType={playingType}
              onClose={() => setPlayingType(null)}
              enablePaidAudio={enablePaidAudio}
              previewPct={previewPct}
              enableReporting={enableReporting} />


            }

            {/* Video Tutorial */}
            {enableVideo && location.video_url && canWatchVideo &&
            <div className="mt-3">
                {!showVideo ?
              <button
                onClick={() => setShowVideo(true)}
                className="flex items-center gap-2 text-xs text-primary font-medium hover:underline">
              
                    🎬 Watch Video Tutorial
                  </button> :

              <div className="rounded-xl overflow-hidden border border-border mt-2">
                    <video
                  src={location.video_url}
                  controls
                  className="w-full"
                  preload="metadata" />
              
                  </div>
              }
              </div>
            }
          </div>
          }
        <div className="mx-0 my-5 h-px bg-border/50" />
        {/* Description — fallback to quick_story if description is empty */}
        {(location.description || location.quick_story) &&
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-2">About</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {location.description || location.quick_story}
            </p>
          </div>
          }

        {/* Story detail sections — no cards */}
        {(location.fun_fact || location.look_closely_tip || location.best_photo_spot) &&
          <div className="mt-6 space-y-5">
            {location.fun_fact &&
            <div>
                <p className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">💡 Fun Fact</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{location.fun_fact}</p>
              </div>
            }
            {location.fun_fact && location.look_closely_tip && <div className="h-px bg-border/50" />}
            {location.look_closely_tip &&
            <div>
                <p className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> Look Closely</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{location.look_closely_tip}</p>
              </div>
            }
            {location.look_closely_tip && location.best_photo_spot && <div className="h-px bg-border/50" />}
            {location.best_photo_spot &&
            <div>
                <p className="text-xs font-semibold text-foreground mb-1.5">📸 Best Photo Spot</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{location.best_photo_spot}</p>
              </div>
            }
          </div>
          }
        <div className="mx-0 my-3 h-px bg-border/50" />
        {/* Take me there */}
{location.latitude && location.longitude &&
          <div className="mt-5">
    

            
    <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center justify-center h-11 px-4 bg-primary/10 text-primary font-medium text-sm rounded-full active:scale-[0.98] transition-all gap-2 hover:bg-primary/15">
              
            <MapPin className="w-4 h-4" />
            Take me there
         </a>
  </div>
          }

        {/* Safety + Etiquette */}
        <div className="mt-6 space-y-2">
          {location.safety_note &&
            <div className="flex items-start gap-2 text-sm">
              <Shield className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-muted-foreground">{location.safety_note}</p>
            </div>
            }
          {location.local_etiquette &&
            <div className="flex items-start gap-2 text-sm">
              <span className="text-sm flex-shrink-0">🤝</span>
              <p className="text-muted-foreground">{location.local_etiquette}</p>
            </div>
            }
          {location.accessibility_note &&
            <div className="flex items-start gap-2 text-sm">
              <span className="text-sm flex-shrink-0">♿</span>
              <p className="text-muted-foreground">{location.accessibility_note}</p>
            </div>
            }
        </div>

        {/* Food Spots */}
        {location.food_spots?.length > 0 &&
          <FoodSpots spots={location.food_spots} />
          }

        {/* Social Share */}
        {showShare &&
          <SocialShare url={window.location.href} title={location.name} onClose={() => setShowShare(false)} />
          }

        {/* Affiliate Booking */}
        <AffiliateButtons
            city={location.city}
            country={location.country}
            hotel_booking_link={location.hotel_booking_link}
            flight_booking_link={location.flight_booking_link}
            attraction_booking_link={location.attraction_booking_link} />
        

        {/* Tour This Place */}
        <TourThisPlace locationId={locationId} />

        {/* Ratings */}
        <RatingSection locationId={locationId} />

        {/* Report issue */}
        {enableReporting &&
          <div className="mt-6 pt-4 border-t border-border">
            <IssueReportButton locationId={locationId} locationName={location.name} section="Location" />
          </div>
          }

        {/* Legal */}
        <p className="text-[10px] text-muted-foreground text-center mt-4 mb-6">
          Attraction access not guaranteed. Audio purchases are non-refundable.
        </p>
      </div>

      <GuestSignupModal open={showGuestModal} onClose={() => setShowGuestModal(false)} />
    </div>


    </>);

}

function InfoPill({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 border border-border/40 rounded-full px-3 py-1.5">
      <Icon className="w-3.5 h-3.5" />
      <span className="truncate">{label}</span>
    </div>);

}