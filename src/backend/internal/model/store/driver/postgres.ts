/**
 * Postgres 驱动（Vercel Marketplace Postgres / Neon）。
 *
 * 通过 @neondatabase/serverless 的 HTTP 协议动态加载，适配 Vercel
 * Serverless（无长连接、无原生 TCP）。本地/容器同样可用。
 *
 * 环境变量（任一即可）：
 * - POSTGRES_URL / POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING
 * - DATABASE_URL / DATABASE_URL_UNPOOLED
 * - NEON_DATABASE_URL
 */
import type { Driver } from "../types"
import { buildDdl, getTablePrefix, KV_SCHEMA_POSTGRES } from "../schema"

const URL_KEYS = [
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "NEON_DATABASE_URL",
]

function getPostgresUrl(env?: any): string | null {
  const e = env || (typeof process !== "undefined" ? process.env : {}) || {}
  for (const key of URL_KEYS) {
    const v = String(e[key] || "").trim()
    if (/^postgres(ql)?:\/\//i.test(v)) return v
  }
  return null
}

function toPg(sql: string, params: any[] = []): { sql: string; params: any[] } {
  let i = 0
  const converted = sql.replace(/`/g, '"').replace(/\?/g, () => `$${++i}`)
  return { sql: converted, params }
}

let _sql: any = null
let _sqlKey: string | null = null

async function getSql(env?: any): Promise<any | null> {
  const url = getPostgresUrl(env)
  if (!url) return null
  if (_sql && _sqlKey === url) return _sql

  const specifier = "@neondatabase/serverless"
  const { neon } = await import(specifier)
  _sql = neon(url)
  _sqlKey = url
  return _sql
}

let _schemaInitedPrefix: string | null = null

async function ensureSchema(sql: any, env?: any): Promise<void> {
  const prefix = getTablePrefix(env)
  if (_schemaInitedPrefix === prefix) return
  for (const ddl of [...KV_SCHEMA_POSTGRES, ...buildDdl("postgres", env)]) {
    await sql.query(ddl)
  }
  _schemaInitedPrefix = prefix
}

export function hasPostgresConfig(env?: any): boolean {
  return getPostgresUrl(env) != null
}

export const postgresDriver: Driver = {
  name: "postgres",

  async isAvailable(env?: any): Promise<boolean> {
    if (!getPostgresUrl(env)) return false
    try {
      return (await getSql(env)) != null
    } catch {
      return false
    }
  },

  async init(env?: any): Promise<void> {
    const sql = await getSql(env)
    if (sql) await ensureSchema(sql, env)
  },

  async get(key: string, env?: any): Promise<string | null> {
    const sql = await getSql(env)
    if (!sql) throw new Error("Postgres client not available")
    await ensureSchema(sql, env)
    const rows = await sql.query(
      'SELECT "value" FROM "kv" WHERE "key" = $1',
      [key],
    )
    return rows?.[0]?.value ?? null
  },

  async put(key: string, value: string, env?: any): Promise<void> {
    const sql = await getSql(env)
    if (!sql) throw new Error("Postgres client not available")
    await ensureSchema(sql, env)
    await sql.query(
      'INSERT INTO "kv" ("key", "value") VALUES ($1, $2) ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"',
      [key, value],
    )
  },

  async delete(key: string, env?: any): Promise<void> {
    const sql = await getSql(env)
    if (!sql) throw new Error("Postgres client not available")
    await ensureSchema(sql, env)
    await sql.query('DELETE FROM "kv" WHERE "key" = $1', [key])
  },

  async list(prefix: string, env?: any): Promise<string[]> {
    const sql = await getSql(env)
    if (!sql) throw new Error("Postgres client not available")
    await ensureSchema(sql, env)
    const rows = await sql.query(
      'SELECT "key" FROM "kv" WHERE "key" LIKE $1 ORDER BY "key"',
      [`${prefix}%`],
    )
    return (rows || []).map((r: any) => r.key)
  },

  async query(sqlText: string, params: any[], env?: any): Promise<any[]> {
    const sql = await getSql(env)
    if (!sql) throw new Error("Postgres client not available")
    await ensureSchema(sql, env)
    const q = toPg(sqlText, params)
    return (await sql.query(q.sql, q.params)) || []
  },

  async execute(sqlText: string, params: any[], env?: any): Promise<void> {
    const sql = await getSql(env)
    if (!sql) throw new Error("Postgres client not available")
    await ensureSchema(sql, env)
    const q = toPg(sqlText, params)
    await sql.query(q.sql, q.params)
  },

  async batch(
    statements: Array<{ sql: string; params: any[] }>,
    env?: any,
  ): Promise<void> {
    const sql = await getSql(env)
    if (!sql) throw new Error("Postgres client not available")
    await ensureSchema(sql, env)
    const queries = statements.map((stmt) => {
      const q = toPg(stmt.sql, stmt.params)
      return sql.query(q.sql, q.params)
    })
    if (typeof sql.transaction === "function") {
      await sql.transaction(queries)
      return
    }
    for (const q of queries) await q
  },

  async health(env?: any): Promise<any> {
    const url = getPostgresUrl(env)
    if (!url) {
      return {
        configured: false,
        connected: false,
        platform: "Postgres (neon)",
        mode: "postgres",
        error:
          "Postgres URL not found (expected POSTGRES_URL, DATABASE_URL, or NEON_DATABASE_URL)",
      }
    }

    try {
      const sql = await getSql(env)
      await sql.query("SELECT 1")
      return {
        configured: true,
        connected: true,
        platform: "Postgres (neon)",
        mode: "postgres",
      }
    } catch (err: any) {
      return {
        configured: true,
        connected: false,
        platform: "Postgres (neon)",
        mode: "postgres",
        error: err?.message || String(err),
      }
    }
  },
}
