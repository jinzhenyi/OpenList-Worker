# User Instruction Memory

This file records user instructions, preferences, and project knowledge for reference in future interactions.

## Format

### User Instruction Entry
[User Instruction Summary]
- Date: [YYYY-MM-DD]
- Context: [Mentioned scenario or time]
- Instructions:
  - [Content of user teaching or instruction, described line by line]

### Project Knowledge Entry
[Project Knowledge Summary]
- Date: [YYYY-MM-DD]
- Context: Discovered by Agent while performing [specific task description]
- Category: [Operations & Deployment|Build Methods|Testing Methods|Troubleshooting & Debugging|Workflow & Collaboration|Environment Configuration]
- Instructions:
  - [Specific knowledge points, described line by line]

## Deduplication Strategy
- Before adding a new entry, check for similar or identical instructions.
- If a duplicate is found, skip the new entry or merge it with the existing one.
- When merging, update the context or date information.

## Entries

[Project Knowledge Summary]
- Date: 2026-09-28
- Context: Discovered by Agent while deploying to Vercel and diagnosing storage/health issues
- Category: Operations & Deployment
- Instructions:
  - 线上部署：Vercel 项目已按品牌改名为 **`storlane`**（projectId `prj_r9Sxfgkd271TC6rh2L6wrEx6w61e`，scope `jzy-s-projects`，teamId `team_tHnllturntg1DoEvEJsshWBz`）；生产别名 `https://op.899669.xyz`，部署域名形如 `storlane-<hash>-jzy-s-projects.vercel.app`。仓库 `jinzhenyi/Storlane`。
  - 部署流程（CLI）：`vercel build --prod --token "$VERCEL_TOKEN"` → `node scripts/vercel-bundle.mjs` → `vercel deploy --prebuilt --prod --token "$VERCEL_TOKEN"`。`vercel deploy` 必须显式传 `--token`。**加速重部署**：若仅改后端，已有 `dist/` 前端产物可复用，先把 `dist` 拷到临时目录，再 `export FRONTEND_DIST=<该目录>` 后执行 `vercel build`（fetch-frontend 命中 `FRONTEND_DIST` 分支，跳过克隆/安装前端，约 18s 完成）。注意 `FRONTEND_DIST` 不能指向 `dist` 本身（`replaceDist` 会先 `rmSync(DEST)` 再复制，自指会丢产物）。
  - 后台终端 shell 是 `sh`，没有 `source`，加载 token 用 `. /tmp/opencode/vercel.env`。
  - 构建流水线验证：`pnpm build`（=fetch-frontend + build-edge）中 fetch-frontend 会先查 npm `@storlane-frontend/storlane-frontend`（未发布，404），自动回退克隆 `jinzhenyi/Storlane-Frontend` 并 `npx -y pnpm@11.25.0` 构建，`stampFrontendVersion` 戳入 `4.2.6`；i18n 包因 fork 无 `edge` release 拉取失败，构建产物仅英文（回退 English）。`vercel build` 后必须跑 `scripts/vercel-bundle.mjs` 修复 API 入口 ESM 无扩展名导入，否则函数运行时报 `ERR_MODULE_NOT_FOUND`。
  - 该 fork 的 `.github/workflows/*` 保持上游原样：当前 GitHub PAT 无 `workflow` scope，推送含 workflow 改动的提交会被拒绝（`refusing to allow a Personal Access Token to create or update workflow`）。
  - Vercel 运维凭据：token 存 `/tmp/opencode/vercel.env`（`VERCEL_TOKEN`，chmod 600）。新 token 下 `GET /v2/user`、`GET /v2/teams`、`GET /v2/teams/{id}` 会失败（`User not found.` / `You are not authorized`），但**带 `teamId=$TEAM` 的项目级 REST 调用正常**（列项目、改项目名、部署都可用）。
  - 品牌默认值迁移（`LEGACY_SETTING_MIGRATIONS`）已覆盖：`site_title`（`OpenList`/`AList`/`Alist`/`openlist`/`alist` → `Storlane`，仅当值等于旧默认时才迁移）、`logo`/`favicon` → 自有 logo。线上实例已确认 `site_title` 由 `OpenList` 迁移为 `Storlane`。
  - 运行时有效配置可用 `GET /api/public/env_check` 反推；当前为 `DB_DRIVER=vblob`（Vercel Blob，`DB_FORMAT=map`）、`DB_CIPHER=aes-256-gcm`、`CRON_SECRET`（Cron 鉴权，未带 Bearer 访问 `/api/task/refresh` 返回 401）。
  - 配置项 `DB_CIPHER` 的加密密钥由 `JWT_SECRET` 派生：启用加密后**不可更换 `JWT_SECRET`**，否则已加密字段无法解密；如需更换须先设 `DB_CIPHER=none` 并保存一次完成明文迁移。
  - `DB_DRIVER` / `DB_FORMAT` / `JWT_SECRET` 未显式提供时会取默认值（`auto` / `map` / `无`），`env_check` 的 `db_driver` 字段显示的是配置值（默认 `auto`），据此可判断某变量是否被显式设置。

