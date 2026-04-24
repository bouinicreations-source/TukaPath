import React, { useState } from "react";
import { supabase } from '@/api/supabase';
import { base44 } from "@/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ConsentReaccept({ user, settings, onComplete }) {
  const get = (key) => settings.find(s => s.key === key)?.value || "";

  const [accepted, setAccepted] = useState({ terms: false, privacy: false, disclaimer: false });
  const [saving, setSaving] = useState(false);

  const allAccepted = accepted.terms && accepted.privacy && accepted.disclaimer;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!allAccepted) { toast.error("Please accept all documents to continue."); return; }
    setSaving(true);
    await supabase.auth.updateUser({ data: {
      consent_terms_version: get("terms_version"),
      consent_privacy_version: get("privacy_version"),
      consent_disclaimer_version: get("disclaimer_version"),
    } });
    toast.success("Thank you for accepting the updated policies.");
    onComplete();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-3">
            <span className="text-xl font-black text-white">T</span>
          </div>
          <h1 className="text-xl font-bold">Updated Policies</h1>
          <p className="text-sm text-muted-foreground mt-1">Please review and accept the updated documents to continue.</p>
        </div>

        <Card className="p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {get("terms_text") && (
              <ConsentBlock
                title="Terms & Conditions"
                text={get("terms_text")}
                checked={accepted.terms}
                onChange={v => setAccepted(a => ({ ...a, terms: v }))}
                checkLabel="I have read and agree to the Terms & Conditions"
              />
            )}
            {get("privacy_text") && (
              <ConsentBlock
                title="Privacy Policy"
                text={get("privacy_text")}
                checked={accepted.privacy}
                onChange={v => setAccepted(a => ({ ...a, privacy: v }))}
                checkLabel="I have read and agree to the Privacy Policy"
              />
            )}
            {get("disclaimer_text") && (
              <ConsentBlock
                title="Disclaimer"
                text={get("disclaimer_text")}
                checked={accepted.disclaimer}
                onChange={v => setAccepted(a => ({ ...a, disclaimer: v }))}
                checkLabel="I have read and acknowledge the Disclaimer"
              />
            )}

            <Button type="submit" disabled={saving || !allAccepted} className="w-full h-11 bg-primary hover:bg-primary/90 font-semibold">
              {saving ? "Saving..." : "Accept & Continue"}
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}

function ConsentBlock({ title, text, checked, onChange, checkLabel }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold">{title}</p>
      <ScrollArea className="h-28 rounded-md border border-border bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground whitespace-pre-wrap">{text}</p>
      </ScrollArea>
      <div className="flex items-center gap-2">
        <Checkbox id={title} checked={checked} onCheckedChange={onChange} />
        <Label htmlFor={title} className="text-xs cursor-pointer">{checkLabel}</Label>
      </div>
    </div>
  );
}