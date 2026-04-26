import { motion } from "framer-motion";

const LOGO_URL = "/logo.jpg";

export default function HeroSection({ settings = {} }) {
  const headline = settings.headline || "Explore the world differently";
  const subtitle = settings.subtitle || "Find where your budget can take you or hear the story behind the places around you";
  const tagline = settings.tagline || "Hear the story behind every pin.";
  const heroImage = settings.hero_image;

  return (
    <section className="relative overflow-hidden px-6 pt-10 pb-8 text-center">
      {heroImage ? (
        <div className="absolute inset-0">
          <img src={heroImage} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-background/85" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-secondary/40 to-background" />
      )}
      <div className="relative z-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex justify-center mb-5"
        >
          <img
            src={LOGO_URL}
            alt="TukaPath"
            className="h-20 w-auto rounded-2xl shadow-lg"
          />
        </motion.div>

        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-2xl md:text-3xl font-bold text-foreground tracking-tight leading-tight"
        >
          {headline.includes("differently") ? (
            <>Explore the world{" "}<span className="text-primary">differently</span></>
          ) : headline}
        </motion.h1>

        {tagline && (
          <motion.p
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="mt-2 text-sm font-medium text-accent"
          >
            {tagline}
          </motion.p>
        )}

        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="mt-2 text-muted-foreground text-sm max-w-md mx-auto leading-relaxed"
        >
          {subtitle}
        </motion.p>
      </div>
    </section>
  );
}