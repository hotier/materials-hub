import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handle, serveStatic } from 'hono/cloudflare-pages';
import type { Env } from '../server/types';
import { authGuard } from '../server/middleware/auth';
import { syncAuth } from '../server/middleware/sync-auth';
import { csrfGuard } from '../server/middleware/csrf';
import { rateLimiter } from '../server/middleware/rate-limit';

import listRoute from '../server/api/list';
import uploadRoute from '../server/api/upload';
import previewRoute from '../server/api/preview';
import rawRoute from '../server/api/raw';
import itemRoute from '../server/api/item';
import authStatusRoute from '../server/api/auth-status';
import loginRoute from '../server/api/login';
import logoutRoute from '../server/api/logout';
import sessionRoute from '../server/api/session';
import syncRoute from '../server/api/sync';

const app = new Hono<{ Bindings: Env }>();

// ===== 全局中间件 =====

// CORS（限制为同源，生产环境更安全）
app.use('*', cors({
  origin: (_origin, c) => {
    // 允许同源请求
    const url = new URL(c.req.url);
    // 也允许无 Origin 的请求（curl、wget 等）
    if (!_origin) return _origin;
    try {
      const originUrl = new URL(_origin);
      if (originUrl.host === url.host) return _origin;
    } catch { /* ignore */ }
    return null;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// API 统一前缀
const api = new Hono<{ Bindings: Env }>();

// ===== CSRF 保护（状态变更路由） =====
api.use('*', csrfGuard);

// ===== 公开路由 =====
api.route('/list', listRoute);
api.route('/preview', previewRoute);
api.route('/raw', rawRoute);
api.route('/auth-status', authStatusRoute);
api.route('/login', loginRoute);
api.route('/logout', logoutRoute);

// ===== 需 Cookie 校验的路由（含速率限制） =====
api.use('/upload', authGuard);
api.use('/upload', rateLimiter({ windowSeconds: 60, maxRequests: 20 }));
api.route('/upload', uploadRoute);

api.use('/item', authGuard);
api.use('/item', rateLimiter({ windowSeconds: 60, maxRequests: 30 }));
api.route('/item', itemRoute);

api.use('/session', authGuard);
api.route('/session', sessionRoute);

// ===== 同步路由（Bearer Token 认证 + 速率限制） =====
api.use('/sync/*', syncAuth);
api.use('/sync/*', rateLimiter({ windowSeconds: 60, maxRequests: 30 }));
api.route('/sync', syncRoute);

// ===== 挂载 API 到 /api =====
app.route('/api', api);

// ===== 独立页面：/preview → preview.html =====
app.get('/preview', async (c) => {
  if (c.env.ASSETS) {
    const url = new URL(c.req.url);
    url.pathname = '/preview.html';
    return c.env.ASSETS.fetch(url);
  }
  const url = new URL(c.req.url);
  url.pathname = '/preview.html';
  return c.redirect(url.toString());
});

// ===== SPA 回退 → index.html =====
app.get('*', async (c) => {
  if (c.env.ASSETS) {
    const url = new URL(c.req.url);
    url.pathname = '/index.html';
    return c.env.ASSETS.fetch(url);
  }
  const url = new URL(c.req.url);
  url.pathname = '/index.html';
  return c.redirect(url.toString());
});

// ===== 静态文件服务（兜底） =====
app.use('*', serveStatic());

// ===== 全局错误处理 =====
app.onError((err, c) => {
  console.error('[app] 未处理异常:', err.message);
  if (err instanceof Error && 'status' in err) {
    const appErr = err as { status: number; message: string; code?: string; details?: unknown };
    return c.json(
      { error: appErr.message, code: appErr.code, details: appErr.details },
      appErr.status as any,
    );
  }
  // 生产环境不暴露内部错误详情
  const isProd = c.env?.LOGIN_TOKEN !== undefined;
  return c.json(
    { error: isProd ? '服务器内部错误' : (err.message || '服务器内部错误') },
    500,
  );
});

// Pages Functions 入口
export const onRequest = handle(app);
