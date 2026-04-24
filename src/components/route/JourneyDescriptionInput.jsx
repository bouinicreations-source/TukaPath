import React, { useState, useRef } from "react";
import { Mic, MicOff, Sparkles, Loader2 } from "lucide-react";
import { base44 } from "@/api/client";
import { motion, AnimatePresence } from "framer-motion";

export default function JourneyDescriptionInput({ onParsed }) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const recognitionRef = useRef(null);

  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setFeedback("Voice input not supported on this browser.");
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setText(transcript);
      setListening(false);
      parseIntent(transcript);
    };
    rec.onerror = () => { setListening(false); setFeedback("Voice not captured. Try again."); };
    rec.onend = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
    setFeedback(null);
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const parseIntent = async (input) => {
    const raw = input || text;
    if (!raw.trim()) return;
    setParsing(true);
    setFeedback(null);
    try {
      const res = await base44.functions.invoke("parseJourneyIntent", { text: raw });
      const parsed = res.data;
      onParsed(parsed);
      setFeedback("✨ Preferences filled from your description");
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      setFeedback("Could not parse — adjust manually below.");
    }
    setParsing(false);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-foreground block">Describe your journey</label>
      <div className="relative">
        <textarea
          className="w-full px-4 py-3 pr-12 rounded-xl border border-input bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none h-[72px]"
          placeholder='"2 hour scenic drive with coffee and a sunset stop"'
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); parseIntent(); } }}
        />
        <button
          onClick={listening ? stopVoice : startVoice}
          className={`absolute right-3 top-3 p-1.5 rounded-full transition-colors ${listening ? "bg-destructive text-white animate-pulse" : "bg-muted text-muted-foreground hover:text-foreground"}`}
          title={listening ? "Stop listening" : "Speak your journey"}
        >
          {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => parseIntent()}
          disabled={parsing || !text.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-40"
        >
          {parsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {parsing ? "Reading your intent..." : "Fill preferences from this"}
        </button>
        <p className="text-[10px] text-muted-foreground">or press Enter</p>
      </div>

      <AnimatePresence>
        {feedback && (
          <motion.p
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-xs text-primary font-medium"
          >
            {feedback}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}