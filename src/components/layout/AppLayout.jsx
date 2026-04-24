import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import useScrollRestoration from "@/hooks/useScrollRestoration";
import OnboardingScreen from "@/components/OnboardingScreen";

function ScrollManager() {
  useScrollRestoration();
  return null;
}

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-background font-inter">
      <ScrollManager />
      <OnboardingScreen context="after_signin" />
      <main className="pb-20">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}