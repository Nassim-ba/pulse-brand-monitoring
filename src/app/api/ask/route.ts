import { withUser } from "@/lib/context";
import { z } from "zod";
import { ask, LimitError } from "@/lib/service";

export const maxDuration = 60;

const Body = z.object({
  question: z.string().trim().min(3).max(500),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(12)
    .default([]),
  filters: z.record(z.string(), z.unknown()).default({}),
});

async function handlePOST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bitte eine Frage mit 3 bis 500 Zeichen stellen." }, { status: 400 });
  try {
    const { question, history, filters } = parsed.data;
    return Response.json(await ask(question, history, filters));
  } catch (err) {
    if (err instanceof LimitError) return Response.json({ error: err.message }, { status: 429 });
    console.error(err);
    return Response.json({ error: "Die Frage konnte gerade nicht beantwortet werden. Bitte erneut versuchen." }, { status: 500 });
  }
}

export const POST = (...args: Parameters<typeof handlePOST>) => withUser(() => handlePOST(...args));
