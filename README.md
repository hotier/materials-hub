# 产出导航站 (Material Hub)

轻量产出管理平台，**Hono + Cloudflare Pages + R2 + Workers KV**。

## 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 框架 | **Hono** v4 | 专为 CF Workers/Pages 设计的轻量框架 |
| 类型 | TypeScript | 全栈类型安全 |
| 静态托管 | Cloudflare Pages | HTML/CSS/JS 直接分发 |
| API | Pages Functions (Hono) | 统一路由，中间件复用 |
| 文件存储 | Cloudflare R2（绑定名 `R2`） | HTML/Office 等产出文件，10GB 免费 |
| 元数据 | Workers KV（绑定名 `KV`） | 单键存储产出清单 JSON |
| 预览 | Flyfish 文件查看器 | `file-viewer/` 内联预览，支持 Office/PDF/图片等 |

## 目录结构

```
material-hub/
├── package.json
├── tsconfig.json
├── wrangler.toml
├── index.html                  # 导航首页（列表 + 编辑/删除/预览）
├── upload.html                 # 上传面板
├── preview.html                # 新窗口预览页（Flyfish 查看器）
├── login.html                  # 登录页
├── static/
│   ├── style.css
│   └── app.js
├── functions/
│   └── [[path]].ts             # 🔑 Hono 主入口（唯一函数入口）
├── src/
│   ├── types.ts                # 共享类型 & Cloudflare 绑定（R2 / KV）
│   ├── helpers.ts              # KV 读写、错误响应、文件类型白名单
│   ├── middleware/
│   │   ├── auth.ts             # Cookie Session 校验中间件（LOGIN_TOKEN）
│   │   └── sync-auth.ts        # Bearer Token 校验中间件（SYNC_TOKEN）
│   └── api/
│       ├── list.ts             # GET    /api/list
│       ├── upload.ts           # POST   /api/upload
│       ├── preview.ts          # GET    /api/preview?id=xxx
│       ├── raw.ts              # GET    /api/raw?id=xxx（原始文件流）
│       ├── item.ts             # PUT/DELETE /api/item?id=xxx（编辑/删除）
│       ├── login.ts            # POST   /api/login
│       ├── logout.ts           # POST   /api/logout
│       ├── session.ts          # GET    /api/session（受保护，校验登录态）
│       ├── auth-status.ts      # GET    /api/auth-status（是否启用认证）
│       └── sync.ts             # POST   /api/sync（Bearer Token 同步接口）
├── file-viewer/                # Flyfish 文件查看器（vendor 资源，随仓库发布）
└── .github/workflows/deploy.yml # GitHub Actions 自动部署
```

## 架构亮点

| 旧方案（5 个 JS 文件） | 新方案（Hono） |
|---|---|
| 每个文件手写 CORS | 全局 `cors()` 一行 |
| 每个文件手写 try-catch | `app.onError()` 统一兜底 |
| 密码校验粘贴 2 次 | `authGuard` / `syncAuth` 中间件一处复用 |
| 无类型，API 靠猜 | TypeScript + `Env` 绑定全类型 |
| 无 HMR | `wrangler pages dev --live-reload` |

## 功能说明

- **编辑**：在首页列表项可打开编辑弹窗，修改名称、描述、标签（文件后缀只读展示）。
- **预览**：支持内联预览（Flyfish 查看器）与新窗口预览两种模式。
- **文件类型**：支持图片、PDF、Office（doc/docx/xls/xlsx/ppt/pptx/visio 等）、OpenDocument 及常见文本/代码格式。
- **认证**：
  - 仅当配置了 `LOGIN_TOKEN` 才启用登录，登录后签发 httpOnly `session` Cookie（7 天内活跃自动续期）。
  - `/api/sync` 使用 `SYNC_TOKEN` 做 Bearer 认证，供自动化/WorkBuddy 同步使用。
  - 未配置任何密码则无需认证可直接访问与上传。

## 命令行上传/删除 API

### POST /api/sync（上传）

**请求头**

| 头 | 必填 | 说明 |
|---|---|---|
| `Authorization: Bearer <SYNC_TOKEN>` | ✅ | Bearer Token 认证 |
| `Content-Type: multipart/form-data` | ✅ | curl 加 `-F` 自动设置 |

**请求体（multipart/form-data）**

| 字段 | 必填 | 说明 |
|---|---|---|
| `file` | ✅ | 上传的文件 |
| `name` | ❌ | 产出名称，最大 60 字符；不填则取文件名 |
| `desc` | ❌ | 描述，最大 200 字符 |
| `tags` | ❌ | 标签，逗号分隔，如 `env,character` |

