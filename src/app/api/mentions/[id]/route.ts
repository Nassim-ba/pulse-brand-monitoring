import { store } from "@/lib/store";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { status?: string };
  if (body.status !== "open" && body.status !== "done") {
    return Response.json({ error: "Ungültiger Status." }, { status: 400 });
  }
  const mention = await store.setStatus(id, body.status);
  if (!mention) return Response.json({ error: "Nicht gefunden." }, { status: 404 });
  return Response.json({ mention });
}
