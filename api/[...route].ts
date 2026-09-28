import { Hono } from "hono"
import { handle } from "hono/vercel"
import backendApp from "../src/backend/index"

const app = new Hono()

// 挂载整个后端 API 应用
app.route("/", backendApp)

// Hobby 默认 ~10s，显式拉到平台上限，避免刷新任务被掐断
export const maxDuration = 60
export const runtime = "nodejs"

// 导出符合 EdgeOne Makers / Edge Functions / Pages 规范的 onRequest 句柄
export async function onRequest(context: any) {
  return app.fetch(context.request, context.env, context)
}

// 导出符合 Vercel 规范的 Serverless 句柄（Node，不要 Edge Runtime）
export const GET = handle(app)
export const POST = handle(app)
export const PUT = handle(app)
export const DELETE = handle(app)
export const PATCH = handle(app)
export const OPTIONS = handle(app)

// 导出 Cloudflare Workers 原生 Fetch 句柄
export default {
  fetch: app.fetch,
}
