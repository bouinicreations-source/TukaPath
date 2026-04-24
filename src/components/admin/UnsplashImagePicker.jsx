import React, { useState, useRef } from "react";
import { base44 } from "@/api/client";
import useScrollLock from "@/hooks/useScrollLock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Search, ArrowLeft, ExternalLink } from "lucide-react";

export default function UnsplashImagePicker({ locationName, city, country, onSelect, onClose }) {
  useScrollLock();
  const defaultQuery = [locationName, city, country].filter(Boolean).join(" ");
  const [query, setQuery] = useState(defaultQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [preview, setPreview] = useState(null); // selected photo for confirmation
  const [confirming, setConfirming] = useState(false);

  const doSearch = async (q) => {
    if (!q.trim()) return;
    setLoading(true);
    setNotFound(false);
    setResults([]);
    const res = await base44.functions.invoke("unsplashSearch", { action: "search", query: q.trim() });
    const list = res.data?.results || [];
    setResults(list);
    setNotFound(list.length === 0);
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") doSearch(query);
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setConfirming(true);
    // Trigger Unsplash download endpoint (required by their guidelines)
    await base44.functions.invoke("unsplashSearch", { action: "trigger_download", photo_id: preview.id });
    onSelect({
      image_url: preview.regular,
      image_source: "unsplash",
      image_photographer_name: preview.photographer_name,
      image_photographer_url: preview.photographer_url,
      unsplash_photo_id: preview.id,
    });
    setConfirming(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-none" onClick={onClose}>
      <div
        className="bg-background w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl flex flex-col" style={{height: 'calc(100vh - env(safe-area-inset-bottom, 0px) - 8px)', maxHeight: '92dvh'}}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          {preview ? (
            <button onClick={() => setPreview(null)} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" /> Back to results
            </button>
          ) : (
            <p className="text-sm font-semibold">Search image on Unsplash</p>
          )}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search bar (hidden during preview) */}
        {!preview && (
          <div className="px-5 py-3 border-b border-border flex-shrink-0 flex gap-2">
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Eiffel Tower Paris France"
              className="h-9 text-sm flex-1"
            />
            <Button size="sm" className="h-9 px-3 gap-1.5" onClick={() => doSearch(query)} disabled={loading}>
              <Search className="w-4 h-4" />
              {loading ? "..." : "Search"}
            </Button>
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Preview panel — image + metadata only, action in sticky footer */}
          {preview && (
            <div className="p-5 space-y-4">
              <img src={preview.regular} alt={preview.alt} className="w-full max-h-72 object-cover rounded-xl" />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Photographer</p>
                <a
                  href={preview.photographer_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary flex items-center gap-1 hover:underline"
                >
                  {preview.photographer_name} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-xs text-muted-foreground">
                Photo by{" "}
                <a href={preview.photographer_url} target="_blank" rel="noopener noreferrer" className="underline text-foreground">
                  {preview.photographer_name}
                </a>{" "}
                on{" "}
                <a href="https://unsplash.com?utm_source=tukapath&utm_medium=referral" target="_blank" rel="noopener noreferrer" className="underline text-foreground">
                  Unsplash
                </a>
              </p>
            </div>
          )}

          {/* Grid panel */}
          {!preview && !loading && results.length > 0 && (
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 pb-4">
              {results.map(photo => (
                <button
                  key={photo.id}
                  onClick={() => setPreview(photo)}
                  className="relative group rounded-lg overflow-hidden aspect-square bg-muted text-left"
                >
                  <img src={photo.thumb} alt={photo.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-0 left-0 right-0 p-2 translate-y-1 group-hover:translate-y-0 transition-transform">
                    <p className="text-white text-[10px] font-medium leading-tight truncate">{photo.photographer_name}</p>
                    <p className="text-white/70 text-[9px]">Unsplash</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Not found */}
          {!preview && !loading && notFound && (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No results found — try different keywords</p>
            </div>
          )}

          {/* Initial empty state */}
          {!preview && !loading && results.length === 0 && !notFound && (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">Enter a search term and press Search</p>
              <Button size="sm" className="mt-4" onClick={() => doSearch(query)} disabled={!query.trim()}>
                <Search className="w-4 h-4 mr-1.5" /> Search "{defaultQuery}"
              </Button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="p-10 flex justify-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Sticky footer — only shown in preview mode */}
        {preview && (
          <div className="flex-shrink-0 px-5 py-4 border-t border-border bg-background flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setPreview(null)} disabled={confirming}>
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to results
            </Button>
            <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleConfirm} disabled={confirming}>
              {confirming ? "Saving…" : "Use this image"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}