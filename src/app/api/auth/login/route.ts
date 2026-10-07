import { z } from "zod";
import { AuthError, login } from "@/lib/auth";

const Body = z.object({ email: z.string().max(200), password: z.string().max(200) });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bitte E-Mail und Passwort angeben." }, { status: 400 });
  try {
    return Response.json({ user: await login(parsed.data) });
  } catch (err) {
    if (err instanceof AuthError) return Response.json({ error: err.message }, { status: 401 });
    console.error(err);
    return Response.json({ error: "Anmeldung fehlgeschlagen." }, { status: 500 });
  }
}
