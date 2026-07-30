import type { Context, Next } from 'hono';
import type { Env } from '../types';
import { jsonError } from '../helpers';
import { constantTimeEqual } from '../lib/crypto';

/**
 * 同步 API Token 校验中间件（常量时间比较）
 * 若配置了 SYNC_TOKEN 则校验 Authorization: Bearer <SYNC_TOKEN>
 * 未配置则免认证放行
 */
export async function syncAuth(c: Context<{ Bindings: Env }>, next: Next) {
  const configToken = c.env.SYNC_TOKEN;

  // 未设置 Token，免认证放行
  if (!configToken) return next();

  const auth = c.req.header('Authorization') || '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!constantTimeEqual(provided, configToken)) {
    return jsonError(c, 401, 'Token 无效');
  }

  return next();
}
