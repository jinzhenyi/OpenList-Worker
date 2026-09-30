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
  - 线上部署：Vercel 项目名 `openlist-tsworker`（projectId `prj_r9Sxfgkd271TC6rh2L6wrEx6w61e`，team/scope `jzy-s-projects`，teamId `team_tHnllturntg1DoEvEJsshWBz`），生产域名 `https://openlist-tsworker.vercel.app`。
  - 部署流程（CLI）：`vercel build --prod` → `node scripts/vercel-bundle.mjs` → `vercel deploy --prebuilt --prod --token "$VERCEL_TOKEN"`。`vercel deploy` 必须显式传 `--token`。
  - Vercel CLI 的 `whoami` / `env ls` / `env pull` 在本 token 下会失败（`User not found.` / `Could not retrieve Project Settings`），但 REST API（`/v9` 或 `/v10/projects/{id}/env?teamId=...`）可用，环境变量应通过 API 管理。
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
- Date: 2026-09-30
- Context: Discovered by Agent while reverting the Storlane rebrand back to OpenList
- Category: Operations & Deployment
- Instructions:
  - 品牌已从 Storlane **回退为 OpenList**：代码/README/多语言/logo/包名/KV 键均恢复（工作树等于品牌化前 `cfd28fe`）。前端构建已切回上游 `OpenListTeam/OpenList-Frontend`（`scripts/fetch-frontend.mjs`，默认取 npm 已发布 dist）。GitHub 仓库已改回 `jinzhenyi/OpenList-Worker`，Vercel 项目名已改回 `openlist-tsworker`。
  - **一次性键迁移已完成**：通过一次临时部署（`legacy-storlane-migrate.ts` 在全局中间件幂等执行）把 `storlane_config` / `storlane_jwt_secret` / `storlane_encryption_secret` 复制到 `openlist_*`，并把配置 JSON 内 `site_title`/`logo`/`favicon` 归一化为 OpenList 默认。迁移验证通过（`db_trusted=true`、`DB_CIPHER=aes-256-gcm` 正常解密），随后已删除该临时文件与调用点。
  - 迁移曾必须早于鉴权：`getJwtSecret` 会在 `openlist_encryption_secret` 缺失时重新生成密钥，若先跑鉴权会覆盖旧加密密钥、导致既有密文无法解密。
  - 回退期间遗留但未清理：前端 fork `jinzhenyi/Storlane-Frontend`（含 `edge` release 的 `i18n.tar.gz`）已不再被构建引用，可保留或删除（删除需用户确认）。
