# 产出导航站 (Material Hub)

轻量产出管理平台，**Hono + Cloudflare Pages + R2 + Workers KV**。

## 技术栈


| 层       | 技术                        | 说明                                           |
| ---------- | ----------------------------- | ------------------------------------------------ |
| 框架     | **Hono** v4                 | 专为 CF Workers/Pages 设计的轻量框架           |
| 类型     | TypeScript                  | 全栈类型安全                                   |
| 静态托管 | Cloudflare Pages            | HTML/CSS/JS 直接分发                           |
| API      | Pages Functions (Hono)      | 统一路由，中间件复用                           |
| 文件存储 | Cloudflare R2（绑定名`R2`） | HTML/Office 等产出文件，10GB 免费              |
| 元数据   | Workers KV（绑定名`KV`）    | 单键存储产出清单 JSON                          |
| 预览     | 自研预览组件                | Markdown / PDF / Office / 代码 / 图片 / 音视频 |

## 目录结构

```
material-hub/
├── package.json
├── tsconfig.json
├── wrangler.toml
├── index.html                    # SPA 入口 HTML
├── .dev.vars                     # 本地开发环境变量
├── functions/
│   └── [[path]].ts               # 🔑 Hono 主入口（唯一函数入口）
├── src/                          # Vue 3 前端源码
│   ├── main.ts                   # 应用入口
│   ├── App.vue                   # 根组件
│   ├── assets/global.css         # 全局样式
│   ├── router/index.ts           # 路由配置 + 全局守卫
│   ├── types/index.ts            # 共享类型定义
│   ├── utils/fileType.ts         # 文件类型工具（图标映射等）
│   ├── views/                    # 页面视图
│   │   ├── HomeView.vue          # 首页：物料列表 + 编辑/删除
│   │   ├── UploadView.vue        # 上传页：拖拽/选择/压缩上传
│   │   ├── PreviewView.vue       # 预览页
│   │   └── LoginView.vue         # 登录页
│   ├── components/               # 可复用组件
│   │   ├── AppHeader.vue         # 顶部导航栏
│   │   ├── Sidebar.vue           # 侧边栏（文件夹树）
│   │   ├── MaterialList.vue      # 物料列表
│   │   ├── EditModal.vue         # 编辑弹窗
│   │   └── preview/              # 预览组件
│   │       ├── MdPreview.vue     # Markdown 渲染（markdown-it + highlight.js）
│   │       ├── PdfPreview.vue    # PDF 预览
│   │       ├── DocxPreview.vue   # Word 预览
│   │       ├── ExcelPreview.vue  # Excel 预览
│   │       ├── CodePreview.vue   # 代码预览
│   │       └── MediaPreview.vue  # 音视频预览
│   └── composables/              # 组合式函数
│       ├── useApi.ts             # API 请求封装（含 upload）
│       ├── useMediaCompress.ts   # 媒体压缩（图片/音频/视频）
│       ├── usePreview.ts         # 预览逻辑
│       ├── useShiki.ts           # Shiki 代码高亮
│       ├── useStorage.ts         # 本地存储
│       └── useToast.ts           # 消息提示
├── server/                       # 后端逻辑（Hono + Cloudflare）
│   ├── types.ts                  # Env 类型（R2/KV 绑定）
│   ├── helpers.ts                # 工具函数（MIME 映射、时间、错误响应）
│   ├── middleware/               # 中间件
│   │   ├── auth.ts               # 双模式认证（Cookie + Bearer Token）
│   │   ├── sync-auth.ts          # Bearer Token 认证（SYNC_TOKEN）
│   │   ├── csrf.ts               # CSRF 防护
│   │   └── rate-limit.ts         # 速率限制
│   ├── api/                      # API 路由
│   │   ├── list.ts               # GET    /api/list
│   │   ├── upload.ts             # POST   /api/upload
│   │   ├── preview.ts            # GET    /api/preview?id=xxx
│   │   ├── raw.ts                # GET    /api/raw?id=xxx
│   │   ├── item.ts               # PUT/DELETE /api/item?id=xxx
│   │   ├── login.ts              # POST   /api/login
│   │   ├── logout.ts             # POST   /api/logout
│   │   ├── session.ts            # GET    /api/session
│   │   ├── auth-status.ts        # GET    /api/auth-status
│   │   └── sync.ts               # GET/POST/DELETE /api/sync（Bearer Token）
│   ├── lib/                      # 库函数
│   │   ├── crypto.ts             # Session Token 加解密
│   │   ├── kv-service.ts         # KV 读写服务
│   │   ├── validation.ts         # Zod 参数校验
│   │   ├── categories.ts        # 扩展名 → 分类映射
│   │   └── errors.ts             # 自定义错误类型
│   └── services/                 # 业务服务
│       ├── material.ts           # 物料创建逻辑
│       └── r2.ts                 # R2 文件操作
└── .github/workflows/deploy.yml  # GitHub Actions 自动部署
```

