import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X, Headphones } from "lucide-react";
import { base44 } from "@/api/client";

export default function GuestSignupModal({ open, onClose }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[2000]"
            onClick={onClose}
          />
          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-[2001] bg-card rounded-t-3xl shadow-2xl px-6 pt-6 pb-10"
          >
            <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>

            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Headphones className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-xl font-bold">Unlock the full story</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                Create a free account to continue exploring — full audio stories, favorites, and more.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                className="w-full h-11 bg-primary hover:bg-primary/90 font-semibold rounded-xl"
                onClick={() => window.location.href = "/login"}
              >
                Create Free Account
              </Button>
              <Button
                variant="outline"
                className="w-full h-11 rounded-xl"
                onClick={() => window.location.href = "/login"}
              >
                Log In
              </Button>
              <button onClick={onClose} className="w-full text-xs text-muted-foreground py-2 hover:text-foreground">
                Continue browsing
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}