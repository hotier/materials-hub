/**
 * CSRF 保护中间件
 *
 * 检查 Origin / Referer header，防止跨站请求伪造
 * 仅对状态变更的 API（POST/PUT/DELETE）生效
 */

import type { Context, Next } from 'hono';
import type { Env } from '../types';
import { jsonError } from '../helpers';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function csrfGuard(c: Context<{ Bindings: Env }>, next: Next) {
  // GET/HEAD/OPTIONS 放行
  if (SAFE_METHODS.has(c.req.method)) {
    return next();
  }

  // 仅在有登录保护的场景下才检查
  if (!c.env.LOGIN_TOKEN) {
    return next();
  }

  const origin = c.req.header('Origin');
  const referer = c.req.header('Referer');

  // 如果没有 Origin 和 Referer（比如 curl / CLI 调用），信任 Bearer token 认证
  if (!origin && !referer) {
    return next();
  }

  const url = new URL(c.req.url);
  const hostname = url.hostname;

  // 校验 Origin
  if (origin) {
    try {
      const originHost = new URL(origin).hostname;
      if (originHost !== hostname) {
        return jsonError(c, 403, 'CSRF 校验失败');
      }
    } catch {
      return jsonError(c, 403, '无效的 Origin');
    }
  }

  // 校验 Referer
  if (referer) {
    try {
      const refererHost = new URL(referer).hostname;
      if (refererHost !== hostname) {
        return jsonError(c, 403, 'CSRF 校验失败');
      }
    } catch {
      return jsonError(c, 403, '无效的 Referer');
    }
  }

  return next();
}
