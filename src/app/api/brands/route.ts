import { switchBrand } from "@/lib/service";

/** Switches the active brand to an already searched one. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { slug?: string };
  if (!body.slug || !(await switchBrand(body.slug))) {
    return Response.json({ error: "Marke nicht gefunden." }, { status: 404 });
  }
  return Response.json({ ok: true });
}
