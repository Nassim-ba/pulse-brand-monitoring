# Pulse · KI-gestütztes Brand Monitoring

Pulse sammelt Erwähnungen einer Marke aus dem Netz, lässt jede Erwähnung von Claude bewerten und zeigt dem Kommunikationsteam auf einen Blick, wo es reagieren sollte.

Gebaut als MVP für die ATZ Group, voreingestellt auf die Marke ATZ Group.

## Funktionen

- **Relevanz, Stimmung und Thema** für jede Erwähnung, inklusive Begründung. Verwechslungen (Autohaus ATZ, Altersteilzeit, Automobiltechnische Zeitschrift) erkennt die KI und sortiert sie aus.
- **Handlungsbedarf** mit Dringlichkeit, Begründung, empfohlener Maßnahme und Antwortvorschlag. Beiträge lassen sich als erledigt markieren.
- **KI-Lagebericht** für jeden Zeitraum und jede Filterauswahl.
- **Filter und Suche** nach Stimmung, Thema, Quelle, Zeitraum und Handlungsbedarf. Filter stehen in der URL und lassen sich teilen.
- **Links zur Originalquelle** bei jeder Erwähnung.
- **Material Design 3**, responsiv mit Navigation Rail am Desktop und Navigation Bar am Smartphone, helles und dunkles Design.

## Architektur

```
Live-Quellen (Google News, Bing News, Hacker News) ─┐
Demo-Datensatz (synthetisch, gekennzeichnet) ───────┤
                                                    ▼
                          Next.js API (Vercel Functions)
                                                    │
                     Claude Haiku 4.5, strukturierte Ausgabe (JSON-Schema)
                     Fallback bei Ausfall: regelbasierte Analyse
                                                    │
                          Postgres (Neon), Analysen werden gespeichert
                                                    ▼
                          Next.js + MUI im M3-Theme
```

- Jede Erwähnung wird **einmal** analysiert und gespeichert. Seitenaufrufe kosten keine KI-Anfragen.
- Analysen laufen in Batches von 12 Erwähnungen, vier Batches parallel.
- Claude antwortet über **Structured Outputs** mit festem Schema, dadurch ist jede Antwort maschinenlesbar.
- Fällt die KI aus oder fehlt der Schlüssel, übernimmt eine regelbasierte Analyse. Die Oberfläche zeigt an, welche Methode verwendet wurde.

## Lokal starten

```bash
npm install
cp .env.example .env.local   # optional ANTHROPIC_API_KEY und DATABASE_URL eintragen
npm run dev
```

## Stack

Next.js 16, React 19, TypeScript, MUI 9 mit eigenem Material-3-Theme, MUI X Charts, Anthropic SDK, Neon Postgres, Vercel.

## Ausblick

- Lizenzierte Quellen anbinden (Social-Listening-APIs, Bewertungsportale)
- Benachrichtigungen per E-Mail oder Slack bei hoher Dringlichkeit
- Mehrere Marken und Wettbewerbsvergleich
- Login und Rollen für Teams
- Automatischer Abruf per Cron statt manueller Aktualisierung
