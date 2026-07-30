/**
 * 简易速率限制中间件（基于 KV）
 *
 * 对上传、同步等状态变更接口限流
 * 每个 IP 每分钟最多允许指定次数的请求
 */

import type { Context, Next } from 'hono';
import type { Env } from '../types';
import { jsonError } from '../helpers';

interface RateLimitConfig {
  /** 时间窗口（秒） */
  windowSeconds: number;
  /** 窗口内最大请求数 */
  maxRequests: number;
}

const RATE_LIMIT_KEY_PREFIX = 'ratelimit:';

export function rateLimiter(config: RateLimitConfig) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    // 未配置 KV 绑定或窗口为 0 则跳过
    if (!c.env.KV || config.maxRequests <= 0) {
      return next();
    }

    const ip = c.req.header('CF-Connecting-IP') ||
      c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
      'unknown';

    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - config.windowSeconds;
    const key = `${RATE_LIMIT_KEY_PREFIX}${ip}`;

    // 读取请求历史
    const raw = await c.env.KV.get(key);
    let timestamps: number[] = raw ? JSON.parse(raw) : [];

    // 清理过期记录
    timestamps = timestamps.filter((t) => t > windowStart);

    if (timestamps.length >= config.maxRequests) {
      return jsonError(c, 429, '请求过于频繁，请稍后重试');
    }

    // 记录本次请求
    timestamps.push(now);
    await c.env.KV.put(key, JSON.stringify(timestamps), {
      expirationTtl: config.windowSeconds * 2,
    });

    return next();
  };
}
