import React, { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, X, FileText, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { trackEvent } from "../../hooks/useTrackEvent";
import IssueReportButton from "@/components/IssueReportButton";
import GuestUpgradeOverlay from "@/components/GuestUpgradeOverlay";
import { useAuth } from "@/components/AuthContext";
import { base44 } from "@/api/client";

export default function AudioPlayer({ location, storyType, onClose, enablePaidAudio = false, previewPct = 70, enableReporting = true }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showTranscript, setShowTranscript] = useState(false);
  const [progress, setProgress] = useState(0);
  const [gated, setGated] = useState(false);
  const { isGuest } = useAuth();
  const effectivePreviewPct = isGuest ? Math.min(previewPct, 60) : previewPct;
  const effectivePaidAudio = isGuest ? true : enablePaidAudio;

  const [resolvedAudioUrl, setResolvedAudioUrl] = React.useState(null);
  const [preparingAudio, setPreparingAudio] = React.useState(false);

  const selectedLang = location._selectedLang || 'en';
  const isTranslatedLang = selectedLang !== 'en';
  const baseAudioUrl = storyType === "quick" ? location.quick_audio_url : location.deep_audio_url;
  // Only use English display story for transcript — never show translated text
  const storyText = storyType === "quick" ? location.quick_story : location.deep_story;
  const audioUrl = resolvedAudioUrl || (isTranslatedLang ? null : baseAudioUrl);
  const speeds = [0.5, 1, 1.5, 2];

  // Reset resolved audio when lang or story type changes
  React.useEffect(() => {
    setResolvedAudioUrl(null);
    setPreparingAudio(false);
  }, [selectedLang, storyType]);

  // Full flow: translate voice script → generate audio → return URL
  const ensureTranslationAudio = async () => {
    setPreparingAudio(true);
    try {
      // Step 1: get or create translation record (voice scripts only)
      const transRes = await base44.functions.invoke('generateTranslation', {
        locationId: location.id,
        languageCode: selectedLang,
      });
      const translationRecord = transRes.data?.translation;
      if (!translationRecord) throw new Error('No translation record returned');

      // Step 2: check if audio already exists for this story type
      const existingUrl = storyType === 'quick' ? translationRecord.quick_audio_url : translationRecord.deep_audio_url;
      if (existingUrl) {
        setResolvedAudioUrl(existingUrl);
        return existingUrl;
      }

      // Step 3: generate audio from translated voice script
      const audioRes = await base44.functions.invoke('generateTranslationAudio', {
        translationRecordId: translationRecord.id,
        storyType,
      });
      const url = audioRes.data?.audio_url;
      if (url) {
        setResolvedAudioUrl(url);
        return url;
      }
    } catch (e) {
      console.error('Translation audio error:', e);
    } finally {
      setPreparingAudio(false);
    }
    return null;
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => {
      if (!audio.duration) return;
      const pct = (audio.currentTime / audio.duration) * 100;
      setProgress(pct);
      if (effectivePaidAudio && pct >= effectivePreviewPct && !gated) {
        audio.pause();
        setIsPlaying(false);
        setGated(true);
      }
    };
    const onEnded = () => { setIsPlaying(false); setProgress(0); };
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audioUrl]);

  const hasTrackedPlay = React.useRef(false);

  const togglePlay = async () => {
    // If translated language and no audio URL yet, generate first
    if (isTranslatedLang && !audioUrl) {
      const url = await ensureTranslationAudio();
      if (!url) return;
      // audio element will re-render with new src
      setTimeout(() => { audioRef.current?.play(); setIsPlaying(true); }, 100);
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
      if (!hasTrackedPlay.current) {
        hasTrackedPlay.current = true;
        const evt = storyType === "quick" ? "quick_played" : "full_played";
        trackEvent(evt, { locationId: location?.id, storyType });
      }
    }
    setIsPlaying(!isPlaying);
  };

  const handleSpeedChange = (s) => {
    setSpeed(s);
    if (audioRef.current) audioRef.current.playbackRate = s;
  };

  const handleSeek = (val) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    audio.currentTime = (val[0] / 100) * audio.duration;
    setProgress(val[0]);
  };

  const dismissGate = () => setGated(false);

  // For translated languages, show preparing state; for English, hide if no audio
  if (!audioUrl && !isTranslatedLang && !preparingAudio) return null;

  return (
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="metadata" />}
      {gated && !isGuest && (
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-5 text-center space-y-3">
          <Lock className="w-8 h-8 text-primary mx-auto" />
          <p className="text-sm font-semibold">Listen to the full story</p>
          <p className="text-xs text-muted-foreground">You've heard the preview. Unlock to continue.</p>
          <div className="flex gap-2 justify-center">
            <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => { setGated(false); audioRef.current?.play(); setIsPlaying(true); }}>🔓 Unlock / Continue</Button>
            <Button size="sm" variant="outline" onClick={() => { setGated(false); onClose(); }}>Close</Button>
          </div>
        </div>
      )}
      <GuestUpgradeOverlay open={!!(gated && isGuest)} onClose={() => { setGated(false); onClose(); }} variant="audio" />
      <Card className="mt-4 p-4 bg-card border border-primary/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">
              {storyType === "quick" ? "Quick Story" : "Deep History"}
            </p>
            {enablePaidAudio && <span className="text-[9px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full font-medium">Preview</span>}
          </div>
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <Slider value={[progress]} max={100} step={0.1} className="mb-3" onValueChange={handleSeek} />

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {speeds.map((s) => (
              <button
                key={s}
                onClick={() => handleSpeedChange(s)}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                  speed === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          <Button size="icon" className="rounded-full w-12 h-12 bg-primary hover:bg-primary/90" onClick={togglePlay} disabled={preparingAudio}>
            {preparingAudio ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </Button>

          {storyText ? (
            <Button variant="ghost" size="sm" onClick={() => setShowTranscript(!showTranscript)}>
              <FileText className="w-4 h-4 mr-1" /> Transcript
            </Button>
          ) : (
            <div className="w-20" />
          )}
        </div>

        {enableReporting && (
          <div className="mt-3 pt-2 border-t border-border">
            <IssueReportButton locationId={location?.id} locationName={location?.name} section="Audio" />
          </div>
        )}

        {showTranscript && storyText && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="mt-4 p-3 bg-muted rounded-lg max-h-48 overflow-y-auto"
          >
            <p className="text-xs leading-relaxed text-muted-foreground">{storyText}</p>
          </motion.div>
        )}
      </Card>
    </motion.div>
  );
}