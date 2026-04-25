import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/api/supabase';

const AuthContext = createContext(null);

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

  function isProfileIncomplete(u) {
    const meta = u?.user_metadata || {};
    return !meta.first_name || !meta.last_name;
  }

  function needsConsentReAccept(u, s) {
    if (!s) return false;
    const meta = u?.user_metadata || {};
    return ['terms','privacy','disclaimer'].some(k => {
      const latest = s[`${k}_version`];
      return latest && meta[`consent_${k}_version`] !== latest;
    });
  }

  useEffect(() => {
  const safetyTimer = setTimeout(() => {
    setIsLoadingAuth(false);
    setIsGuest(true);
  }, 5000);

  const init = async () => {
    try {
      const siteSettings = await loadSettings();
      setSettings(siteSettings);
      if (siteSettings.maintenance_mode === 'true') {
        const { data: { user: u } } = await supabase.auth.getUser();
        if (u?.user_metadata?.role !== 'owner') setMaintenanceMode(true);
        if (u) { setUser(u); setNeedsProfileCompletion(isProfileIncomplete(u)); }
        clearTimeout(safetyTimer);
        setIsLoadingAuth(false);
        return;
      }
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        currentUser.role = currentUser.app_metadata?.role || currentUser.user_metadata?.role || null;
        setUser(currentUser);
        setIsGuest(false);
        setNeedsProfileCompletion(isProfileIncomplete(currentUser));
        setNeedsConsentUpdate(needsConsentReAccept(currentUser, siteSettings));
      } else {
        setIsGuest(true);
      }
    } catch (e) {
      console.error('Auth init error:', e);
      setIsGuest(true);
    } finally {
      clearTimeout(safetyTimer);
      setIsLoadingAuth(false);
    }
  };

  init();

  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      const u = session.user;
      u.role = u.app_metadata?.role || u.user_metadata?.role || null;
      setUser(u);
      setIsGuest(false);
      const s = await loadSettings();
      setNeedsProfileCompletion(isProfileIncomplete(u));
      setNeedsConsentUpdate(needsConsentReAccept(u, s));
    } else if (event === 'SIGNED_OUT') {
      setUser(null);
      setIsGuest(true);
      setNeedsProfileCompletion(false);
      setNeedsConsentUpdate(false);
    } else if (event === 'TOKEN_REFRESHED' && session?.user) {
      const u = session.user;
      u.role = u.app_metadata?.role || u.user_metadata?.role || null;
      setUser(u);
    }
  });

  return () => {
    subscription.unsubscribe();
    clearTimeout(safetyTimer);
  };
}, []);

    const init = async () => {
      try {
        const siteSettings = await loadSettings();
        setSettings(siteSettings);

        if (siteSettings.maintenance_mode === 'true') {
          const { data: { user: u } } = await supabase.auth.getUser();
          if (u?.user_metadata?.role !== 'owner') setMaintenanceMode(true);
          if (u) { setUser(u); setNeedsProfileCompletion(isProfileIncomplete(u)); }
          setIsLoadingAuth(false);
          return;
        }

        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          setUser(currentUser);
          setIsGuest(false);
          setNeedsProfileCompletion(isProfileIncomplete(currentUser));
          setNeedsConsentUpdate(needsConsentReAccept(currentUser, siteSettings));
        } else {
          setIsGuest(true);
        }
      } catch { setIsGuest(true); }
      finally { setIsLoadingAuth(false); }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        setIsGuest(false);
        const s = await loadSettings();
        setNeedsProfileCompletion(isProfileIncomplete(session.user));
        setNeedsConsentUpdate(needsConsentReAccept(session.user, s));
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsGuest(true);
        setNeedsProfileCompletion(false);
        setNeedsConsentUpdate(false);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const navigateToLogin = () => { window.location.href = '/login'; };
  const loginWithGoogle = () => supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/AIConcierge` }
  });
  const logout = async () => { await supabase.auth.signOut(); setUser(null); setIsGuest(true); };
  const completeProfile = (u) => { setUser(p => ({ ...p, user_metadata: { ...p?.user_metadata, ...u } })); setNeedsProfileCompletion(false); setNeedsConsentUpdate(false); };
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
