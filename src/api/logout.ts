import { Hono } from 'hono';
import { deleteCookie } from 'hono/cookie';
import type { Env } from '../types';

const logoutRoute = new Hono<{ Bindings: Env }>();

/**
 * POST /api/logout
 * 清除 session cookie
 */
logoutRoute.post('/', (c) => {
  deleteCookie(c, 'session', { path: '/' });
  return c.json({ success: true });
});

export default logoutRoute;
