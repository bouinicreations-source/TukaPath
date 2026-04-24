import React from "react";
import { VISA_COLORS } from "./visaLogic";

/**
 * Compact badge for destination cards.
 */
export default function VisaResultBadge({ result }) {
  if (!result || result.status === "not_checked") {
    return <span className="text-[10px] text-muted-foreground italic">Visa not checked</span>;
  }
  if (result.status === "no_data") {
    return <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">No visa data</span>;
  }
  const color = VISA_COLORS[result.visa_type] || "bg-muted text-muted-foreground";
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${color}`}>
      {result.visa_type}
      {result.visa_cost_usd > 0 && ` · $${result.visa_cost_usd}`}
    </span>
  );
}