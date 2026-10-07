import { withUser } from "@/lib/context";
import { z } from "zod";
import { store } from "@/lib/store";

const SettingsSchema = z.object({
  brand: z.string().trim().min(2).max(60),
  domain: z.string().trim().max(100).optional(),
  competitors: z.array(z.string().max(80)).max(3).optional(),
  keywords: z.array(z.string().trim().min(2).max(60)).max(15),
  excludeKeywords: z.array(z.string().trim().min(2).max(60)).max(15),
  hashtags: z.array(z.string().trim().regex(/^[\p{L}\p{N}_]{2,40}$/u)).max(5),
  context: z.string().trim().max(1500),
  sources: z.object({
    googleNews: z.boolean(),
    bingNews: z.boolean(),
    hackerNews: z.boolean(),
    googleSearch: z.boolean(),
    instagram: z.boolean(),
    tiktok: z.boolean(),
  }),
});

async function handleGET() {
  return Response.json({ settings: await store.getSettings() });
}

async function handlePUT(request: Request) {
  const parsed = SettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Ungültige Einstellungen.", issues: parsed.error.issues }, { status: 400 });
  }
  await store.saveSettings(parsed.data);
  return Response.json({ settings: parsed.data });
}

export const GET = (...args: Parameters<typeof handleGET>) => withUser(() => handleGET(...args));
export const PUT = (...args: Parameters<typeof handlePUT>) => withUser(() => handlePUT(...args));
