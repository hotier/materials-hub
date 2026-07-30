import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import type { Env } from '../types';
import { jsonError } from '../helpers';
import { createSessionToken } from '../lib/crypto';
import { loginSchema } from '../lib/validation';
import { ZodError } from 'zod';

const loginRoute = new Hono<{ Bindings: Env }>();

/**
 * POST /api/login
 * 验证密码 → 签发 httpOnly session cookie
 * 兼容前端发送的 { pass } 字段名
 */
loginRoute.post('/', async (c) => {
  const configPwd = c.env.LOGIN_TOKEN;

  if (!configPwd) {
    return c.json({ requireAuth: false, success: true });
  }

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, '无效的请求体');
  }

  // 兼容前端发送 pass 字段（旧版）和 password 字段（新版）
  const rawPassword = (body.pass || body.password || '') as string;

  let parsed: { password: string };
  try {
    parsed = loginSchema.parse({ password: rawPassword });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(c, 400, err.issues[0]?.message || '参数校验失败');
    }
    throw err;
  }

  if (parsed.password !== configPwd) {
    return jsonError(c, 403, '密码错误');
  }

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
