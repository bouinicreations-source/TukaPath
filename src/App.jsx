import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/components/AuthContext';
import ProfileCompletion from '@/components/ProfileCompletion';
import ConsentReAccept from '@/components/ConsentReaccept.jsx';
import MaintenanceScreen from '@/components/MaintenanceScreen';
import AccessBlocked from '@/components/AccessBlocked';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/client';
import React, { useEffect } from 'react';
import LoginScreen from '@/components/LoginScreen';

// LoginScreen for Profile route (guest)
function GuestProfileScreen() {
  return <LoginScreen />;
}
import Home from '@/pages/Home';
import NearbyStories from '@/pages/NearbyStories.jsx';
import AdventureFinder from '@/pages/AdventureFinder';
import LocationDetail from '@/pages/LocationDetail';
import Profile from '@/pages/Profile';
import Admin from '@/pages/Admin';
import OnboardingScreen from '@/components/OnboardingScreen';
import Legal from '@/pages/Legal';
import RoutePlanner from '@/pages/RoutePlanner';
import PartnerDashboard from '@/pages/PartnerDashboard';
import AIConcierge from '@/pages/AIConcierge';
import AIBehaviorLoop from '@/pages/AIBehaviorLoop';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, needsProfileCompletion, completeProfile, needsConsentUpdate, acceptConsent, settings, accessBlocked, maintenanceMode, user, isGuest } = useAuth();

  const [onboardingDone, setOnboardingDone] = React.useState(false);

  const [loginScreenDismissed, setLoginScreenDismissed] = React.useState(
    () => sessionStorage.getItem("tp_login_skipped") === "1"
  );
  const handleSkipLogin = () => {
    sessionStorage.setItem("tp_login_skipped", "1");
    setLoginScreenDismissed(true);
  };

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    // auth_required → guest mode, fall through to render app
  }

  // Maintenance mode
  if (maintenanceMode) return <MaintenanceScreen />;

  // Access blocked
  if (accessBlocked) return <AccessBlocked />;

  // Onboarding has HIGHEST priority — show before login or guest routing
  if (!onboardingDone) {
    return <OnboardingScreen isGuest={isGuest} onDone={() => setOnboardingDone(true)} />;
  }

  // Consent re-acceptance (policy updated)
  if (!needsProfileCompletion && needsConsentUpdate) {
    return <ConsentReAccept user={user} settings={settings} onAccepted={acceptConsent} />;
  }

  // Show profile completion screen for new users
  if (needsProfileCompletion) {
    return <ProfileCompletion user={user} onComplete={completeProfile} />;
  }

  // Show login screen for first-time guests (before they've skipped)
  if (isGuest && !loginScreenDismissed) {
    return <LoginScreen onSkip={handleSkipLogin} />;
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/Home" replace />} />
      <Route element={<AppLayout />}>
        <Route path="/Home" element={<Home />} />
        <Route path="/NearbyStories" element={<NearbyStories />} />
        <Route path="/AdventureFinder" element={<AdventureFinder />} />
        <Route path="/LocationDetail" element={<LocationDetail />} />
        <Route path="/Profile" element={isGuest ? <GuestProfileScreen /> : <Profile />} />
        <Route path="/Admin" element={<Admin />} />
        <Route path="/Legal" element={<Legal />} />
        <Route path="/RoutePlanner" element={<RoutePlanner />} />
        <Route path="/Partner" element={<PartnerDashboard />} />
        <Route path="/AIConcierge" element={<AIConcierge />} />
        <Route path="/AIBehaviorLoop" element={<AIBehaviorLoop />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App