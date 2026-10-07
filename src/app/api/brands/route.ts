import { withUser } from "@/lib/context";
import { switchBrand } from "@/lib/service";

/** Switches the active brand to an already searched one. */
async function handlePOST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { slug?: string };
  if (!body.slug || !(await switchBrand(body.slug))) {
    return Response.json({ error: "Marke nicht gefunden." }, { status: 404 });
  }
  return Response.json({ ok: true });
}

export const POST = (...args: Parameters<typeof handlePOST>) => withUser(() => handlePOST(...args));
