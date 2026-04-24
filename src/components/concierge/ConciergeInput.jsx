import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { base44 } from "@/api/client";
import { normalizeVoiceInput } from "@/lib/parseJourneyInput";

const EXAMPLE_PROMPTS = [
  "Scenic drive from London to Edinburgh, 2 days",
  "Day trip from Doha to somewhere coastal",
  "Weekend road trip through the Italian countryside",
  "A relaxed overnight drive avoiding highways",
];

export default function ConciergeInput({ onSubmit, loading }) {
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const handleSubmit = () => {
    if (!text.trim() || loading) return;
    onSubmit(text.trim());
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setTranscribing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const file = new File([blob], "recording.webm", { type: "audio/webm" });
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          const res = await base44.functions.invoke("transcribeAudio", { file_url });
          if (res?.data?.text) {
            const normalized = normalizeVoiceInput(res.data.text);
            setText(prev => prev ? prev + " " + normalized : normalized);
          }
        } catch {
          // silent fail
        }
        setTranscribing(false);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
    } catch {
      // mic not available
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  return (
    <div className="space-y-5">
      {/* Main textarea */}
      <div className="relative">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(); }}
          placeholder="Tell me about your journey — where, how long, what vibe…"
          className="w-full px-5 py-4 pr-14 rounded-2xl bg-muted/50 border border-border/60 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:bg-card transition-all resize-none leading-relaxed shadow-inner"
          style={{ minHeight: "110px" }}
          autoFocus
        />
        {/* Voice button */}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={transcribing}
          className={`absolute bottom-4 right-4 p-2 rounded-xl transition-all ${
            isRecording
              ? "bg-destructive text-white animate-pulse"
              : transcribing
              ? "bg-muted text-muted-foreground"
              : "text-muted-foreground/50 hover:text-primary hover:bg-primary/10"
          }`}
        >
          {transcribing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isRecording ? (
            <MicOff className="w-4 h-4" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Submit */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSubmit}
        disabled={!text.trim() || loading}
        className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold text-[15px] flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 transition-opacity"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Understanding your trip…
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Plan my journey
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </motion.button>

      {/* Example prompts */}
      <div>
        <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-2.5">Try something like</p>
        <div className="space-y-1.5">
          {EXAMPLE_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => setText(prompt)}
              className="w-full text-left px-3.5 py-2.5 rounded-xl bg-muted/40 hover:bg-muted/70 text-xs text-muted-foreground hover:text-foreground transition-colors leading-relaxed"
            >
              "{prompt}"
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}