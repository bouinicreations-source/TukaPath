import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Headphones, RefreshCw, AlertCircle, CheckCircle2, Radio } from "lucide-react";

// Module-level state so batch survives tab switches (component unmount/remount)
let _batchProgress = null;
let _batchListeners = new Set();
function notifyListeners() { _batchListeners.forEach(fn => fn(_batchProgress)); }
function setBatchProgressGlobal(val) { _batchProgress = val; notifyListeners(); }

export function getAudioStatus(loc, type) {
  const url = type === "quick" ? loc.quick_audio_url : loc.deep_audio_url;
  const outdated = type === "quick" ? loc.quick_audio_outdated : loc.deep_audio_outdated;
  if (!url) return "Missing";
  if (outdated) return "Outdated";
  return "Ready";
}

export function AudioStatusBadge({ status }) {
  if (status === "Ready") return <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]"><CheckCircle2 className="w-2.5 h-2.5 mr-1" />Ready</Badge>;
  if (status === "Outdated") return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]"><RefreshCw className="w-2.5 h-2.5 mr-1" />Outdated</Badge>;
  return <Badge variant="outline" className="text-[10px] text-muted-foreground"><AlertCircle className="w-2.5 h-2.5 mr-1" />Missing</Badge>;
}

export default function LocationAudioManager({ locations, onRefresh }) {
  const [batchProgress, setBatchProgress] = useState(_batchProgress);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  // Sync global batch state to local state when tab is revisited
  useEffect(() => {
    const listener = (val) => setBatchProgress(val);
    _batchListeners.add(listener);
    setBatchProgress(_batchProgress); // sync on mount
    return () => _batchListeners.delete(listener);
  }, []);

  const isRunning = batchProgress && !batchProgress.finished;

  // Warn on browser/tab close while updating
  useEffect(() => {
    if (!isRunning) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isRunning]);

  const counts = { quick: { ready: 0, outdated: 0, missing: 0 }, deep: { ready: 0, outdated: 0, missing: 0 } };
  locations.forEach(loc => {
    ["quick", "deep"].forEach(type => {
      const s = getAudioStatus(loc, type);
      if (s === "Ready") counts[type].ready++;
      else if (s === "Outdated") counts[type].outdated++;
      else counts[type].missing++;
    });
  });

  const totalOutdated = counts.quick.outdated + counts.deep.outdated;

  const handleUpdateAll = () => {
    const readyCount = counts.quick.ready + counts.deep.ready;
    if (readyCount > 0) {
      setConfirmDialog({ readyCount });
    } else {
      runBatch("all");
    }
  };

  const runBatch = async (mode) => {
    setConfirmDialog(null);
    const tasks = [];
    locations.forEach(loc => {
      ["quick", "deep"].forEach(type => {
        const status = getAudioStatus(loc, type);
        const voiceText = type === "quick" ? loc.quick_story_voice : loc.deep_story_voice;
        if (!voiceText?.trim()) return;
        if (mode === "outdated" && status !== "Outdated") return;
        if (mode === "missing_outdated" && status === "Ready") return;
        // mode === "all" regenerates everything
        tasks.push({ loc, type });
      });
    });

    if (tasks.length === 0) {
      setBatchProgressGlobal({ done: 0, total: 0, succeeded: 0, failed: 0, failedItems: [], finished: true });
      return;
    }

    setBatchProgressGlobal({ done: 0, total: tasks.length, succeeded: 0, failed: 0, failedItems: [], finished: false });
    const errors = [];
    let succeeded = 0;

    for (let i = 0; i < tasks.length; i++) {
      const { loc, type } = tasks[i];
      try {
        await base44.functions.invoke("generateLocationAudio", { locationId: loc.id, storyType: type });
        succeeded++;
      } catch (err) {
        const msg = `${loc.name} (${type}): ${err?.response?.data?.error || err.message}`;
        errors.push(msg);
      }
      const finished = i === tasks.length - 1;
      setBatchProgressGlobal({ done: i + 1, total: tasks.length, succeeded, failed: errors.length, failedItems: [...errors], finished });
      if (finished) onRefreshRef.current?.();
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Radio className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold">Audio Status Summary</p>
        {isRunning && (
          <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
            <div className="w-3 h-3 border-2 border-muted border-t-primary rounded-full animate-spin" />
            Running in background…
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Short Story Audio</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-green-50 border border-green-100 rounded-xl p-2.5 text-center">
              <p className="text-xl font-bold text-green-700">{counts.quick.ready}</p>
              <p className="text-[10px] text-green-600 mt-0.5">Ready</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-2.5 text-center">
              <p className="text-xl font-bold text-amber-700">{counts.quick.outdated}</p>
              <p className="text-[10px] text-amber-600 mt-0.5">Outdated</p>
            </div>
            <div className="bg-muted border border-border rounded-xl p-2.5 text-center">
              <p className="text-xl font-bold text-muted-foreground">{counts.quick.missing}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Missing</p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Long Story Audio</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-green-50 border border-green-100 rounded-xl p-2.5 text-center">
              <p className="text-xl font-bold text-green-700">{counts.deep.ready}</p>
              <p className="text-[10px] text-green-600 mt-0.5">Ready</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-2.5 text-center">
              <p className="text-xl font-bold text-amber-700">{counts.deep.outdated}</p>
              <p className="text-[10px] text-amber-600 mt-0.5">Outdated</p>
            </div>
            <div className="bg-muted border border-border rounded-xl p-2.5 text-center">
              <p className="text-xl font-bold text-muted-foreground">{counts.deep.missing}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Missing</p>
            </div>
          </div>
        </div>
      </div>

      {batchProgress && (
        <div className={`rounded-lg p-3 border ${
          batchProgress.finished
            ? batchProgress.failed > 0 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"
            : "bg-muted/50 border-border"
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {batchProgress.finished ? (
              batchProgress.failed > 0
                ? <span className="text-amber-600 text-xs font-semibold">⚠ Batch complete with errors</span>
                : <span className="text-green-700 text-xs font-semibold">✓ Batch complete</span>
            ) : (
              <>
                <div className="w-3 h-3 border-2 border-muted border-t-primary rounded-full animate-spin" />
                <span className="text-xs text-muted-foreground">Generating audio {batchProgress.done} / {batchProgress.total}...</span>
              </>
            )}
          </div>

          {!batchProgress.finished && batchProgress.total > 0 && (
            <div className="w-full bg-muted rounded-full h-1.5 mb-2">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.round((batchProgress.done / batchProgress.total) * 100)}%` }}
              />
            </div>
          )}

          {batchProgress.finished && (
            <div className="grid grid-cols-3 gap-2 text-center mt-1">
              <div>
                <p className="text-sm font-bold">{batchProgress.total}</p>
                <p className="text-[10px] text-muted-foreground">Total</p>
              </div>
              <div>
                <p className="text-sm font-bold text-green-700">{batchProgress.succeeded}</p>
                <p className="text-[10px] text-green-600">Generated</p>
              </div>
              <div>
                <p className={`text-sm font-bold ${batchProgress.failed > 0 ? "text-red-600" : "text-muted-foreground"}`}>{batchProgress.failed}</p>
                <p className={`text-[10px] ${batchProgress.failed > 0 ? "text-red-500" : "text-muted-foreground"}`}>Failed</p>
              </div>
            </div>
          )}

          {batchProgress.failedItems?.length > 0 && (
            <div className="mt-2 space-y-1 max-h-28 overflow-y-auto">
              {batchProgress.failedItems.map((e, i) => (
                <p key={i} className="text-[10px] text-destructive">⚠ {e}</p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-xs"
          disabled={totalOutdated === 0 || isRunning}
          onClick={() => runBatch("outdated")}
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" />
          Update Outdated Only ({totalOutdated})
        </Button>
        <Button
          size="sm"
          className="flex-1 text-xs bg-primary hover:bg-primary/90"
          disabled={isRunning}
          onClick={handleUpdateAll}
        >
          <Headphones className="w-3.5 h-3.5 mr-1" />
          Update All
        </Button>
      </div>

      {/* Confirmation dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-card rounded-xl shadow-xl p-6 max-w-sm w-full space-y-4 border border-border">
            <p className="text-sm font-semibold">Some audio is already ready</p>
            <p className="text-sm text-muted-foreground">
              {confirmDialog.readyCount} location(s) already have audio ready. Do you want to regenerate everything or only fill in the missing/outdated ones?
            </p>
            <div className="flex flex-col gap-2">
              <Button size="sm" className="w-full text-xs" onClick={() => runBatch("all")}>
                Yes, Update All
              </Button>
              <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => runBatch("missing_outdated")}>
                Only Update Missing / Outdated
              </Button>
              <Button size="sm" variant="ghost" className="w-full text-xs text-muted-foreground" onClick={() => setConfirmDialog(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}