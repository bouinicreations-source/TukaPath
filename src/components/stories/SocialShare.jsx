import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Share2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const PLATFORMS = [
  { label: "WhatsApp", color: "#25D366", icon: "💬", urlFn: (url, text) => `https://wa.me/?text=${encodeURIComponent(text + " " + url)}` },
  { label: "Telegram", color: "#2CA5E0", icon: "✈️", urlFn: (url, text) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
  { label: "X", color: "#000", icon: "𝕏", urlFn: (url, text) => `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
  { label: "Facebook", color: "#1877F2", icon: "📘", urlFn: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  { label: "Email", color: "#EA4335", icon: "📧", urlFn: (url, text) => `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}` },
];

export default function SocialShare({ url, title, onClose }) {
  const shareUrl = url || window.location.href;
  const shareText = title ? `Discover: ${title} via TukaPath` : "Check this out on TukaPath";

  const handleNativeShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: shareText, url: shareUrl });
    }
  };

  return (
    <Card className="p-4 mt-2 border-border shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold flex items-center gap-1.5"><Share2 className="w-4 h-4" /> Share</p>
        <Button variant="ghost" size="icon" className="w-6 h-6" onClick={onClose}><X className="w-3.5 h-3.5" /></Button>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {PLATFORMS.map(p => (
          <a
            key={p.label}
            href={p.urlFn(shareUrl, shareText)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-muted transition-colors"
          >
            <span className="text-xl">{p.icon}</span>
            <span className="text-[9px] text-muted-foreground font-medium">{p.label}</span>
          </a>
        ))}
      </div>
      {navigator.share && (
        <Button variant="outline" size="sm" onClick={handleNativeShare} className="w-full mt-3 text-xs">
          Use Device Share
        </Button>
      )}
    </Card>
  );
}