## 架构亮点


| 旧方案（5 个 JS 文件） | 新方案（Hono）                          |
| ------------------------ | ----------------------------------------- |
| 每个文件手写 CORS      | 全局`cors()` 一行                       |
| 每个文件手写 try-catch | `app.onError()` 统一兜底                |
| 密码校验粘贴 2 次      | `authGuard` / `syncAuth` 中间件一处复用 |
| 无类型，API 靠猜       | TypeScript +`Env` 绑定全类型            |
| 无 HMR                 | `wrangler pages dev --live-reload`      |

## 功能说明

- **编辑**：在首页列表项可打开编辑弹窗，修改名称、描述、标签（文件后缀只读展示）。
- **预览**：支持内联预览（Flyfish 查看器）与新窗口预览两种模式。
- **文件类型**：支持图片、PDF、Office（doc/docx/xls/xlsx/ppt/pptx/visio 等）、OpenDocument 及常见文本/代码格式。
- **认证**：
  - 仅当配置了 `LOGIN_TOKEN` 才启用登录，登录后签发 httpOnly `session` Cookie（7 天内活跃自动续期）。
  - **前端接口**（`/api/upload`、`/api/item`、`/api/list`）：仅支持 Cookie 会话认证。
  - **外部接口**（`/api/sync`）：仅支持 Bearer Token 认证（`SYNC_TOKEN`），供 curl / 脚本 / API 调用，无需预先登录。
  - **公开接口**（`/api/preview`、`/api/raw`）：无需认证。
  - 未配置任何密码则无需认证可直接访问与上传。

## API 接口

### 认证方式


| 类型         | 适用接口                                                 | 说明                                                      |
| -------------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| Cookie       | `/api/upload`、`/api/item`、`/api/list`、`/api/download` | 前端浏览器自动携带，登录后获取                            |
| Bearer Token | `/api/sync`（GET/POST/DELETE）                           | 外部 API 调用，请求头`Authorization: Bearer <SYNC_TOKEN>` |
| 无需认证     | `/api/preview`、`/api/raw`                               | 公开访问（预览页面、文件内容加载）                        |

- `LOGIN_TOKEN`：前端登录密码，通过 `.dev.vars` 或 `wrangler secret put` 配置
- `SYNC_TOKEN`：API 调用令牌，通过 `.dev.vars` 或 `wrangler secret put` 配置
- 未配置密码则所有接口免认证

### GET /api/sync（列表）

获取当前所有物料列表，供外部 API 查询。**仅支持 Bearer Token 认证。**

**请求头**


| 头                                   | 必填 | 说明         |
| -------------------------------------- | ------ | -------------- |
| `Authorization: Bearer <SYNC_TOKEN>` | ✅   | API 调用令牌 |

**查询参数（Query String）**


| 参数     | 必填 | 说明                                            |
| ---------- | ------ | ------------------------------------------------- |
| `ext`    | ❌   | 按扩展名过滤，支持逗号分隔多值，如`pdf,md,xlsx` |
| `tag`    | ❌   | 按标签过滤（匹配任一），支持逗号分隔多值        |
| `path`   | ❌   | 按相对路径前缀过滤，如`docs/2026`               |
| `q`      | ❌   | 按名称关键词搜索（不区分大小写，子串匹配）      |
| `sort`   | ❌   | 排序字段：`createTime`（默认）、`name`、`size`  |
| `order`  | ❌   | 排序方向：`desc`（默认）、`asc`                 |
| `offset` | ❌   | 分页偏移量，默认 0                              |
| `limit`  | ❌   | 每页数量，默认全部，最大 1000                   |
| `fields` | ❌   | 指定返回字段（逗号分隔），如`id,name,ext,size`  |

