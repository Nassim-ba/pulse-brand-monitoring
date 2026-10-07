import "server-only";
import { neon } from "@neondatabase/serverless";
import { DEFAULT_SETTINGS } from "./defaults";
import { brandSlug } from "./filters";
import type { Analysis, Mention, MentionStatus, Metrics, RawMention, Settings } from "./types";

/**
 * Persistence layer. Uses Postgres (Neon) when DATABASE_URL is set, otherwise
 * an in-memory store so the app also runs locally without any setup.
 */

interface BaseStore {
  listMentions(brand: string): Promise<Mention[]>;
  insertMentions(items: RawMention[]): Promise<number>;
  saveAnalysis(id: string, analysis: Analysis): Promise<void>;
  setStatus(id: string, status: MentionStatus): Promise<Mention | null>;
  deleteDemo(brand: string): Promise<void>;
  getKv<T>(key: string): Promise<T | null>;
  setKv<T>(key: string, value: T): Promise<void>;
}

// ---------- Postgres ----------

function createPgStore(url: string): BaseStore {
  const sql = neon(url);
  let ready: Promise<unknown> | null = null;

  const init = () =>
    (ready ??= (async () => {
      await sql`CREATE TABLE IF NOT EXISTS mentions (
        id text PRIMARY KEY,
        brand text NOT NULL,
        source text NOT NULL,
        source_label text NOT NULL,
        kind text NOT NULL,
        title text NOT NULL,
        content text NOT NULL,
        url text NOT NULL,
        author text,
        published_at timestamptz NOT NULL,
        fetched_at timestamptz NOT NULL DEFAULT now(),
        is_demo boolean NOT NULL DEFAULT false,
        analysis jsonb,
        status text NOT NULL DEFAULT 'open'
      )`;
      await sql`ALTER TABLE mentions ADD COLUMN IF NOT EXISTS metrics jsonb`;
      await sql`CREATE INDEX IF NOT EXISTS mentions_brand_idx ON mentions (brand, published_at DESC)`;
      await sql`CREATE TABLE IF NOT EXISTS kv (
        key text PRIMARY KEY,
        value jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
    })());

  const toMention = (r: Record<string, unknown>): Mention => ({
    id: r.id as string,
    brand: r.brand as string,
    source: r.source as string,
    sourceLabel: r.source_label as string,
    kind: r.kind as Mention["kind"],
    title: r.title as string,
    content: r.content as string,
    url: r.url as string,
    author: (r.author as string) ?? null,
    publishedAt: new Date(r.published_at as string).toISOString(),
    fetchedAt: new Date(r.fetched_at as string).toISOString(),
    isDemo: r.is_demo as boolean,
    analysis: (r.analysis as Analysis) ?? null,
    status: r.status as MentionStatus,
    metrics: (r.metrics as Metrics) ?? null,
  });

  const store: BaseStore = {
    async listMentions(brand) {
      await init();
      const rows = await sql`SELECT * FROM mentions WHERE brand = ${brand} ORDER BY published_at DESC LIMIT 1000`;
      return rows.map(toMention);
    },
    async insertMentions(items) {
      await init();
      let inserted = 0;
      for (const m of items) {
        // Skip duplicates by id and by URL within the same brand.
        const rows = await sql`INSERT INTO mentions
          (id, brand, source, source_label, kind, title, content, url, author, published_at, is_demo, metrics)
          SELECT ${m.id}, ${m.brand}, ${m.source}, ${m.sourceLabel}, ${m.kind}, ${m.title}, ${m.content},
                 ${m.url}, ${m.author}, ${m.publishedAt}, ${m.isDemo}, ${m.metrics ? JSON.stringify(m.metrics) : null}::jsonb
          WHERE NOT EXISTS (SELECT 1 FROM mentions WHERE brand = ${m.brand} AND url = ${m.url})
          ON CONFLICT (id) DO NOTHING RETURNING id`;
        inserted += rows.length;
      }
      return inserted;
    },
    async saveAnalysis(id, analysis) {
      await init();
      await sql`UPDATE mentions SET analysis = ${JSON.stringify(analysis)}::jsonb WHERE id = ${id}`;
    },
    async setStatus(id, status) {
      await init();
      const rows = await sql`UPDATE mentions SET status = ${status} WHERE id = ${id} RETURNING *`;
      return rows[0] ? toMention(rows[0]) : null;
    },
    async deleteDemo(brand) {
      await init();
      await sql`DELETE FROM mentions WHERE brand = ${brand} AND is_demo = true`;
    },
    async getKv<T>(key: string) {
      await init();
      const rows = await sql`SELECT value FROM kv WHERE key = ${key}`;
      return rows[0] ? (rows[0].value as T) : null;
    },
    async setKv<T>(key: string, value: T) {
      await init();
      await sql`INSERT INTO kv (key, value, updated_at) VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
    },
  };
  return store;
}

// ---------- In-memory ----------

function createMemoryStore(): BaseStore {
  const g = globalThis as unknown as {
    __pulse?: { mentions: Map<string, Mention>; kv: Map<string, unknown> };
  };
  const db = (g.__pulse ??= { mentions: new Map(), kv: new Map() });

  return {
    async listMentions(brand) {
      return [...db.mentions.values()]
        .filter((m) => m.brand === brand)
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    },
    async insertMentions(items) {
      let inserted = 0;
      for (const m of items) {
        if (db.mentions.has(m.id) || [...db.mentions.values()].some((x) => x.brand === m.brand && x.url === m.url)) continue;
        db.mentions.set(m.id, { ...m, fetchedAt: new Date().toISOString(), analysis: null, status: "open" });
        inserted++;
      }
      return inserted;
    },
    async saveAnalysis(id, analysis) {
      const m = db.mentions.get(id);
      if (m) m.analysis = analysis;
    },
    async setStatus(id, status) {
      const m = db.mentions.get(id);
      if (!m) return null;
      m.status = status;
      return m;
    },
    async deleteDemo(brand) {
      for (const [id, m] of db.mentions) if (m.brand === brand && m.isDemo) db.mentions.delete(id);
    },
    async getKv<T>(key: string) {
      return (db.kv.get(key) as T) ?? null;
    },
    async setKv<T>(key: string, value: T) {
      db.kv.set(key, value);
    },
  };
}

const dbUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

const base: BaseStore = dbUrl ? createPgStore(dbUrl) : createMemoryStore();

// ---------- Brand profiles (shared by both backends) ----------

function withDefaults(p: Partial<Settings>): Settings {
  const isDefaultBrand = !p.brand || brandSlug(p.brand) === brandSlug(DEFAULT_SETTINGS.brand);
  return {
    ...DEFAULT_SETTINGS,
    // Brand-specific defaults must not leak into other brands' profiles.
    domain: isDefaultBrand ? DEFAULT_SETTINGS.domain : undefined,
    demoData: isDefaultBrand ? DEFAULT_SETTINGS.demoData : false,
    ...p,
    hashtags: p.hashtags ?? (p.brand && p.brand !== DEFAULT_SETTINGS.brand ? [p.brand.toLowerCase().replace(/[^a-z0-9]/g, "")] : DEFAULT_SETTINGS.hashtags),
    sources: { ...DEFAULT_SETTINGS.sources, ...(p.sources ?? {}) },
  };
}

export interface BrandEntry {
  slug: string;
  name: string;
}

async function getProfile(slug: string): Promise<Settings | null> {
  const p = await base.getKv<Settings>(`profile:${slug}`);
  if (p) return withDefaults(p);
  if (slug === brandSlug(DEFAULT_SETTINGS.brand)) {
    // Pre-profile installations stored a single "settings" record.
    const legacy = await base.getKv<Settings>("settings");
    return withDefaults(legacy && brandSlug(legacy.brand) === slug ? legacy : DEFAULT_SETTINGS);
  }
  return null;
}

export const store = {
  ...base,
  getProfile,
  async getSettings(): Promise<Settings> {
    const active = (await base.getKv<string>("activeBrand")) ?? brandSlug(DEFAULT_SETTINGS.brand);
    return (await getProfile(active)) ?? withDefaults(DEFAULT_SETTINGS);
  },
  /** Saves the profile and makes it the active brand. */
  async saveSettings(s: Settings): Promise<void> {
    const slug = brandSlug(s.brand);
    await base.setKv(`profile:${slug}`, s);
    await base.setKv("activeBrand", slug);
    const brands = (await base.getKv<BrandEntry[]>("brands")) ?? [{ slug: brandSlug(DEFAULT_SETTINGS.brand), name: DEFAULT_SETTINGS.brand }];
    await base.setKv("brands", [{ slug, name: s.brand }, ...brands.filter((b) => b.slug !== slug)].slice(0, 12));
  },
  async listBrands(): Promise<BrandEntry[]> {
    return (await base.getKv<BrandEntry[]>("brands")) ?? [{ slug: brandSlug(DEFAULT_SETTINGS.brand), name: DEFAULT_SETTINGS.brand }];
  },
};
export const storageMode: "postgres" | "memory" = dbUrl ? "postgres" : "memory";
