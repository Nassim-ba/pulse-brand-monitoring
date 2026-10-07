import type { Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  brand: "ATZ Group",
  domain: "atz.group",
  keywords: ["ATZ Group", "ATZ AG", "atz.de", "ATZ Marketing", "ATZ Media", "ATZ Recruiting", "ATZ Intelligence"],
  excludeKeywords: ["Altersteilzeit"],
  hashtags: ["atzgroup", "atzmarketing"],
  context:
    "Die ATZ Group (ATZ AG) ist eine 1973 gegründete, international tätige Unternehmensgruppe mit Sitz am Phoenixsee in Dortmund. Sie unterstützt B2B-Unternehmen bei Commercial Growth Orchestration, also Marketing, Leadgenerierung, Medien und Recruiting, in den Divisionen ATZ Media, ATZ Marketing, ATZ Intelligence und ATZ Recruiting. Nicht gemeint sind die Automobiltechnische Zeitschrift (ATZ), Altersteilzeit (ATZ) oder gleichnamige Autohäuser.",
  sources: { googleNews: true, bingNews: true, hackerNews: true, googleSearch: true, instagram: true, tiktok: true },
};

/** Profile for a newly searched brand when no AI is available. */
export function basicProfile(brand: string): Settings {
  const tag = brand.toLowerCase().replace(/[^a-z0-9äöüß]/g, "");
  return {
    ...DEFAULT_SETTINGS,
    brand,
    domain: undefined,
    keywords: [brand],
    excludeKeywords: [],
    hashtags: tag ? [tag] : [],
    context: `Überwacht wird die Marke ${brand}.`,
  };
}
