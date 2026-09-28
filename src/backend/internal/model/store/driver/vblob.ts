/**
 * Vercel Blob 驱动（Hobby 可用）。
 *
 * 通过 @vercel/blob 动态加载，避免打进 Cloudflare / EdgeOne / ESA 产物。
 *
 * 环境变量：
 * - BLOB_READ_WRITE_TOKEN（连接 Blob 商店后由 Vercel 注入）
 * - VERCEL_BLOB_READ_WRITE_TOKEN（别名）
 */
import type { Driver } from "../types"

function readToken(env?: any): string {
  const e = env || (typeof process !== "undefined" ? process.env : {}) || {}
  return String(
    e.BLOB_READ_WRITE_TOKEN || e.VERCEL_BLOB_READ_WRITE_TOKEN || "",
  ).trim()
}

function blobOpts(env?: any): { token: string } {
  return { token: readToken(env) }
}

async function loadSdk(): Promise<any | null> {
  try {
    const specifier = "@vercel/blob"
    return await import(specifier)
  } catch {
    return null
  }
}

async function readBody(body: any): Promise<string> {
  if (body == null) return ""
  if (typeof body === "string") return body
  if (typeof body.text === "function") return await body.text()
  if (typeof body.getReader === "function") {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let out = ""
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      out += decoder.decode(value, { stream: true })
    }
    return out + decoder.decode()
  }
  if (typeof Buffer !== "undefined" && Buffer.isBuffer?.(body)) {
    return body.toString("utf8")
  }
  return String(body)
}

export const vblobDriver: Driver = {
  name: "vblob",

  async isAvailable(env?: any): Promise<boolean> {
    if (!readToken(env)) return false
    return (await loadSdk()) != null
  },

  async init(_env?: any): Promise<void> {},

  async get(key: string, env?: any): Promise<string | null> {
    const sdk = await loadSdk()
    if (!sdk) throw new Error("Vercel Blob SDK not available")
    const opts = blobOpts(env)
    if (!opts.token) throw new Error("BLOB_READ_WRITE_TOKEN is not set")

    try {
      if (typeof sdk.get === "function") {
        const result = await sdk.get(key, {
          access: "private",
          useCache: false,
          ...opts,
        })
        if (!result) return null
        if (result.statusCode === 404) return null
        if (result.stream) return await readBody(result.stream)
        if (typeof result === "string") return result
      }

      const meta = await sdk.head(key, opts)
      if (!meta) return null
      const url = meta.downloadUrl || meta.url
      if (!url) return null
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${opts.token}` },
      })
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`vblob get failed: ${res.status}`)
      return await res.text()
    } catch (err: any) {
      const msg = String(err?.message || err)
      if (/404|not found|does not exist/i.test(msg)) return null
      console.warn(`[vblob] get key="${key}" failed:`, err)
      return null
    }
  },

  async put(key: string, value: string, env?: any): Promise<void> {
    const sdk = await loadSdk()
    if (!sdk) throw new Error("Vercel Blob SDK not available")
    const opts = blobOpts(env)
    if (!opts.token) throw new Error("BLOB_READ_WRITE_TOKEN is not set")

    await sdk.put(key, value, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json; charset=utf-8",
      ...opts,
    })
  },

  async delete(key: string, env?: any): Promise<void> {
    const sdk = await loadSdk()
    if (!sdk) throw new Error("Vercel Blob SDK not available")
    const opts = blobOpts(env)
    if (!opts.token) throw new Error("BLOB_READ_WRITE_TOKEN is not set")
    await sdk.del(key, opts)
  },

  async list(prefix: string, env?: any): Promise<string[]> {
    const sdk = await loadSdk()
    if (!sdk) throw new Error("Vercel Blob SDK not available")
    const opts = blobOpts(env)
    if (!opts.token) throw new Error("BLOB_READ_WRITE_TOKEN is not set")

    const keys: string[] = []
    let cursor: string | undefined
    do {
      const result = await sdk.list({
        prefix,
        cursor,
        limit: 1000,
        ...opts,
      })
      for (const b of result?.blobs || []) {
        if (b?.pathname) keys.push(b.pathname)
      }
      cursor = result?.hasMore ? result.cursor : undefined
    } while (cursor)

    return keys
  },

  async health(env?: any): Promise<any> {
    const token = readToken(env)
    if (!token) {
      return {
        configured: false,
        connected: false,
        platform: "Vercel Blob",
        mode: "vblob",
        error: "BLOB_READ_WRITE_TOKEN is not set",
      }
    }

    const sdk = await loadSdk()
    if (!sdk) {
      return {
        configured: true,
        connected: false,
        platform: "Vercel Blob",
        mode: "vblob",
        error: "Vercel Blob SDK not available",
      }
    }

    try {
      await sdk.list({ prefix: "__health_check__", limit: 1, token })
      return {
        configured: true,
        connected: true,
        platform: "Vercel Blob",
        mode: "vblob",
      }
    } catch (err: any) {
      return {
        configured: true,
        connected: false,
        platform: "Vercel Blob",
        mode: "vblob",
        error: err?.message || String(err),
      }
    }
  },
}
