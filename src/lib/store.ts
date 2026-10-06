import "server-only";
import { neon } from "@neondatabase/serverless";
import { DEFAULT_SETTINGS } from "./defaults";
import type { Analysis, Mention, MentionStatus, RawMention, Settings } from "./types";

/**
 * Persistence layer. Uses Postgres (Neon) when DATABASE_URL is set, otherwise
 * an in-memory store so the app also runs locally without any setup.
 */

interface Store {
  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;
  listMentions(brand: string): Promise<Mention[]>;
  insertMentions(items: RawMention[]): Promise<number>;
  saveAnalysis(id: string, analysis: Analysis): Promise<void>;
  setStatus(id: string, status: MentionStatus): Promise<Mention | null>;
  deleteDemo(brand: string): Promise<void>;
  getKv<T>(key: string): Promise<T | null>;
  setKv<T>(key: string, value: T): Promise<void>;
}

// ---------- Postgres ----------

function createPgStore(url: string): Store {
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
  });

  const store: Store = {
    async getSettings() {
      return { ...DEFAULT_SETTINGS, ...((await store.getKv<Settings>("settings")) ?? {}) };
    },
    async saveSettings(s) {
      await store.setKv("settings", s);
    },
    async listMentions(brand) {
      await init();
      const rows = await sql`SELECT * FROM mentions WHERE brand = ${brand} ORDER BY published_at DESC LIMIT 1000`;
      return rows.map(toMention);
    },
    async insertMentions(items) {
      await init();
      let inserted = 0;
      for (const m of items) {
        const rows = await sql`INSERT INTO mentions
          (id, brand, source, source_label, kind, title, content, url, author, published_at, is_demo)
          VALUES (${m.id}, ${m.brand}, ${m.source}, ${m.sourceLabel}, ${m.kind}, ${m.title}, ${m.content},
                  ${m.url}, ${m.author}, ${m.publishedAt}, ${m.isDemo})
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

function createMemoryStore(): Store {
  const g = globalThis as unknown as {
    __pulse?: { mentions: Map<string, Mention>; kv: Map<string, unknown> };
  };
  const db = (g.__pulse ??= { mentions: new Map(), kv: new Map() });

  return {
    async getSettings() {
      return { ...DEFAULT_SETTINGS, ...((db.kv.get("settings") as Settings) ?? {}) };
    },
    async saveSettings(s) {
      db.kv.set("settings", s);
    },
    async listMentions(brand) {
      return [...db.mentions.values()]
        .filter((m) => m.brand === brand)
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    },
    async insertMentions(items) {
      let inserted = 0;
      for (const m of items) {
        if (db.mentions.has(m.id)) continue;
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

export const store: Store = dbUrl ? createPgStore(dbUrl) : createMemoryStore();
export const storageMode: "postgres" | "memory" = dbUrl ? "postgres" : "memory";
