import type { Context, Next } from 'hono';
import type { Env } from '../types';
import { jsonError } from '../helpers';

/**
 * 同步 API Token 校验中间件
 * 要求请求头 Authorization: Bearer <SYNC_TOKEN>
 * 若未配置 SYNC_TOKEN 则直接拒绝（同步端点必须有 Token）
 */
export async function syncAuth(c: Context<{ Bindings: Env }>, next: Next) {
  const configToken = c.env.SYNC_TOKEN;

  if (!configToken) {
    return jsonError(c, 501, '同步功能未启用，请配置 SYNC_TOKEN 环境变量');
  }

  const auth = c.req.header('Authorization') || '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (provided !== configToken) {
    return jsonError(c, 401, 'Token 无效');
  }

  return next();
}
