import { z } from "zod";
import { AuthError, register } from "@/lib/auth";

const Body = z.object({ name: z.string().max(100), email: z.string().max(200), password: z.string().max(200) });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bitte alle Felder ausfüllen." }, { status: 400 });
  try {
    return Response.json({ user: await register(parsed.data) });
  } catch (err) {
    if (err instanceof AuthError) return Response.json({ error: err.message }, { status: 400 });
    console.error(err);
    return Response.json({ error: "Registrierung fehlgeschlagen." }, { status: 500 });
  }
}
