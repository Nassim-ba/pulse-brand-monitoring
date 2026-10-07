import { withUser } from "@/lib/context";
import { store } from "@/lib/store";

async function handlePATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { status?: string };
  if (body.status !== "open" && body.status !== "done") {
    return Response.json({ error: "Ungültiger Status." }, { status: 400 });
  }
  await store.setStatus(id, body.status);
  return Response.json({ id, status: body.status });
}

export const PATCH = (...args: Parameters<typeof handlePATCH>) => withUser(() => handlePATCH(...args));