**成功响应（200）**

```json
{
  "success": true,
  "count": 42,
  "total": 42,
  "cateMap": { "图片": 20, "文档": 12, "文本": 10 },
  "items": [
    {
      "id": "a1b2c3d4...",
      "name": "首页设计稿",
      "desc": "...",
      "tags": ["env", "ui"],
      "ext": "png",
      "size": 102400,
      "createTime": "2026-07-30, 14:05:11+08:00"
    }
  ]
}
```

**curl 示例**

```bash
# 获取全部
curl -H "Authorization: Bearer your-sync-token" \
  https://your-domain.pages.dev/api/sync

# 过滤：仅 PDF 和 Markdown
curl -H "Authorization: Bearer your-sync-token" \
  "https://your-domain.pages.dev/api/sync?ext=pdf,md"

# 搜索 + 分页：名称含"绩效"，第 2 页，每页 10 条
curl -H "Authorization: Bearer your-sync-token" \
  "https://your-domain.pages.dev/api/sync?q=绩效&offset=10&limit=10"

# 只返回 id 和 name，按文件大小降序
curl -H "Authorization: Bearer your-sync-token" \
  "https://your-domain.pages.dev/api/sync?fields=id,name,size&sort=size&order=desc"

# 按标签 + 路径过滤
curl -H "Authorization: Bearer your-sync-token" \
  "https://your-domain.pages.dev/api/sync?tag=doc&path=docs/"
```

### POST /api/sync（上传）

上传文件到物料库，返回物料元数据和预览链接。**仅支持 Bearer Token 认证。**

**请求头**


| 头                                   | 必填 | 说明                 |
| -------------------------------------- | ------ | ---------------------- |
| `Authorization: Bearer <SYNC_TOKEN>` | ✅   | API 调用令牌         |
| `Content-Type: multipart/form-data`  | ✅   | curl 加`-F` 自动设置 |

**请求体（multipart/form-data）**


| 字段   | 必填 | 说明                                   |
| -------- | ------ | ---------------------------------------- |
| `file` | ✅   | 上传的文件                             |
| `name` | ❌   | 显示名称，最大 60 字符；不填则取文件名 |
| `desc` | ❌   | 描述，最大 200 字符                    |
| `tags` | ❌   | 标签，逗号分隔，如`env,character`      |

**支持格式**：`html, htm, jpg, jpeg, png, gif, svg, webp, bmp, ico, json, txt, md, csv, xml, css, js, ts, yaml, yml, log, sql, pdf, doc, docx, docm, dotx, dotm, rtf, xls, xlsx, xlsm, xltx, xlsb, ppt, pptx, pptm, potx, ppsx, vsd, vsdx, pub, odt, ods, odp, odg`

**限制**：单文件最大 10 MB（wrangler.toml 中可配置）

**成功响应（200）**

```json
{
  "item": {
    "id": "a1b2c3d4e5f67890abcd",
    "name": "首页设计稿",
    "desc": "2026年7月首页改版",
    "tags": ["env", "ui"],
    "ext": "png",
    "R2Key": "output/2026/07/30/a1b2c3d4e5f67890abcd.png",
    "size": 102400,
    "createTime": "2026-07-30, 14:05:11+08:00"
  },
  "previewUrl": "https://your-domain.pages.dev/preview?id=a1b2c3d4e5f67890abcd"
}
```

**错误响应**

```json
// 400 — 参数缺失或文件不合法
{ "error": "缺少必要参数：file" }
{ "error": "不支持的文件格式，允许：html, htm, ..." }
{ "error": "文件大小不能超过 10MB" }

// 401 — 认证失败
{ "error": "Token 无效" }
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
curl -H "Authorization: Bearer your-sync-token" \
  -F "file=@screenshot.png" \
  https://your-domain.pages.dev/api/sync
```

### DELETE /api/sync（删除）

根据 ID 删除物料（R2 文件 + KV 元数据）。**仅支持 Bearer Token 认证。**

**请求头**


| 头                                   | 必填 | 说明         |
| -------------------------------------- | ------ | -------------- |
| `Authorization: Bearer <SYNC_TOKEN>` | ✅   | API 调用令牌 |

**请求参数（Query String）**


