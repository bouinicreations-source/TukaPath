export default function SocialLinks({ settings = {} }) {
  const links = [
    { label: "Instagram", href: settings.instagram_url || "#" },
    { label: "TikTok", href: settings.tiktok_url || "#" },
    { label: "Facebook", href: settings.facebook_url || "#" },
    { label: "X", href: settings.twitter_url || "#" },
  ].filter(l => l.href !== "#");

  return (
    <section className="px-5 pt-6 pb-2 text-center">
      {links.length > 0 && (
        <div className="flex justify-center gap-4 mb-3">
          {links.map(l => (
            <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium">
              {l.label}
            </a>
          ))}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground leading-relaxed max-w-sm mx-auto">
        © 2026 tukapath.com . All rights reserved.
      </p>
    </section>
  );
}