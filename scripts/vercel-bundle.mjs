/**
 * Vercel 构建后处理：把后端函数入口替换为「自包含的 Node bundle」。
 *
 * 背景：
 *   本项目源码是 ESM + 无扩展名相对导入（TS 风格），而 Vercel 的 @vercel/node
 *   只做逐文件转译、不做打包，产物里的 `import "../src/backend/index"` 这类
 *   无扩展名说明符在 Node ESM 下无法解析，运行时报 ERR_MODULE_NOT_FOUND。
 *
 * 做法：
 *   1. 用 esbuild 以 Node 目标把 api/[...route].ts 打包成单文件（注入
 *      createRequire，避免 CJS 依赖里的 require("crypto") 在 ESM 下失败）；
 *      仅外部化体积大/含原生模块的依赖，它们已由 Vercel 的文件追踪放进
 *      函数的 node_modules。
 *   2. 覆盖 @vercel/node 生成的转译入口。
 *   3. 兜底修正 SPA 回退路由目标为 `/`（见下方注释）。
 *
 * 用法（在 `vercel build --prod` 之后、`vercel deploy --prebuilt` 之前执行）：
 *   node scripts/vercel-bundle.mjs
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import esbuild from "esbuild"

const OUTPUT_ROOT = ".vercel/output"
const FUNCTIONS_DIR = join(OUTPUT_ROOT, "functions")

/** 这些依赖保持外部化：让 Vercel 的文件追踪把它们放进函数目录，避免重复打包。 */
const EXTERNAL = [
  "ssh2",
  "cpu-features",
  "iconv-lite",
  "mysql2",
  "postgres",
  "@vercel/blob",
  "@neondatabase/serverless",
]

/** Vercel 会按路由路径嵌套存放函数目录，例如 functions/api/[...route].func。 */
function findRouteFunction(dir = FUNCTIONS_DIR) {
  if (!existsSync(dir)) return null
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const full = join(dir, entry.name)
    if (entry.name.endsWith(".func")) {
      const configPath = join(full, ".vc-config.json")
      if (!existsSync(configPath)) continue
      const config = JSON.parse(readFileSync(configPath, "utf8"))
      if (String(config.handler || "").includes("[...route]")) {
        return { dir: full, config }
      }
      continue
    }
    const found = findRouteFunction(full)
    if (found) return found
  }
  return null
}

const target = findRouteFunction()
if (!target) {
  console.error(
    "[vercel] 未在 .vercel/output 找到 api/[...route].func；请先执行 `vercel build --prod`",
  )
  process.exit(1)
}

const handlerPath = join(target.dir, target.config.handler)

await esbuild.build({
  entryPoints: ["api/[...route].ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  outfile: handlerPath,
  minify: true,
  format: "esm",
  mainFields: ["module", "main"],
  external: EXTERNAL,
  loader: { ".node": "empty" },
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
  },
})

console.log(`[vercel] 已打包函数入口 -> ${handlerPath}`)

// SPA 回退兜底：cleanUrls 下 /index.html 会被 308 到 /，而 rewrite 的
// `check:true` 会在目标文件判定落空时跳过，导致 /add 等深链 404。
// 统一把 SPA 目标改写为 `/`（vercel.json 已指向 `/`，此处仅作兼容加固）。
const configPath = join(OUTPUT_ROOT, "config.json")
if (existsSync(configPath)) {
  const routing = JSON.parse(readFileSync(configPath, "utf8"))
  let patched = 0
  for (const route of routing.routes || []) {
    if (route.dest === "/index.html") {
      route.dest = "/"
      patched++
    }
  }
  if (patched > 0) {
    writeFileSync(configPath, JSON.stringify(routing, null, 2))
    console.log(`[vercel] 已修正 ${patched} 条 SPA 回退路由 -> /`)
  }
}
