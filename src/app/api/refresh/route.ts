import { loadMentions, refresh } from "@/lib/service";

export const maxDuration = 60;

export async function POST() {
  try {
    const result = await refresh();
    // Analyse new mentions right away so the client gets a complete picture.
    if (result.inserted > 0) await loadMentions();
    return Response.json(result);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Aktualisierung fehlgeschlagen." }, { status: 500 });
  }
}
