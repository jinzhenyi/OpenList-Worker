import app from "./index"
import { StorlaneDB } from "./durable-objects/StorlaneDB"

// Durable Object 类（DB_DRIVER=do 时使用），需在 wrangler.toml 声明
// new_sqlite_classes = ["StorlaneDB"] 与对应的 binding。
export { StorlaneDB }

export default {
  fetch: app.fetch,
}
