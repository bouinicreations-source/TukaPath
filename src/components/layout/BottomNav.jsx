import { useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/client";
import { useAuth } from "@/components/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Home, Compass, MapPin, User, Route, Sparkles } from "lucide-react";

const ALL_TABS = [
  { path: "/Home",           icon: Home,     label: "Home",      owned: ["/Home"],                            featureKey: null                },
  { path: "/NearbyStories",  icon: MapPin,   label: "Stories",   owned: ["/NearbyStories", "/LocationDetail"], featureKey: "feature_stories"   },
  { path: "/RoutePlanner",   icon: Route,    label: "Journey",   owned: ["/RoutePlanner"],                    featureKey: "feature_journey"   },
  { path: "/AdventureFinder",icon: Compass,  label: "Adventure", owned: ["/AdventureFinder"],                 featureKey: "feature_adventure" },
  { path: "/AIConcierge",    icon: Sparkles, label: "Concierge", owned: ["/AIConcierge"],                     featureKey: "feature_concierge" },
  { path: "/Profile",        icon: User,     label: "Profile",   owned: ["/Profile", "/Admin", "/Legal"],     featureKey: null                },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "owner" || user?.role === "editor";

  const { data: settingsRaw = [] } = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => base44.entities.SiteSettings.list(),
    staleTime: 60000,
  });

  const settings = settingsRaw.reduce((acc, s) => { acc[s.key] = s.value; return acc; }, {});

  const TAB_ROOTS = ALL_TABS.filter(tab => {
    if (!tab.featureKey) return true;
    return settings[tab.featureKey] !== "false" || isAdmin;
  });

  // Find which tab owns the current path
  const activeTab = TAB_ROOTS.find(t => t.owned.some(p => location.pathname.startsWith(p)));

  const handleTabPress = (tab) => {
    const isActive = activeTab?.path === tab.path;
    if (isActive) {
      sessionStorage.removeItem(`tp_scroll_${tab.path}`);
      window.scrollTo(0, 0);
      navigate(tab.path, { replace: true });
    } else {
      const last = sessionStorage.getItem(`tp_tab_last_${tab.path}`);
      navigate(last || tab.path);
    }
  };

  // Store last visited path for the active tab on every location change
  if (activeTab) {
    sessionStorage.setItem(`tp_tab_last_${activeTab.path}`, location.pathname + location.search);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {TAB_ROOTS.map((item) => {
          const isActive = activeTab?.path === item.path;
          const isProtected = item.path === "/Profile";
          return (
            <button
              key={item.path}
              onClick={() => handleTabPress(item)}
              className={`flex flex-col items-center justify-center gap-0.5 w-16 py-1 rounded-xl transition-all duration-200 ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "stroke-[2.5px]" : ""}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive && (
                <div className="w-1 h-1 rounded-full bg-primary mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}