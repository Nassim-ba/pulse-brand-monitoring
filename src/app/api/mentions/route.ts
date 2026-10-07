import { withUser } from "@/lib/context";
import { getMeta, loadMentions } from "@/lib/service";

export const maxDuration = 120; // background analysis runs within this budget

async function handleGET() {
  try {
    const [{ settings, mentions }, meta] = await Promise.all([loadMentions({ background: true }), getMeta()]);
    return Response.json({ settings, mentions, meta });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Erwähnungen konnten nicht geladen werden." }, { status: 500 });
  }
}

export const GET = (...args: Parameters<typeof handleGET>) => withUser(() => handleGET(...args));
