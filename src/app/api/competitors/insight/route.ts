import { withUser } from "@/lib/context";
import { getCompetitorInsight } from "@/lib/service";
import type { MentionFilters } from "@/lib/types";

export const maxDuration = 120;

async function handlePOST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { filters?: MentionFilters; force?: boolean };
  try {
    return Response.json({ insight: await getCompetitorInsight(body.filters ?? {}, body.force) });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "KI-Analyse fehlgeschlagen." }, { status: 500 });
  }
}

export const POST = (...args: Parameters<typeof handlePOST>) => withUser(() => handlePOST(...args));
