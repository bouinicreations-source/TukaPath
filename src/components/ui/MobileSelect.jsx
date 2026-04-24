import React, { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * MobileSelect — native-feel bottom sheet replacement for <select>.
 * Props mirror a standard select:
 *   value, onChange, options: [{value, label}] | string[], placeholder, className, label, disabled
 */
export default function MobileSelect({ value, onChange, options = [], placeholder = "Select...", className = "", label, disabled = false }) {
  const [open, setOpen] = useState(false);

  const normalised = options.map(o =>
    typeof o === "string" ? { value: o, label: o } : o
  );

  const selected = normalised.find(o => o.value === value);

  const handleSelect = (val) => {
    onChange?.({ target: { value: val } });
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !selected && "text-muted-foreground",
          className
        )}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="pb-safe">
          {label && (
            <DrawerHeader className="pb-2">
              <DrawerTitle className="text-base">{label}</DrawerTitle>
            </DrawerHeader>
          )}
          <div className="px-4 pb-6 space-y-1 max-h-[60vh] overflow-y-auto">
            {normalised.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={cn(
                  "w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-colors text-left",
                  opt.value === value
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted text-foreground"
                )}
              >
                {opt.label}
                {opt.value === value && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}