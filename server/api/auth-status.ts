import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import type { Env } from '../types';
import { verifySessionToken } from '../lib/crypto';

const authStatusRoute = new Hono<{ Bindings: Env }>();

/**
 * GET /api/auth-status
 * 前端判断是否需要显示登录界面
 * 同时检查 session cookie 有效性，返回真实认证状态
 */
authStatusRoute.get('/', async (c) => {
  const configPwd = c.env.LOGIN_TOKEN;

  // 未设置密码 → 无需认证，直接放行
  if (!configPwd) {
    return c.json({ requireAuth: false, authenticated: true });
  }

  // 检查 session cookie 是否有效
  const sessionCookie = getCookie(c, 'session');
  if (!sessionCookie) {
    return c.json({ requireAuth: true, authenticated: false });
  }

  try {
    const valid = await verifySessionToken(sessionCookie, configPwd);
    return c.json({ requireAuth: true, authenticated: valid });
  } catch {
    return c.json({ requireAuth: true, authenticated: false });
  }
});

export default authStatusRoute;
