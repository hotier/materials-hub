import type { Context, Next } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { Env } from '../types';
import { jsonError } from '../helpers';
import { verifySessionToken, createSessionToken } from '../lib/crypto';

/**
 * Session Cookie 校验中间件（滑动续期）
 * 仅当环境变量 LOGIN_TOKEN 被设置时才触发校验
 * 每次验证通过后自动刷新 cookie，7 天内活跃则永不过期
 */
export async function authGuard(c: Context<{ Bindings: Env }>, next: Next) {
  const configPwd = c.env.LOGIN_TOKEN;

  // 未设置密码，放行
  if (!configPwd) return next();

  const sessionCookie = getCookie(c, 'session');
  if (!sessionCookie) {
    return jsonError(c, 401, '请先登录');
  }

  const valid = await verifySessionToken(sessionCookie, configPwd);
  if (!valid) {
    return jsonError(c, 401, '登录已过期，请重新登录');
  }

  // 滑动续期
  const newToken = await createSessionToken(configPwd);
  const isSecure = c.req.url.startsWith('https://');
  setCookie(c, 'session', newToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });

  return next();
}
