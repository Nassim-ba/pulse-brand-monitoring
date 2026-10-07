import { withUser } from "@/lib/context";
import { LimitError, NotBrandError, pollSearch, startSearch } from "@/lib/service";

export const maxDuration = 120;

/** Starts a search for the given brand (or the active one). */
async function handlePOST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { brand?: string };
  const brand = typeof body.brand === "string" ? body.brand.trim() : undefined;
  if (brand !== undefined && (brand.length < 2 || brand.length > 60)) {
    return Response.json({ error: "Bitte einen Markennamen mit 2 bis 60 Zeichen eingeben." }, { status: 400 });
  }
  try {
    return Response.json({ job: await startSearch(brand) });
  } catch (err) {
    if (err instanceof LimitError) return Response.json({ error: err.message }, { status: 429 });
    if (err instanceof NotBrandError) return Response.json({ error: err.message }, { status: 422 });
    console.error(err);
    return Response.json({ error: "Suche konnte nicht gestartet werden." }, { status: 500 });
  }
}

/** Polls the running search of the active brand. */
async function handleGET() {
  try {
    return Response.json({ job: await pollSearch() });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Status konnte nicht abgefragt werden." }, { status: 500 });
  }
}

export const POST = (...args: Parameters<typeof handlePOST>) => withUser(() => handlePOST(...args));
export const GET = (...args: Parameters<typeof handleGET>) => withUser(() => handleGET(...args));
