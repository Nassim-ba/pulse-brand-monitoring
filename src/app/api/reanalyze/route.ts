import { CooldownError, reanalyzeAll } from "@/lib/service";

export const maxDuration = 120;

export async function POST() {
  try {
    const count = await reanalyzeAll();
    return Response.json({ count });
  } catch (err) {
    if (err instanceof CooldownError) return Response.json({ error: err.message }, { status: 429 });
    console.error(err);
    return Response.json({ error: "Neuanalyse fehlgeschlagen." }, { status: 500 });
  }
}