**支持格式**：`html, htm, jpg, jpeg, png, gif, svg, webp, bmp, ico, json, txt, md, csv, xml, css, js, ts, yaml, yml, log, sql, pdf, doc, docx, docm, dotx, dotm, rtf, xls, xlsx, xlsm, xltx, xlsb, ppt, pptx, pptm, potx, ppsx, vsd, vsdx, pub, odt, ods, odp, odg`

**限制**：单文件最大 10 MB

**成功响应（200）**

```json
{
  "success": true,
  "item": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "首页设计稿",
    "desc": "2026年7月首页改版",
    "tags": ["env", "ui"],
    "ext": "png",
    "R2Key": "output/2026/07/30/a1b2c3d4-...-design.png",
    "createTime": "2026-07-30"
  },
  "previewUrl": "https://your-domain.pages.dev/preview?id=a1b2c3d4-..."
}
```

**错误响应**

```json
// 400 — 参数缺失或文件不合法
{ "error": "缺少必要参数：file" }
{ "error": "不支持的文件格式，允许：html, htm, ..." }
{ "error": "文件大小不能超过 10MB" }
```

**curl 示例**

```bash
# 完整参数
curl -X POST https://your-domain.pages.dev/api/sync \
  -H "Authorization: Bearer your-sync-token" \
  -F "file=@/path/to/screenshot.png" \
  -F "name=首页设计稿" \
  -F "desc=2026年7月首页改版" \
  -F "tags=env,ui"

# 最小参数（仅 file）
curl -X POST https://your-domain.pages.dev/api/sync \
  -H "Authorization: Bearer your-sync-token" \
  -F "file=@screenshot.png"
```

### DELETE /api/sync（删除）

**请求头**

| 头 | 必填 | 说明 |
|---|---|---|
| `Authorization: Bearer <SYNC_TOKEN>` | ✅ | Bearer Token 认证 |

**请求参数（Query String）**

| 参数 | 必填 | 说明 |
|---|---|---|
| `id` | ✅ | 产出 ID，来自上传响应中的 `item.id` |

**成功响应（200）**

```json
{ "success": true, "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }
```

**curl 示例**

```bash
curl -X DELETE "https://your-domain.pages.dev/api/sync?id=a1b2c3d4-..." \
  -H "Authorization: Bearer your-sync-token"
```

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器（HMR 热重载）
npm run dev
# → http://localhost:8787

# 类型检查
npm run typecheck
```

本地开发如需设置密码，编辑 `.dev.vars`：

```
LOGIN_TOKEN=你的登录密码
SYNC_TOKEN=你的同步令牌
```

## 部署

### 方式 A：本地手动部署

#### 1. 在 Cloudflare 创建资源

- **R2 存储桶**：名称 `material-hub`（可自定义，与 `wrangler.toml` 中 `bucket_name` 一致）
- **Workers KV 命名空间**：记录其命名空间 ID

#### 2. 修改 `wrangler.toml`

```toml
[[r2_buckets]]
binding = "R2"
bucket_name = "material-hub"

[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"
```

#### 3. 设置密钥（如启用认证）

```bash
npx wrangler secret put LOGIN_TOKEN   # 网页登录密码
npx wrangler secret put SYNC_TOKEN    # 同步接口令牌
```

#### 4. 部署

```bash
npm run deploy
# 或：npx wrangler pages deploy .
```

### 方式 B：GitHub Actions 自动部署

仓库已内置 `.github/workflows/deploy.yml`：

- 推送 `main` 分支或手动触发（`workflow_dispatch`）即自动运行。
- 自动完成：`npm ci` → 类型检查 → 幂等创建 R2 桶 `material-hub` → 幂等创建 KV 命名空间并注入 `wrangler.toml` → 创建 Pages 项目 → 注入 `LOGIN_TOKEN`/`SYNC_TOKEN` 密钥 → `wrangler pages deploy`。

需在仓库 **Settings → Secrets and variables → Actions** 配置以下仓库密钥（Repository secrets）：

| 密钥 | 说明 |
|---|---|
| `CF_API_TOKEN` | 具备 `Account`/Pages/R2/KV 权限的 Cloudflare API Token |
| `CF_ACCOUNT_ID` | Cloudflare 账户 ID |
| `CF_LOGIN_TOKEN` | 网页登录密码（对应运行时的 `LOGIN_TOKEN`） |
| `CF_SYNC_TOKEN` | 同步接口令牌（对应运行时的 `SYNC_TOKEN`） |

> 不配置 `CF_LOGIN_TOKEN` / `CF_SYNC_TOKEN` 则部署后免认证。

## 数据说明

- 产出元数据以单个 KV 键（清单 JSON）存储，字段含 `R2Key`（R2 对象键）、`name`、`ext`、`desc`、`tags` 等。
- 历史旧数据中 `r2Key` 字段已兼容迁移为 `R2Key`，无需手动处理。
