# Pulse · KI-gestütztes Brand Monitoring

Pulse sammelt Erwähnungen einer Marke aus dem Netz, lässt jede Erwähnung von Claude bewerten und zeigt dem Kommunikationsteam auf einen Blick, wo es reagieren sollte.

Gebaut als MVP für die ATZ Group, voreingestellt auf die Marke ATZ Group. Pulse arbeitet ausschließlich mit echten, live abgerufenen Daten.

## Funktionen

- **Markensuche** direkt in der oberen Leiste. Für neue Marken erstellt Claude automatisch ein Suchprofil (Suchbegriffe, Ausschlussbegriffe, Hashtags, Kontext). Bereits gesuchte Marken lassen sich schnell wechseln.
- **Social Media und Google** über Apify: Instagram-Posts zu Hashtags, TikTok-Videos und organische Google-Ergebnisse, jeweils mit Reichweite und Engagement. Dazu Google News, Bing News und Hacker News.
- **Reichweite und Engagement**: Top-Beiträge nach Reichweite, Interaktionen pro Plattform, Kritik mit großer Reichweite wird dringlicher eingestuft.
- **Relevanz, Stimmung und Thema** für jede Erwähnung, inklusive Begründung. Verwechslungen mit gleichnamigen Firmen oder Abkürzungen erkennt die KI und sortiert sie aus.
- **Handlungsbedarf** mit Dringlichkeit, Begründung, empfohlener Maßnahme und Antwortvorschlag. Beiträge lassen sich als erledigt markieren.
- **KI-Lagebericht** für jeden Zeitraum und jede Filterauswahl.
- **Wettbewerbsvergleich**: bis zu drei Wettbewerber (von Claude vorgeschlagen oder selbst gewählt) mit Share of Voice, Share of Reach, Stimmung, Engagement und einer KI-Wettbewerbsanalyse mit Stärken, Schwächen und Chancen.
- **Frag Pulse**: Fragen zu den Erwähnungen stellen, Claude antwortet mit Quellenverweisen.
- **Management-Report als PDF** mit Kennzahlen, Lagebericht, Handlungsbedarf und reichweitenstärksten Beiträgen, als Datei zum Herunterladen.
- **Filter für die gesamte Auswertung** nach Zeitraum, Plattform, Stimmung, Thema, Relevanz und Handlungsbedarf. Kennzahlen, Diagramme und Lagebericht rechnen mit der Auswahl. Filter stehen in der URL und lassen sich teilen.
- **Links zur Originalquelle** bei jeder Erwähnung.
- **Material Design 3**, responsiv mit Navigation Rail am Desktop und Navigation Bar am Smartphone, helles und dunkles Design.

## Konten

- Anmeldung mit E-Mail und Passwort (scrypt), Sitzung als signiertes Cookie, Konten in Postgres
- Hybrid-Modell: Suchergebnisse, Analysen und Suchprofile einer Marke werden geteilt, damit jede Marke nur einmal Kosten verursacht. Aktive Marke, Markenliste, Wettbewerber, Bearbeitungsstatus und Tageslimits sind pro Person.
- `AUTH_SECRET` signiert die Sitzungen (ohne Variable wird ein Schlüssel aus den übrigen Secrets abgeleitet)

## Architektur

```
Apify (Instagram, TikTok, Google Suche), asynchron ─┐
Live-Feeds (Google News, Bing News, Hacker News) ───┤
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
- Apify-Läufe dauern 30 bis 120 Sekunden. Die Suche startet sie asynchron, die Oberfläche fragt den Fortschritt ab und analysiert neue Beiträge, sobald sie da sind.
- Kostenschutz: höchstens 20 Ergebnisse pro Quelle, Kostendeckel pro Lauf, Ergebnisse 10 Minuten pro Marke wiederverwendet, Tageslimit für Suchen.
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

- Weitere Quellen (YouTube, Bewertungsportale, offizielle Social-Listening-APIs)
- Benachrichtigungen per E-Mail oder Slack bei hoher Dringlichkeit
- Mehrere Marken und Wettbewerbsvergleich
- Login und Rollen für Teams
- Automatischer Abruf per Cron statt manueller Aktualisierung
