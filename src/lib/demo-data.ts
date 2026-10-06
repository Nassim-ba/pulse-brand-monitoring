import type { RawMention, SourceKind } from "./types";

/**
 * Synthetic demo mentions for "ATZ Group". All persons, handles and posts are
 * fictional and clearly labelled as demo content in the UI. Links point to an
 * internal source page instead of pretending to be real URLs.
 */

type Seed = [days: number, source: keyof typeof SOURCES, author: string, title: string, content: string];

const SOURCES: Record<string, { label: string; kind: SourceKind }> = {
  linkedin: { label: "LinkedIn", kind: "social" },
  instagram: { label: "Instagram", kind: "social" },
  x: { label: "X (Twitter)", kind: "social" },
  employer: { label: "Arbeitgeber-Bewertung", kind: "review" },
  customer: { label: "Kunden-Bewertung", kind: "review" },
  forum: { label: "Fachforum", kind: "forum" },
  reddit: { label: "Reddit", kind: "forum" },
  press: { label: "Lokalpresse", kind: "news" },
  trade: { label: "Fachmedium", kind: "news" },
  blog: { label: "Branchenblog", kind: "news" },
};

const SEEDS: Seed[] = [
  [0.2, "x", "@growth_hacker_jan", "Kaltakquise-Thread",
    "Dritter Anruf diese Woche von ATZ, obwohl ich zweimal gesagt habe, dass wir kein Interesse haben. Wer kennt das noch? 🙄 So gewinnt man keine Kunden. #B2B #Kaltakquise"],
  [0.4, "linkedin", "Sabine K., Head of Marketing (Maschinenbau)", "Suche Partner für Leadgenerierung DACH",
    "Wir suchen für 2027 einen Partner für internationale Leadgenerierung im Maschinenbau. Hat jemand Erfahrung mit der ATZ Group aus Dortmund? Freue mich über ehrliche Einschätzungen per DM oder hier in den Kommentaren."],
  [0.7, "instagram", "@lena.studiert.marketing", "Kommentar unter Karriere-Post",
    "Wie lange läuft die Bewerbungsphase für das Praktikum im Marketing noch? Habe vor drei Wochen meine Unterlagen geschickt und noch nichts gehört 😕 @atz.group"],
  [1.1, "employer", "Ehemalige/r Mitarbeiter/in, Sales", "Viel Druck, wenig Struktur",
    "Das Team ist jung und motiviert, aber die Zielvorgaben im Vertrieb sind extrem hoch und Überstunden werden erwartet. Einarbeitung war chaotisch. Gehalt ok, Fixum könnte höher sein. Für Berufseinsteiger als Sprungbrett trotzdem lehrreich."],
  [1.3, "press", "Dortmunder Stadtanzeiger (fiktiv)", "Gerücht um Insolvenz: ATZ stellt klar",
    "In sozialen Netzwerken kursiert seit Montag die Behauptung, die ATZ Group sei insolvent. Hintergrund ist offenbar eine Verwechslung mit einem gleichnamigen Autohaus in Niedersachsen. Die Dortmunder Unternehmensgruppe hat bislang nicht öffentlich Stellung bezogen."],
  [1.5, "x", "@ruhrpott_insider", "Insolvenz-Gerücht",
    "Krass, ATZ aus Dortmund ist wohl pleite?! Erst die ganzen Stellenanzeigen und jetzt das. Wer weiß mehr?"],
  [2.0, "customer", "Geschäftsführer, IT-Dienstleister", "Ergebnisse übertroffen",
    "Wir arbeiten seit einem Jahr mit ATZ Marketing zusammen. Die Kampagne hat in sechs Monaten über 120 qualifizierte Leads gebracht. Ansprechpartner immer erreichbar, Reporting transparent. Klare Empfehlung."],
  [2.4, "forum", "autofan_bs", "Autohaus ATZ geschlossen?",
    "Weiß jemand, was mit dem Autohaus ATZ in Braunschweig los ist? Die Werkstatt ist seit letzter Woche zu und ich habe dort noch meinen Wagen zur Inspektion stehen."],
  [3.0, "linkedin", "Marco T., Account Manager bei ATZ", "Unser neues Büro am Phoenixsee",
    "Endlich eingezogen! 🎉 Neues Büro, neuer Blick auf den Phoenixsee und Platz für 60 weitere Kolleginnen und Kollegen. Wir stellen ein: Sales, Marketing, IT. Schreibt mir gern direkt."],
  [3.2, "trade", "Kfz-Technik-Portal (fiktiv)", "Lesetipp aus der Fahrzeugtechnik",
    "Die neue Ausgabe der ATZ (Automobiltechnische Zeitschrift) widmet sich dem Schwerpunkt Batterietechnik. Für Entwickler im Bereich E-Mobilität eine lohnende Lektüre."],
  [3.6, "customer", "Marketingleiterin, Medizintechnik", "Kommunikation nach Vertragsende mangelhaft",
    "Die Zusammenarbeit lief anfangs gut, aber seit wir gekündigt haben, bekommen wir keine Antwort mehr auf unsere Rechnungsfrage. Drei E-Mails, zwei Anrufe, nichts. Sehr enttäuschend für ein Unternehmen dieser Größe."],
  [4.0, "instagram", "@dortmund.business", "Beste Arbeitgeber Dortmunds",
    "Glückwunsch an die @atz.group zur Auszeichnung als einer der besten Arbeitgeber Dortmunds 2026! 👏 Starke Leistung vom Team am Phoenixsee."],
  [4.5, "reddit", "u/throwaway_sales_nrw", "Erfahrungen ATZ Dortmund als Junior Sales?",
    "Hab ein Angebot als Junior Sales Manager bei ATZ in Dortmund. Lohnt sich das als Einstieg oder eher Finger weg? Hab gemischte Sachen gelesen. Würde mich über Erfahrungen freuen."],
  [5.0, "blog", "B2B Growth Blog", "Commercial Growth Orchestration: Buzzword oder Ansatz?",
    "Die ATZ Group positioniert sich mit dem Begriff Commercial Growth Orchestration. Im Kern geht es darum, Marketing, Vertrieb und Daten in einem System zu verzahnen. Klingt nach Buzzword, die vorgestellten Fallstudien zeigen aber einen durchdachten Ansatz."],
  [5.5, "employer", "Aktuelle/r Mitarbeiter/in, Marketing", "Tolles Team und echte Verantwortung",
    "Ich durfte schon nach drei Monaten eigene Kundenprojekte übernehmen. Flache Hierarchien, moderne Tools, regelmäßige Teamevents. Homeoffice ist leider nicht möglich, das ist der einzige Minuspunkt."],
  [6.0, "x", "@b2b_mia", "Webinar-Feedback",
    "Gerade das Webinar von ATZ Intelligence zu datengetriebener Marktanalyse gesehen. Endlich mal konkrete Zahlen statt Folienkaraoke. 🔥"],
  [6.5, "forum", "hr_profi_77", "Altersteilzeit (ATZ) und Rentenabschläge",
    "Wie wirkt sich die ATZ im Blockmodell auf die spätere Rente aus? Mein Arbeitgeber bietet Altersteilzeit ab 60 an und ich bin unsicher wegen der Abschläge."],
  [7.0, "customer", "Vertriebsleiter, Logistik", "Leads waren nicht passend",
    "Viele der gelieferten Kontakte passten nicht zu unserer Zielgruppe. Nach Rückmeldung wurde nachgebessert, aber das hat uns zwei Monate gekostet. Preis-Leistung aus unserer Sicht nur durchschnittlich."],
  [8.0, "linkedin", "Dr. Felix R., CEO SaaS-Startup", "Danke an das ATZ-Team",
    "Kurzer Shoutout an ATZ Media für die Unterstützung beim Markteintritt in UK. Professionell, schnell, und das Team versteht B2B wirklich. Gerne wieder."],
  [9.0, "instagram", "@karriere.coach.ruhr", "Story-Erwähnung",
    "Heute Bewerbungstraining bei ATZ am Phoenixsee gegeben. Super spannende Fragen von den Azubis! 💡"],
  [10.0, "press", "Wirtschaftsportal Ruhr (fiktiv)", "Dortmunder Marketinggruppe wächst international",
    "Die ATZ Group mit Sitz am Phoenixsee hat nach eigenen Angaben inzwischen Projekte in mehr als 150 Ländern umgesetzt. Für 2027 plant das Unternehmen weitere Neueinstellungen am Standort Dortmund."],
  [11.0, "employer", "Bewerber/in", "Bewerbungsprozess schnell und fair",
    "Vom ersten Kontakt bis zur Zusage vergingen nur zehn Tage. Das Gespräch war auf Augenhöhe, mit einer kleinen Praxisaufgabe. So sollte das überall laufen."],
  [12.0, "x", "@sven_marketing", "Spam-Mails",
    "Bekomme seit Wochen Newsletter von ATZ, obwohl ich mich nie angemeldet habe. Abmelden funktioniert nicht. DSGVO anyone?"],
  [13.0, "reddit", "u/dortmund_dev", "Re: Arbeitgeber in Dortmund für Quereinsteiger",
    "ATZ am Phoenixsee stellt viel ein, auch Quereinsteiger. Ein Kumpel ist da im Sales und ganz zufrieden, sagt aber, man muss Druck abkönnen."],
  [14.0, "customer", "Inhaberin, Personalberatung", "Recruiting-Kampagne hat funktioniert",
    "Über ATZ Recruiting haben wir zwei schwer zu besetzende Stellen in vier Wochen besetzt. Gute Beratung, faire Konditionen."],
  [15.0, "linkedin", "Julia M., Event Managerin", "Recap: ATZ auf der DMEXCO",
    "Was für zwei Tage auf der DMEXCO! Danke an alle, die an unserem Stand vorbeigekommen sind. Die Gespräche zu KI im B2B-Marketing waren das Highlight."],
  [17.0, "blog", "Marketing-Tools-Vergleich", "Top 10 Leadgen-Agenturen in Deutschland",
    "Platz 4: ATZ Group (Dortmund). Stärken sind die internationale Reichweite und das breite Leistungsspektrum. Schwächen sind wenig transparente Preise auf der Website."],
  [18.0, "x", "@foodtruck_atz", "Heute am Phoenixsee",
    "Unser Foodtruck ATZ (Asia To Zero Waste) steht heute ab 11 Uhr am Phoenixsee! 🍜 Kommt vorbei."],
  [20.0, "employer", "Ehemalige/r Mitarbeiter/in, IT", "Moderne Technik, aber hohe Fluktuation",
    "Technisch gut aufgestellt, viel Automatisierung und KI im Einsatz. Leider wechseln Kolleginnen und Kollegen häufig, dadurch geht Wissen verloren."],
  [22.0, "instagram", "@marketing.mit.max", "Kommentar unter Reel",
    "Wie viel kostet so eine Kampagne bei euch ungefähr? Für ein kleines Unternehmen mit 20 Mitarbeitenden. @atz.group"],
  [24.0, "customer", "Geschäftsführer, Maschinenbau", "Zuverlässiger Partner seit Jahren",
    "Wir arbeiten seit 2021 mit ATZ zusammen. Messeeinladungen, Telemarketing, Kampagnen. Läuft sauber, Termine werden gehalten."],
  [26.0, "forum", "selbststaendig_ruhr", "Erfahrungen mit Agenturen für Telefonakquise",
    "Hat jemand Erfahrungen mit ATZ oder ähnlichen Anbietern für Terminierung? Brauche Unterstützung für meine Softwarefirma, Budget ist begrenzt."],
  [28.0, "press", "Dortmunder Stadtanzeiger (fiktiv)", "Phoenixsee: Unternehmen engagieren sich für Schulen",
    "Mehrere Unternehmen vom Phoenixsee, darunter die ATZ Group, unterstützen ein neues Programm zur Berufsorientierung an Dortmunder Gesamtschulen."],
  [31.0, "x", "@hr_tech_daily", "Recruiting-Studie",
    "Spannende Zahlen aus der neuen Studie von ATZ Recruiting: 64 % der Fachkräfte im Maschinenbau sind offen für einen Wechsel. Link in der Bio des Unternehmens."],
  [34.0, "employer", "Aktuelle/r Mitarbeiter/in, Media", "Gute Weiterbildung",
    "Es gibt ein echtes Weiterbildungsbudget und interne Academy-Formate. Die Führungskräfte nehmen sich Zeit für Feedback."],
  [37.0, "customer", "Marketingmanager, Chemie", "Abrechnung undurchsichtig",
    "Die Leistung war in Ordnung, aber die Rechnungen sind schwer nachvollziehbar. Einzelposten werden nicht aufgeschlüsselt. Wir mussten mehrfach nachfragen."],
  [40.0, "linkedin", "Tobias L., Werkstudent bei ATZ", "Mein erstes Jahr bei ATZ",
    "Ein Jahr als Werkstudent im Bereich AI Automation. Ich habe mehr gelernt als in vier Semestern. Danke an mein Team!"],
  [44.0, "blog", "Dortmund Startup Szene", "Etablierte Player vom Phoenixsee",
    "Neben vielen Startups haben sich am Phoenixsee auch etablierte Unternehmen wie die ATZ Group angesiedelt. Das sorgt für einen spannenden Mix."],
  [48.0, "reddit", "u/marketing_newbie", "ATZ Group Webinar zu LinkedIn Ads",
    "Kann das ATZ-Webinar zu LinkedIn Ads empfehlen, war kostenlos und hatte echt brauchbare Tipps für B2B."],
  [53.0, "customer", "Gründerin, E-Learning", "Leider nicht überzeugt",
    "Hohe Erwartungen nach dem Erstgespräch, aber die Kampagne brachte kaum Ergebnisse. Die Kommunikation war freundlich, aber die Strategie hat nicht zu uns gepasst."],
  [58.0, "instagram", "@atz.fan.account", "Teamevent",
    "Was für ein Sommerfest am Phoenixsee! 🎉 Danke ATZ für die tolle Organisation."],
  [63.0, "press", "Wirtschaftsportal Ruhr (fiktiv)", "Autohaus ATZ meldet Insolvenz an",
    "Das Braunschweiger Autohaus ATZ hat beim Amtsgericht Insolvenz beantragt. Rund 40 Beschäftigte sind betroffen. Mit der gleichnamigen Marketinggruppe aus Dortmund besteht kein Zusammenhang."],
  [70.0, "linkedin", "Anna W., Head of Sales (Software)", "Messe-Terminierung über ATZ",
    "Dank der Vorab-Terminierung durch ATZ hatten wir auf der Hannover Messe 35 qualifizierte Gespräche. Bester Messeauftritt bisher."],
];

export function demoMentions(brand: string): RawMention[] {
  const now = Date.now();
  return SEEDS.map(([days, source, author, title, content], i) => {
    const id = `demo-${String(i + 1).padStart(2, "0")}`;
    const s = SOURCES[source];
    return {
      id,
      brand,
      source: `demo-${source}`,
      sourceLabel: s.label,
      kind: s.kind,
      title,
      content,
      url: `/quelle/${id}`,
      author,
      // Add a pseudo-random hour offset so items don't all share the same time of day.
      publishedAt: new Date(now - days * 86_400_000 - ((i * 37) % 9) * 3_600_000).toISOString(),
      isDemo: true,
    };
  });
}
