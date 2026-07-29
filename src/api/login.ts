import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import type { Env } from '../types';
import { jsonError, createSessionToken } from '../helpers';

const loginRoute = new Hono<{ Bindings: Env }>();

/**
 * POST /api/login
 * 验证密码 → 签发 httpOnly session cookie
 */
loginRoute.post('/', async (c) => {
  const configPwd = c.env.LOGIN_TOKEN;

  // 未配置密码 → 直接告知无需认证
  if (!configPwd) {
    return c.json({ requireAuth: false });
  }

  let body: { password?: string };
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, '无效的请求体');
  }

  if (!body.password || body.password !== configPwd) {
    return jsonError(c, 403, '密码错误');
  }

  // 签发 session cookie（httpOnly，JS 不可读）
  const token = await createSessionToken(configPwd);
  const isSecure = c.req.url.startsWith('https://');
  setCookie(c, 'session', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });

  return c.json({ success: true });
});

export default loginRoute;
