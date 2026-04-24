import React from "react";

const LEVELS = [
  { name: "Explorer", min: 0, max: 9, color: "text-slate-600", bg: "bg-slate-100", emoji: "🧭" },
  { name: "Pioneer", min: 10, max: 29, color: "text-blue-700", bg: "bg-blue-100", emoji: "🗺️" },
  { name: "Trailblazer", min: 30, max: 74, color: "text-amber-700", bg: "bg-amber-100", emoji: "⚡" },
  { name: "Legend", min: 75, max: Infinity, color: "text-purple-700", bg: "bg-purple-100", emoji: "🏆" },
];

export function getExplorerLevel(listens = 0, tier = null) {
  if (tier) {
    const byTier = LEVELS.find(l => l.name.toLowerCase() === tier.toLowerCase());
    if (byTier) return byTier;
  }

  return LEVELS.find(l => listens >= l.min && listens <= l.max) || LEVELS[0];
}

export default function ExplorerLevel({ listens = 0, tier = null }) {
  const level = getExplorerLevel(listens, tier);
  const nextLevel = LEVELS[LEVELS.indexOf(level) + 1];
  const progress = nextLevel ? Math.round(((listens - level.min) / (nextLevel.min - level.min)) * 100) : 100;

  return (
    <div className={`${level.bg} rounded-xl p-3 flex items-center gap-3`}>
      <span className="text-2xl">{level.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className={`text-sm font-bold ${level.color}`}>Tuka {level.name}</p>
          <p className="text-[10px] text-muted-foreground">{listens} listens</p>
        </div>
        {nextLevel && (
          <div className="mt-1">
            <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
              <div className="h-full bg-current rounded-full transition-all duration-500" style={{ width: `${progress}%`, color: level.color }} />
            </div>
            <p className="text-[9px] text-muted-foreground mt-0.5">{nextLevel.min - listens} more to {nextLevel.name}</p>
          </div>
        )}
      </div>
    </div>
  );
}