# 产出导航站 (Material Hub)

轻量产出管理平台，**Hono + Cloudflare Pages + R2 + Workers KV**。

## 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 框架 | **Hono** v4 | 专为 CF Workers/Pages 设计的轻量框架 |
| 类型 | TypeScript | 全栈类型安全 |
| 静态托管 | Cloudflare Pages | HTML/CSS/JS 直接分发 |
| API | Pages Functions (Hono) | 统一路由，中间件复用 |
| 文件存储 | Cloudflare R2 | HTML 产出文件，10GB 免费 |
| 元数据 | Workers KV | 单键存储产出清单 JSON |

## 目录结构

```
material-hub/
├── package.json
├── tsconfig.json
├── wrangler.toml
├── index.html                  # 导航首页
├── upload.html                 # 上传面板
├── preview.html                # 预览页
├── static/
│   ├── style.css
│   └── app.js
├── functions/
│   └── [[path]].ts             # 🔑 Hono 主入口（唯一函数入口）
└── src/
    ├── types.ts                # 共享类型 & Cloudflare 绑定
    ├── helpers.ts              # KV 读写、错误响应工具
    ├── middleware/
    │   └── auth.ts             # 上传密码校验中间件
    └── api/
        ├── list.ts             # GET  /api/list
        ├── upload.ts           # POST /api/upload
        ├── preview.ts          # GET  /api/preview?id=xxx
        ├── item.ts             # DELETE /api/item?id=xxx
        └── auth-status.ts      # GET  /api/auth-status
```

## 架构亮点

| 旧方案（5 个 JS 文件） | 新方案（Hono） |
|---|---|
| 每个文件手写 CORS | 全局 `cors()` 一行 |
| 每个文件手写 try-catch | `app.onError()` 统一兜底 |
| 密码校验粘贴 2 次 | `authGuard` 中间件一处复用 |
| 无类型，API 靠猜 | TypeScript + `Env` 绑定全类型 |
| 无 HMR | `wrangler pages dev --live-reload` |

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

## 部署

### 1. 在 Cloudflare 创建资源

- **R2 存储桶**：名称 `material-hub`
- **Workers KV 命名空间**：记录下来 ID

### 2. 修改 `wrangler.toml`

```toml
bucket_name = "material-hub"       # 你的 R2 桶名
id = "your-kv-namespace-id"        # 你的 KV ID
```

### 3. 部署

```bash
npm run deploy
# 或：npx wrangler pages deploy .
```

### 4. （可选）设置上传密码

Pages 项目 → Settings → Environment variables：
- `UPLOAD_PASSWORD` = 你的密码

不设置则无需密码即可上传。