[Project Knowledge Summary]
- Date: 2026-09-28
- Context: Discovered by Agent while testing the deployed site from this sandbox
- Category: Troubleshooting & Debugging
- Instructions:
  - 本沙箱对 `*.vercel.app` 的 DNS 会被污染，解析到非 Vercel IP（如 `111.243.214.169`）导致 TLS 失败（`home=000`）。复测线上须绕过本地 DNS：先经 DoH（`https://cloudflare-dns.com/dns-query`）取真实 A 记录（如 `216.198.79.131` / `64.29.17.131`），再用 `curl --resolve openlist-tsworker.vercel.app:443:<ip> ...`。注意 zsh 不会对未加引号的变量做分词，`--resolve` 需内联或存数组。
  - 无鉴权 `POST /api/fs/list` 返回 `401 Unauthorized` 时，通常表示库中的 `guest` 用户被禁用（`getUserFromContext` 的 guest 回退要求 guest 存在且未禁用），与 `DB_CIPHER` 等配置无关。

[Project Knowledge Summary]
- Date: 2026-09-29
- Context: Discovered by Agent while rebranding the project from OpenList to an independent service named Storlane
- Category: Workflow & Collaboration
- Instructions:
  - 项目已从 OpenList 品牌改名独立为 **Storlane**：包名 `storlane`、仓库 `jinzhenyi/Storlane`、前端仓库 `jinzhenyi/Storlane-Frontend`、KV 配置键 `storlane_config`、密钥槽位 `storlane_jwt_secret` / `storlane_encryption_secret`、DO 类 `StorlaneDB`、错误类 `StorlaneError`。
  - **上游血缘（勿混淆 Go / JS 两版）**：直接上游是 JS/TS 版 **[OpenListTeam/OpenList-Worker](https://github.com/OpenListTeam/OpenList-Worker)**（本仓库 fork 自它）；**[OpenListTeam/OpenList](https://github.com/OpenListTeam/OpenList)** 是 Go 版、OpenList-Worker 的祖源；`Alist` 为最上游。本地远程布局：`origin` 与 `upstream` 均指向 `OpenListTeam/OpenList-Worker`，`jinzhenyi` 指向自有仓库 `jinzhenyi/Storlane`。README 与 `readmes/*.md` 的“上游项目”“贡献列表”按此更正。
  - **旧键读兼容、写新键（自动迁移）**：`storlane_config` 回退 `openlist_config`（map/key/sql 三种格式各自处理，含 `schema_info` 的初始化标记）、JWT/加密密钥槽位回退旧名、D1 绑定新增 `STORLANE_DB` 别名并保留 `OPENLIST_DB`。
  - **禁止改名的硬兼容项（改了就破坏既有数据/协议）**：`src/backend/pkg/crypto.ts` 中的 KDF info/salt 字符串（`openlist-config-encryption-*`、`openlist-db-cipher-*`）；种子格式 `SEED_FORMAT="openlist-sharing-seed"` 与 bencode 键 `x-openlist`；挂载驱动 id `openlist` / `openlist_share`（`DriverOpenlist*`、`ClientOpenlist*`、`OpenListShare`）；种子来源类型 `openlist-share` / `openlist-direct`；为通过第三方网盘校验而伪装的 UA（如 `... OpenList/425.6.30`、`... openlist-client`）。
  - 品牌相关的第三方常量：`api.oplist.org`（百度/夸克等驱动的在线刷新 API）与 `doc.oplist.org`（上游文档链接）为上游真实服务/文档，保留。
  - 前端构建脚本 `scripts/fetch-frontend.mjs` 已指向 fork `jinzhenyi/Storlane-Frontend`；构建期 `stampFrontendVersion` 的包名匹配放宽为 `/(storlane-frontend|openlist-frontend)/i` 以兼容新旧产物。
  - 前端 fork 改名要点：全局配置全局量 `window.OPENLIST_CONFIG` → `window.STORLANE_CONFIG`；构建环境变量 `OPENLIST_FRONTEND_BUILD_*` → `STORLANE_FRONTEND_BUILD_*`；产物名 `openlist-frontend-dist-*` → `storlane-frontend-dist-*`；repo 内新增自绘 `public/logo.svg` 并替换 `res.oplist.org` 引用。前端 **必须保留** 的兼容标识：驱动 id `OpenList` / `OpenListShare`、API 参数 `openlist_ts`、插件清单 `openlist-plugin.json`、全局 `window.OpenListPlugin`、GitHub 依赖 `OpenListTeam/hope-ui` 与 `OpenListTeam/mpegts.js`（含 `pnpm-workspace.yaml` 的 codeload 引用）。
  - 后端品牌 logo 统一为自有资源 `https://raw.githubusercontent.com/jinzhenyi/Storlane-Frontend/main/public/logo.svg`（`src/backend/server/assets.ts` 的 LOGO_URL、`public.ts` 默认 settings、`db.ts` 的 LEGACY_SETTING_MIGRATIONS 迁移目标）；`assets_route.test.ts` 已同步该断言。
  - `scripts/fetch-frontend.mjs` 默认顺序：优先 npm 已发布 dist（`@storlane-frontend/storlane-frontend`），未发布（404 / 无 dist-tags）时自动回退克隆 `FRONTEND_GIT_URL`（默认 fork）现构建；`FRONTEND_BUILD_FROM_SOURCE=1` 可强制现构建。
  - 该 fork 的 `.github/workflows/*` 保持上游原样：当前 GitHub PAT 无 `workflow` scope，推送含 workflow 改动的提交会被拒绝（`refusing to allow a Personal Access Token to create or update workflow`）。
  - Vercel 运维凭据：原存在 `/tmp/opencode/vercel.env` 的 token 已失效（REST `/v2/user` 返回 `User not found.`，所有带 `teamId` 的请求返回 `not authorized ... scope "jzy-s-projects"`）；需用户提供新 token 或 dashboard 手动改项目名后才能继续 Vercel 侧改名/重新部署。
