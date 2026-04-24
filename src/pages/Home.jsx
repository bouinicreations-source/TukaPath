import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/client";
import HeroSection from "../components/home/HeroSection";
import FeatureCards from "../components/home/FeatureCards";
import SocialLinks from "../components/home/SocialLinks";

export default function Home() {
  const { data: settingsRaw = [] } = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => base44.entities.SiteSettings.list(),
    staleTime: 60000,
  });

  // Convert array of {key, value} into object
  const settings = settingsRaw.reduce((acc, s) => {
    acc[s.key] = s.value;
    return acc;
  }, {});

  return (
    <div className="max-w-lg mx-auto pb-4">
      <HeroSection settings={settings} />
      <FeatureCards settings={settings} />
      <SocialLinks settings={settings} />
    </div>
  );
}