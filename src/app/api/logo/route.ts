/**
 * Serves a brand's icon from our own origin, so it can be embedded in the
 * generated PDF (cross-origin images would taint the canvas).
 */
export async function GET(request: Request) {
  const domain = new URL(request.url).searchParams.get("domain")?.toLowerCase() ?? "";
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return new Response("Invalid domain", { status: 400 });
  try {
    const res = await fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return new Response("Not found", { status: 404 });
    return new Response(await res.arrayBuffer(), {
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
