import { z } from "zod";
import {
  addCompetitor,
  getComparison,
  LimitError,
  NotBrandError,
  pollComparison,
  refreshComparison,
  removeCompetitor,
  suggestCompetitors,
} from "@/lib/service";
import type { MentionFilters } from "@/lib/types";

export const maxDuration = 120;

function parseFilters(request: Request): MentionFilters {
  try {
    return JSON.parse(new URL(request.url).searchParams.get("filters") ?? "{}");
  } catch {
    return {};
  }
}

/** Comparison of the monitored brand with its competitors. `poll=1` advances running searches first. */
export async function GET(request: Request) {
  try {
    if (new URL(request.url).searchParams.get("poll") === "1") await pollComparison();
    return Response.json(await getComparison(parseFilters(request)));
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Vergleich konnte nicht geladen werden." }, { status: 500 });
  }
}

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), name: z.string().trim().min(2).max(60) }),
  z.object({ action: z.literal("remove"), slug: z.string().max(80) }),
  z.object({ action: z.literal("refresh") }),
  z.object({ action: z.literal("suggest") }),
]);

export async function POST(request: Request) {
  const parsed = Action.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  const body = parsed.data;
  try {
    switch (body.action) {
      case "add":
        await addCompetitor(body.name);
        return Response.json({ ok: true });
      case "remove":
        await removeCompetitor(body.slug);
        return Response.json({ ok: true });
      case "refresh":
        await refreshComparison();
        return Response.json({ ok: true });
      case "suggest":
        return Response.json({ suggestions: await suggestCompetitors() });
    }
  } catch (err) {
    if (err instanceof NotBrandError) return Response.json({ error: err.message }, { status: 422 });
    if (err instanceof LimitError) return Response.json({ error: err.message }, { status: 429 });
    console.error(err);
    return Response.json({ error: "Aktion fehlgeschlagen." }, { status: 500 });
  }
}
