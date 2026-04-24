import React from "react";

export default function MaintenanceScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background px-6">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
          <span className="text-2xl font-black text-white">T</span>
        </div>
        <h1 className="text-xl font-bold mb-2">Under Maintenance</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          TukaPath is temporarily under maintenance. Please try again later.
        </p>
      </div>
    </div>
  );
}