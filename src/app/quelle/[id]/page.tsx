import { notFound } from "next/navigation";
import { demoMentions } from "@/lib/demo-data";

export default async function DemoSourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = demoMentions("atz-group").find((x) => x.id === id);
  if (!m) notFound();

  return (
    <div style={{ minHeight: "100dvh", background: "var(--md-surface-container)", padding: "24px 16px", fontFamily: "var(--font-roboto-flex), Roboto, sans-serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div
          role="note"
          style={{
            background: "var(--md-tertiary-container)",
            color: "var(--md-on-tertiary-container)",
            borderRadius: 12,
            padding: "12px 16px",
            fontSize: 14,
            marginBottom: 16,
          }}
        >
          <strong>Demo-Quelle.</strong> Dieser Beitrag ist synthetisch und dient nur der Vorführung von Pulse. Personen,
          Konten und Inhalte sind fiktiv. Bei echten Erwähnungen führt dieser Link direkt zum Originalbeitrag.
        </div>
        <article style={{ background: "var(--md-surface)", borderRadius: 16, padding: 24, border: "1px solid var(--md-outline-variant)" }}>
          <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", marginBottom: 4 }}>
            {m.sourceLabel} · {m.author}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: "4px 0 12px" }}>{m.title}</h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, margin: 0 }}>{m.content}</p>
        </article>
        <p style={{ textAlign: "center", marginTop: 24 }}>
          <a href="/erwaehnungen" style={{ color: "var(--md-primary)", fontWeight: 500 }}>
            Zurück zu Pulse
          </a>
        </p>
      </div>
    </div>
  );
}
