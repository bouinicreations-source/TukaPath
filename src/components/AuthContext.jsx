import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/api/supabase';

const AuthContext = createContext(null);

function attachRole(u) {
  if (!u) return u;
  u.role = u.app_metadata?.role || u.user_metadata?.role || null;
  return u;
}

function isProfileIncomplete(u) {
  if (!u) return false;
  const meta = u?.user_metadata || {};
  if (meta.full_name || meta.name || meta.avatar_url || meta.picture) return false;
  return !meta.first_name && !meta.last_name;
}

export function AuthProvider({ children }) {
  const [user, setUser]                       = useState(null);
  const [isGuest, setIsGuest]                 = useState(false);
  const [isLoadingAuth, setIsLoadingAuth]     = useState(true);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const [needsConsentUpdate, setNeedsConsentUpdate]         = useState(false);
  const [settings, setSettings]               = useState({});
  const [accessBlocked, setAccessBlocked]     = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  async function loadSettings() {
    try {
      const { data } = await supabase.from('site_settings').select('key, value');
      const map = {};
      (data || []).forEach(r => { map[r.key] = r.value; });
      return map;
    } catch { return {}; }
  }

  useEffect(() => {
    let mounted = true;

    // Step 1: Listen for auth state changes FIRST before any async work
    // This ensures we never miss a session restore event
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (session?.user) {
          const u = attachRole(session.user);
          setUser(u);
          setIsGuest(false);
          setNeedsProfileCompletion(isProfileIncomplete(u));
          setIsLoadingAuth(false);

          // Load settings in background — don't block render
          loadSettings().then(s => {
            if (mounted) setSettings(s);
          });
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsGuest(true);
          setIsLoadingAuth(false);
          setNeedsProfileCompletion(false);
          setNeedsConsentUpdate(false);
        }
      }
    );

    // Step 2: Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        const u = attachRole(session.user);
        setUser(u);
        setIsGuest(false);
        setNeedsProfileCompletion(isProfileIncomplete(u));
      } else {
        setIsGuest(true);
      }
      setIsLoadingAuth(false);
    }).catch(() => {
      if (mounted) {
        setIsGuest(true);
        setIsLoadingAuth(false);
      }
    });

    // Load settings independently
    loadSettings().then(s => {
      if (mounted) setSettings(s);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loginWithGoogle = () => supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/AIConcierge` }
  });

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsGuest(true);
  };

  const navigateToLogin = () => { window.location.href = '/login'; };

  const completeProfile = (u) => {
    setUser(p => ({ ...p, user_metadata: { ...p?.user_metadata, ...u } }));
    setNeedsProfileCompletion(false);
    setNeedsConsentUpdate(false);
  };

  const acceptConsent = () => setNeedsConsentUpdate(false);

  return (
    <AuthContext.Provider value={{
      user, setUser, isGuest, isLoadingAuth, isLoadingPublicSettings: false,
      navigateToLogin, loginWithGoogle, logout,
      needsProfileCompletion, completeProfile,
      needsConsentUpdate, acceptConsent,
      settings, accessBlocked, maintenanceMode,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
