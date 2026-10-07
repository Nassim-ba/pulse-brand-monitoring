import "server-only";
import { neon } from "@neondatabase/serverless";
import { DEFAULT_SETTINGS } from "./defaults";
import { brandSlug } from "./filters";
import { currentUserId } from "./context";
import type { Analysis, Mention, MentionStatus, Metrics, RawMention, Settings } from "./types";

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
}

/**
 * Persistence layer. Uses Postgres (Neon) when DATABASE_URL is set, otherwise
 * an in-memory store so the app also runs locally without any setup.
 */

interface BaseStore {
  listMentions(brand: string): Promise<Mention[]>;
  insertMentions(items: RawMention[]): Promise<number>;
  saveAnalysis(id: string, analysis: Analysis): Promise<void>;
  createUser(u: StoredUser): Promise<boolean>; // false when the e-mail is taken
  getUserByEmail(email: string): Promise<StoredUser | null>;
  getUserById(id: string): Promise<StoredUser | null>;
  getStatuses(userId: string, mentionIds: string[]): Promise<Map<string, MentionStatus>>;
  setUserStatus(userId: string, mentionId: string, status: MentionStatus): Promise<void>;
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
      // Pulse only works with real data; remove the synthetic set earlier versions seeded.
      await sql`DELETE FROM mentions WHERE is_demo = true`;
      await sql`CREATE INDEX IF NOT EXISTS mentions_brand_idx ON mentions (brand, published_at DESC)`;
      await sql`CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY,
        email text NOT NULL UNIQUE,
        name text NOT NULL,
        password_hash text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS mention_status (
        user_id text NOT NULL,
        mention_id text NOT NULL,
        status text NOT NULL,
        PRIMARY KEY (user_id, mention_id)
      )`;
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
    analysis: (r.analysis as Analysis) ?? null,
    status: r.status as MentionStatus,
    metrics: (r.metrics as Metrics) ?? null,
  });

  const toUser = (r: Record<string, unknown>): StoredUser => ({
    id: r.id as string,
    email: r.email as string,
    name: r.name as string,
    passwordHash: r.password_hash as string,
    createdAt: new Date(r.created_at as string).toISOString(),
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
          (id, brand, source, source_label, kind, title, content, url, author, published_at, metrics)
          SELECT ${m.id}, ${m.brand}, ${m.source}, ${m.sourceLabel}, ${m.kind}, ${m.title}, ${m.content},
                 ${m.url}, ${m.author}, ${m.publishedAt}, ${m.metrics ? JSON.stringify(m.metrics) : null}::jsonb
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
    async createUser(u) {
      await init();
      const rows = await sql`INSERT INTO users (id, email, name, password_hash, created_at)
        VALUES (${u.id}, ${u.email}, ${u.name}, ${u.passwordHash}, ${u.createdAt})
        ON CONFLICT (email) DO NOTHING RETURNING id`;
      return rows.length > 0;
    },
    async getUserByEmail(email) {
      await init();
      const rows = await sql`SELECT * FROM users WHERE email = ${email}`;
      return rows[0] ? toUser(rows[0]) : null;
    },
    async getUserById(id) {
      await init();
      const rows = await sql`SELECT * FROM users WHERE id = ${id}`;
      return rows[0] ? toUser(rows[0]) : null;
    },
    async getStatuses(userId, mentionIds) {
      await init();
      if (!mentionIds.length) return new Map();
      const rows = await sql`SELECT mention_id, status FROM mention_status WHERE user_id = ${userId} AND mention_id = ANY(${mentionIds})`;
      return new Map(rows.map((r) => [r.mention_id as string, r.status as MentionStatus]));
    },
    async setUserStatus(userId, mentionId, status) {
      await init();
      await sql`INSERT INTO mention_status (user_id, mention_id, status) VALUES (${userId}, ${mentionId}, ${status})
        ON CONFLICT (user_id, mention_id) DO UPDATE SET status = EXCLUDED.status`;
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
  type MemDb = { mentions: Map<string, Mention>; kv: Map<string, unknown>; users?: Map<string, StoredUser>; statuses?: Map<string, MentionStatus> };
  const g = globalThis as unknown as { __pulse?: MemDb };
  const db: MemDb = (g.__pulse ??= { mentions: new Map(), kv: new Map() });
  const users = (db.users ??= new Map());
  const statuses = (db.statuses ??= new Map());

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
    async createUser(u) {
      if ([...users.values()].some((x) => x.email === u.email)) return false;
      users.set(u.id, u);
      return true;
    },
    async getUserByEmail(email) {
      return [...users.values()].find((u) => u.email === email) ?? null;
    },
    async getUserById(id) {
      return users.get(id) ?? null;
    },
    async getStatuses(userId, mentionIds) {
      const out = new Map<string, MentionStatus>();
      for (const id of mentionIds) {
        const st = statuses.get(`${userId}:${id}`);
        if (st) out.set(id, st);
      }
      return out;
    },
    async setUserStatus(userId, mentionId, status) {
      statuses.set(`${userId}:${mentionId}`, status);
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
    ...p,
    ...(!isDefaultBrand && p.domain === DEFAULT_SETTINGS.domain ? { domain: undefined } : {}),
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

/** Per-user key: active brand, brand list and competitors belong to the signed-in user. */
const userKey = (key: string) => {
  const uid = currentUserId();
  return uid ? `u:${uid}:${key}` : key;
};

const DEFAULT_BRANDS: BrandEntry[] = [{ slug: brandSlug(DEFAULT_SETTINGS.brand), name: DEFAULT_SETTINGS.brand }];

/**
 * Hybrid model: mentions, analyses and brand profiles are shared (each brand is
 * searched and analysed once), while everything a person changes is stored
 * per user.
 */
export const store = {
  ...base,
  getProfile,
  /** Mentions of a brand, with the signed-in user's own done/open status. */
  async listMentions(brand: string): Promise<Mention[]> {
    const mentions = await base.listMentions(brand);
    const uid = currentUserId();
    if (!uid) return mentions;
    const own = await base.getStatuses(uid, mentions.map((m) => m.id));
    return mentions.map((m) => ({ ...m, status: own.get(m.id) ?? "open" }));
  },
  async setStatus(mentionId: string, status: MentionStatus): Promise<void> {
    const uid = currentUserId();
    if (!uid) throw new Error("No user in context");
    await base.setUserStatus(uid, mentionId, status);
  },
  async getSettings(): Promise<Settings> {
    const active = (await base.getKv<string>(userKey("activeBrand"))) ?? brandSlug(DEFAULT_SETTINGS.brand);
    return (await getProfile(active)) ?? withDefaults(DEFAULT_SETTINGS);
  },
  /** Saves a (shared) brand profile without changing anyone's active brand. */
  async saveProfile(s: Settings): Promise<void> {
    await base.setKv(`profile:${brandSlug(s.brand)}`, s);
  },
  /** Saves the profile and makes it the signed-in user's active brand. */
  async saveSettings(s: Settings): Promise<void> {
    const slug = brandSlug(s.brand);
    await store.saveProfile(s);
    await base.setKv(userKey("activeBrand"), slug);
    const brands = (await base.getKv<BrandEntry[]>(userKey("brands"))) ?? DEFAULT_BRANDS;
    await base.setKv(userKey("brands"), [{ slug, name: s.brand }, ...brands.filter((b) => b.slug !== slug)].slice(0, 12));
  },
  async listBrands(): Promise<BrandEntry[]> {
    return (await base.getKv<BrandEntry[]>(userKey("brands"))) ?? DEFAULT_BRANDS;
  },
  async getCompetitors(slug: string): Promise<string[]> {
    const own = await base.getKv<string[]>(userKey(`competitors:${slug}`));
    if (own) return own;
    // Before accounts existed, competitors lived in the shared profile.
    return (await getProfile(slug))?.competitors ?? [];
  },
  async setCompetitors(slug: string, list: string[]): Promise<void> {
    await base.setKv(userKey(`competitors:${slug}`), list);
  },
  /** Daily counters per user, to share the budget fairly. */
  userKey,
};
export const storageMode: "postgres" | "memory" = dbUrl ? "postgres" : "memory";
