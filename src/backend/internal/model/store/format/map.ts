/**
 * Map 格式适配器
 * 
 * 将整个数据对象序列化为单个 JSON 字符串，存储在单个键中。
 * 适用于 KV/Blob 等简单存储系统。
 * 
 * 存储格式：
 * - key: "storlane_config"
 * - value: JSON.stringify(data)
 */
import type { FormatAdapter, Driver } from "../types"

const CONFIG_KEY = "storlane_config"
/** 旧品牌（OpenList 时代）的配置键：仅用于兼容读取，保存时迁移到新键。 */
const LEGACY_CONFIG_KEY = "openlist_config"

export const mapFormat: FormatAdapter = {
  name: "map",

  async load(driver: Driver, env?: any): Promise<any | null> {
    let raw = await driver.get(CONFIG_KEY, env)
    // 改名兼容：新键为空时回退旧键，避免既有部署被判定为未初始化。
    if (!raw) raw = await driver.get(LEGACY_CONFIG_KEY, env)
    if (!raw) return null

    try {
      return JSON.parse(raw)
    } catch (err) {
      console.error("[mapFormat] Failed to parse JSON:", err)
      return null
    }
  },

  async save(data: any, driver: Driver, env?: any): Promise<boolean> {
    const raw = JSON.stringify(data)
    await driver.put(CONFIG_KEY, raw, env)
    return true
  },
}
