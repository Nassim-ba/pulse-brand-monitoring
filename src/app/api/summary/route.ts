import { getSummary } from "@/lib/service";
import type { MentionFilters } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    filters?: MentionFilters;
    scopeLabel?: string;
    force?: boolean;
  };
  try {
    const summary = await getSummary(body.filters ?? {}, body.scopeLabel ?? "Alle Erwähnungen", body.force);
    return Response.json({ summary });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Zusammenfassung fehlgeschlagen." }, { status: 500 });
  }
}
