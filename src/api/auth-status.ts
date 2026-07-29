import { Hono } from 'hono';
import type { Env } from '../types';

const authStatusRoute = new Hono<{ Bindings: Env }>();

/**
 * GET /api/auth-status
 * 前端用于判断是否需要显示密码输入框
 */
authStatusRoute.get('/', (c) => {
  return c.json({ requireAuth: !!c.env.LOGIN_TOKEN });
});

export default authStatusRoute;
