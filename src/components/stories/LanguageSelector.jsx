const ALL_LANGUAGES = [
  { code: "en", label: "EN", name: "English" },
  { code: "ar", label: "AR", name: "Arabic" },
  { code: "es", label: "ES", name: "Español" },
  { code: "fr", label: "FR", name: "Français" },
  { code: "it", label: "IT", name: "Italiano" },
  { code: "zh", label: "ZH", name: "中文" },
];

/**
 * availableLanguages: array of language codes that have ready translations.
 * If not provided, shows all languages (legacy behaviour).
 * English is always shown.
 */
export default function LanguageSelector({ selected, onChange, loading, availableLanguages }) {
  const visible = ALL_LANGUAGES.filter(lang =>
    lang.code === "en" || !availableLanguages || availableLanguages.includes(lang.code)
  );

  // Don't render if only English is available
  if (visible.length <= 1) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {visible.map((lang) => (
        <button
          key={lang.code}
          onClick={() => onChange(lang.code)}
          disabled={loading && selected !== lang.code}
          title={lang.name}
          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors
            ${selected === lang.code
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
            }`}
        >
          {lang.label}
        </button>
      ))}
      {loading && (
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <span className="w-2.5 h-2.5 border-2 border-muted border-t-primary rounded-full animate-spin inline-block" />
          Translating…
        </span>
      )}
    </div>
  );
}