| 参数 | 必填 | 说明                               |
| ------ | ------ | ------------------------------------ |
| `id` | ✅   | 物料 ID，来自上传响应中的`item.id` |

**成功响应（200）**

```json
{ "success": true, "id": "a1b2c3d4e5f67890abcd" }
```

**curl 示例**

```bash
curl -X DELETE "https://your-domain.pages.dev/api/sync?id=a1b2c3d4-..." \
  -H "Authorization: Bearer your-sync-token"
```


## 前端功能

### Markdown 渲染

- **渲染引擎**：markdown-it + highlight.js（Shiki 可选）
- **支持语法**：标题、列表、代码块、表格、引用、链接、图片、加粗、斜体、删除线、任务列表
- **代码块**：一键复制按钮、语言标签显示
- **加粗修复**：自动处理中文标点后未加空格导致的加粗失效问题
- **表格**：自定义边框样式，增强可读性
- **数学公式**：KaTeX 渲染
- **Mermaid 图表**：流程图/时序图等

### 媒体压缩

上传前自动压缩以下类型文件：

- **图片**：JPEG/PNG/WebP，最大宽度 1920px
- **音频**：AAC 压缩，最大 128kbps
- **视频**：H.264 压缩，分辨率保持不变

### 其他特性

- **拖拽上传**：支持拖拽文件/文件夹到上传区域
- **粘贴上传**：Ctrl+V 快速上传剪贴板图片
- **文件夹管理**：创建/选择文件夹路径，上传时自动归类
- **搜索过滤**：按名称、标签快速筛选物料
- **预览类型**：图片、PDF、Office 文档（Word/Excel/PPT）、Markdown、代码、音视频

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器（Vite + Wrangler 双进程 HMR）
npm run dev
# → 前端 http://localhost:5173
# → 后端 http://localhost:8787

# 类型检查
npm run typecheck

# 生产构建
npm run build
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
# 自动执行：vite build → wrangler pages deploy dist/
```

### 方式 B：GitHub Actions 自动部署

仓库已内置 `.github/workflows/deploy.yml`：

- 推送 `main` 分支或手动触发（`workflow_dispatch`）即自动运行。
- 自动完成：`npm ci` → 类型检查 → 幂等创建 R2 桶 `material-hub` → 幂等创建 KV 命名空间并注入 `wrangler.toml` → 创建 Pages 项目 → 注入 `LOGIN_TOKEN`/`SYNC_TOKEN` 密钥 → `wrangler pages deploy`。

需在仓库 **Settings → Secrets and variables → Actions** 配置以下仓库密钥（Repository secrets）：


| 密钥             | 说明                                                  |
| ------------------ | ------------------------------------------------------- |
| `CF_API_TOKEN`   | 具备`Account`/Pages/R2/KV 权限的 Cloudflare API Token |
| `CF_ACCOUNT_ID`  | Cloudflare 账户 ID                                    |
| `CF_LOGIN_TOKEN` | 网页登录密码（对应运行时的`LOGIN_TOKEN`）             |
| `CF_SYNC_TOKEN`  | 同步接口令牌（对应运行时的`SYNC_TOKEN`）              |

> 不配置 `CF_LOGIN_TOKEN` / `CF_SYNC_TOKEN` 则部署后免认证。

## 数据说明

- 产出元数据以单个 KV 键（清单 JSON）存储，字段含 `R2Key`（R2 对象键）、`name`、`ext`、`desc`、`tags` 等。
- 历史旧数据中 `r2Key` 字段已兼容迁移为 `R2Key`，无需手动处理。


| 参数     | 必填 | 说明                                            |
| ---------- | ------ | ------------------------------------------------- |
| `ext`    | ❌   | 按扩展名过滤，支持逗号分隔多值，如`pdf,md,xlsx` |
| `tag`    | ❌   | 按标签过滤（匹配任一），支持逗号分隔多值        |
| `path`   | ❌   | 按相对路径前缀过滤，如`docs/2026`               |
| `q`      | ❌   | 按名称关键词搜索（不区分大小写，子串匹配）      |
| `sort`   | ❌   | 排序字段：`createTime`（默认）、`name`、`size`  |
| `order`  | ❌   | 排序方向：`desc`（默认）、`asc`                 |
| `offset` | ❌   | 分页偏移量，默认 0                              |
| `limit`  | ❌   | 每页数量，默认全部，最大 1000                   |
