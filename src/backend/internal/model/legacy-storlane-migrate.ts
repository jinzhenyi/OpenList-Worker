/**
 * 过渡用：一次性把 Storlane 品牌期间写入的存储键迁回 OpenList 键。
 *
 * 背景：项目曾短暂改名为 Storlane，期间用新键写入过配置与密钥槽位
 * （`storlane_config` / `storlane_jwt_secret` / `storlane_encryption_secret`）。
 * 回退到 OpenList 后，代码只认 `openlist_*` 键，若不迁移会读不到既有数据。
 *
 * 行为：目标键已存在则跳过；否则从旧键复制一份（配置同时归一化站点标题与图标）。
 * 幂等、best-effort；数据迁完后本文件及其调用点可整体删除。
 */
import { getStorageBackend } from "./store/backend"

const KEY_MIGRATIONS: Array<{ from: string; to: string }> = [
  { from: "storlane_config", to: "openlist_config" },
  { from: "storlane_jwt_secret", to: "openlist_jwt_secret" },
  { from: "storlane_encryption_secret", to: "openlist_encryption_secret" },
]

const STORLANE_LOGO_URL =
  "https://raw.githubusercontent.com/jinzhenyi/Storlane-Frontend/main/public/logo.svg"
const OPENLIST_LOGO_URL = "https://res.oplist.org/logo/logo.svg"

/** 把配置 JSON 中的 Storlane 品牌默认值改回 OpenList 默认值。 */
function normalizeConfigValue(value: string): string {
  try {
    const db = JSON.parse(value)
    if (db && Array.isArray(db.settings)) {
      for (const s of db.settings) {
        if (!s || typeof s.key !== "string") continue
        if (s.key === "site_title" && (s.value === "Storlane" || s.value === "storlane")) {
          s.value = "OpenList"
        } else if (
          (s.key === "logo" || s.key === "favicon") &&
          s.value === STORLANE_LOGO_URL
        ) {
          s.value = OPENLIST_LOGO_URL
        }
      }
    }
    return JSON.stringify(db)
  } catch {
    return value
  }
}

async function readKey(driver: any, key: string, env: any): Promise<string> {
  const raw = await driver.get(key, env)
  if (raw === null || raw === undefined) return ""
  const resolved =
    raw && typeof raw.text === "function" ? await raw.text() : raw
  if (typeof resolved === "string") return resolved
  if (resolved && typeof resolved === "object") return JSON.stringify(resolved)
  return String(resolved ?? "")
}

let migrated = false

/** 幂等执行迁移；失败则保持未完成状态，下次请求重试。 */
export async function migrateLegacyStorlaneStorage(env: any): Promise<void> {
  if (migrated) return
  try {
    const { driver } = await getStorageBackend(env)
    for (const { from, to } of KEY_MIGRATIONS) {
      try {
        const existing = await readKey(driver, to, env)
        if (existing) continue
        let value = await readKey(driver, from, env)
        if (!value) continue
        if (from === "storlane_config") {
          value = normalizeConfigValue(value)
        }
        await driver.put(to, value, env)
        console.log(`[migrate] storlane -> openlist: ${from} -> ${to}`)
      } catch (err) {
        console.warn(`[migrate] ${from} -> ${to} failed:`, (err as any)?.message || err)
      }
    }
    migrated = true
  } catch (err) {
    console.warn("[migrate] legacy storlane storage migration failed:", (err as any)?.message || err)
  }
}
