import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handle, serveStatic } from 'hono/cloudflare-pages';
import type { Env } from '../src/types';
import { authGuard } from '../src/middleware/auth';
import { syncAuth } from '../src/middleware/sync-auth';

import listRoute from '../src/api/list';
import uploadRoute from '../src/api/upload';
import previewRoute from '../src/api/preview';
import itemRoute from '../src/api/item';
import authStatusRoute from '../src/api/auth-status';
import loginRoute from '../src/api/login';
import logoutRoute from '../src/api/logout';
import sessionRoute from '../src/api/session';
import syncRoute from '../src/api/sync';

const app = new Hono<{ Bindings: Env }>();

// ===== 全局中间件 =====

// CORS 放行所有来源
app.use('*', cors());

// API 统一前缀
const api = new Hono<{ Bindings: Env }>();

// ===== 公开路由 =====
api.route('/list', listRoute);
api.route('/preview', previewRoute);
api.route('/auth-status', authStatusRoute);
api.route('/login', loginRoute);
api.route('/logout', logoutRoute);

// ===== 需 Cookie 校验的路由 =====
api.use('/session', authGuard);
api.route('/session', sessionRoute);
api.use('/upload', authGuard);
api.use('/item', authGuard);
api.route('/upload', uploadRoute);
api.route('/item', itemRoute);

// ===== 同步路由（Bearer Token 认证，供 WorkBuddy/自动化 使用） =====
api.use('/sync/*', syncAuth);
api.route('/sync', syncRoute);

// ===== 挂载 API 到 /api =====
app.route('/api', api);

// ===== 静态文件服务（兜底，优先走 Pages ASSETS） =====
app.use('*', serveStatic());

// ===== 全局错误处理 =====
app.onError((err, c) => {
  console.error('unhandled error:', err);
  return c.json({ error: err.message || '服务器内部错误' }, 500);
});

// Pages Functions 入口（handle 自动处理 context → fetch 映射）
export const onRequest = handle(app);
