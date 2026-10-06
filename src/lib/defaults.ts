import type { Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  brand: "ATZ Group",
  keywords: ["ATZ Group", "ATZ AG", "atz.de", "ATZ Marketing", "ATZ Media", "ATZ Recruiting", "ATZ Intelligence"],
  excludeKeywords: ["Altersteilzeit"],
  context:
    "Die ATZ Group (ATZ AG) ist eine 1973 gegründete, international tätige Unternehmensgruppe mit Sitz am Phoenixsee in Dortmund. Sie unterstützt B2B-Unternehmen bei Commercial Growth Orchestration, also Marketing, Leadgenerierung, Medien und Recruiting, in den Divisionen ATZ Media, ATZ Marketing, ATZ Intelligence und ATZ Recruiting. Nicht gemeint sind die Automobiltechnische Zeitschrift (ATZ), Altersteilzeit (ATZ) oder gleichnamige Autohäuser.",
  sources: { googleNews: true, bingNews: true, hackerNews: true },
  demoData: true,
};
