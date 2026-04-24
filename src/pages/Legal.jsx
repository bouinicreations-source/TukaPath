import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const TABS = [
  { key: "privacy", label: "Privacy Policy" },
  { key: "terms", label: "Terms of Use" },
];

export default function Legal() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const [tab, setTab] = useState(urlParams.get("tab") || "privacy");

  return (
    <div className="max-w-lg mx-auto px-5 py-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-bold">Legal</h1>
      </div>

      {/* Tab toggle */}
      <div className="flex bg-muted rounded-xl p-1 mb-6">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "privacy" && (
        <div className="prose prose-sm max-w-none space-y-4 text-sm text-foreground leading-relaxed">
          <p className="text-xs text-muted-foreground">Last updated: March 2025</p>

          <h2 className="text-base font-semibold mt-4">1. Information We Collect</h2>
          <p>When you use TukaPath, we may collect the following information:</p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Account information: name, email address</li>
            <li>Profile data: passport country, country of residence, birthdate, gender (all optional)</li>
            <li>Precise location data (only when permission is granted)</li>
            <li>Usage data: locations viewed, stories listened to, favorites saved</li>
            <li>User-submitted content: place discoveries, corrections, ratings</li>
          </ul>

          <h2 className="text-base font-semibold mt-4">2. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>To show you nearby stories and personalize your experience</li>
            <li>To display relevant visa and travel information</li>
            <li>To manage your account, credits, and preferences</li>
            <li>To review and moderate user-submitted content</li>
            <li>To improve the app and fix issues</li>
          </ul>

          <h2 className="text-base font-semibold mt-4">3. Location Data</h2>
          <p className="text-muted-foreground">We request your device location to show nearby stories and places. Location is never stored on our servers and is only used in real time during your session. You may deny location access and the app will still function with default content.</p>

          <h2 className="text-base font-semibold mt-4">4. Data Sharing</h2>
          <p className="text-muted-foreground">We do not sell your personal data. We may share anonymized usage data with analytics providers to improve the product. User-submitted content (discoveries, corrections) may be reviewed by our team.</p>

          <h2 className="text-base font-semibold mt-4">5. Data Retention & Deletion</h2>
          <p className="text-muted-foreground">You may delete your account at any time from your Profile settings. Upon deletion, your personal data will be removed from our systems within 30 days. Anonymized usage statistics may be retained.</p>

          <h2 className="text-base font-semibold mt-4">6. Your Rights</h2>
          <p className="text-muted-foreground">You have the right to access, correct, or delete your personal data. To make a request, contact us at <strong>support@tukapath.com</strong>.</p>

          <h2 className="text-base font-semibold mt-4">7. Children</h2>
          <p className="text-muted-foreground">TukaPath is not intended for users under 13 years of age. We do not knowingly collect data from children.</p>

          <h2 className="text-base font-semibold mt-4">8. Contact</h2>
          <p className="text-muted-foreground">Questions? Email us at <strong>support@tukapath.com</strong></p>
        </div>
      )}

      {tab === "terms" && (
        <div className="prose prose-sm max-w-none space-y-4 text-sm text-foreground leading-relaxed">
          <p className="text-xs text-muted-foreground">Last updated: March 2025</p>

          <h2 className="text-base font-semibold mt-4">1. Acceptance</h2>
          <p className="text-muted-foreground">By creating an account and using TukaPath, you agree to these Terms of Use. If you do not agree, please do not use the app.</p>

          <h2 className="text-base font-semibold mt-4">2. Use of the App</h2>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>TukaPath is for personal, non-commercial use only.</li>
            <li>You may not reproduce, distribute, or resell any content from the app.</li>
            <li>You must be at least 13 years old to create an account.</li>
          </ul>

          <h2 className="text-base font-semibold mt-4">3. Audio Content</h2>
          <p className="text-muted-foreground">Audio stories are for entertainment and educational purposes. Historical details may be simplified or interpreted. TukaPath does not guarantee the historical accuracy of stories.</p>

          <h2 className="text-base font-semibold mt-4">4. Travel & Visa Information</h2>
          <p className="text-muted-foreground">Visa and travel information provided in TukaPath is indicative only and may be outdated. You must always verify entry requirements with official government sources or embassies before traveling. TukaPath is not liable for any travel disruptions arising from use of this information.</p>

          <h2 className="text-base font-semibold mt-4">5. User Contributions</h2>
          <p className="text-muted-foreground">When you submit a discovery, correction, or rating, you grant TukaPath a non-exclusive, royalty-free license to use, display, and moderate that content. All submissions are subject to review and may be rejected or removed.</p>

          <h2 className="text-base font-semibold mt-4">6. Credits</h2>
          <p className="text-muted-foreground">TukaPath credits are non-transferable and have no monetary value. Audio purchases using credits are non-refundable. Credits may expire or be modified at our discretion.</p>

          <h2 className="text-base font-semibold mt-4">7. Disclaimer</h2>
          <p className="text-muted-foreground">TukaPath is provided "as is." We do not guarantee uninterrupted access, accuracy of content, or suitability for any purpose. We are not liable for any indirect, incidental, or consequential damages.</p>

          <h2 className="text-base font-semibold mt-4">8. Changes</h2>
          <p className="text-muted-foreground">We may update these Terms at any time. Continued use of the app after changes constitutes acceptance.</p>

          <h2 className="text-base font-semibold mt-4">9. Contact</h2>
          <p className="text-muted-foreground">For questions, contact us at <strong>support@tukapath.com</strong></p>
        </div>
      )}
    </div>
  );
}