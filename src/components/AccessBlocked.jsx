import React from "react";

export default function AccessBlocked() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background px-6">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10 mb-4">
          <span className="text-2xl">🚫</span>
        </div>
        <h1 className="text-xl font-bold mb-2">Access Restricted</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Access to TukaPath is currently not available from your location.
        </p>
      </div>
    </div>
  );
}