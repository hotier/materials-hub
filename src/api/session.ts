import { Hono } from 'hono';
import type { Env } from '../types';

const sessionRoute = new Hono<{ Bindings: Env }>();

/**
 * GET /api/session
 * 检查当前 session cookie 是否有效（受 authGuard 保护）
 */
sessionRoute.get('/', (c) => {
  return c.json({ valid: true });
});

export default sessionRoute;
