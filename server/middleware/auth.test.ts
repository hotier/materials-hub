import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authGuard } from '../middleware/auth';
import { syncAuth } from '../middleware/sync-auth';
import { rateLimiter } from '../middleware/rate-limit';
import { jsonError } from '../helpers';

describe('auth middleware', () => {
  const createMockContext = (env: any, cookies: Record<string, string> = {}): any => ({
    env,
    req: {
      url: 'https://example.com/api/upload',
      // hono/cookie 的 getCookie 读取 c.req.raw.headers
      raw: {
        headers: {
          get: (name: string) => {
            const key = name.toLowerCase();
            if (key === 'cookie') {
              const entries = Object.entries(cookies);
              return entries.length ? entries.map(([k, v]) => `${k}=${v}`).join('; ') : null;
            }
            return cookies[key] || null;
          },
        },
      },
      headers: {
        get: (name: string) => cookies[name.toLowerCase()] || null,
      },
      header: (name: string) => {
        const key = name.toLowerCase();
        if (key === 'cookie') {
          const entries = Object.entries(cookies);
          return entries.length ? entries.map(([k, v]) => `${k}=${v}`).join('; ') : null;
        }
        return cookies[key] || null;
      },
      cookie: () => cookies,
    },
    cookie: vi.fn(),
    setCookie: vi.fn(),
    getCookie: (name: string) => cookies[name],
    json: vi.fn((data, status) => ({ data, status })),
  });

  describe('authGuard', () => {
    it('should pass when LOGIN_TOKEN not set', async () => {
      const c = createMockContext({});
      let nextCalled = false;
      await authGuard(c, async () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it('should reject when no session cookie', async () => {
      const c = createMockContext({ LOGIN_TOKEN: 'secret' });
      const result = await authGuard(c, async () => {});
      expect(result).toEqual({ data: { error: '请先登录' }, status: 401 });
    });

    it('should reject invalid session token', async () => {
      const c = createMockContext({ LOGIN_TOKEN: 'secret' }, { session: 'invalid-token' });
      const result = await authGuard(c, async () => {});
      expect(result).toEqual({ data: { error: '登录已过期，请重新登录' }, status: 401 });
    });
  });

  describe('syncAuth', () => {
    it('should pass when SYNC_TOKEN not set', async () => {
      const c = createMockContext({});
      let nextCalled = false;
      await syncAuth(c, async () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it('should reject missing Authorization header', async () => {
      const c = createMockContext({ SYNC_TOKEN: 'sync-secret' });
      const result = await syncAuth(c, async () => {});
      expect(result).toEqual({ data: { error: 'Token 无效' }, status: 401 });
    });

    it('should reject invalid Bearer token', async () => {
      const c = createMockContext(
        { SYNC_TOKEN: 'sync-secret' },
        { authorization: 'Bearer wrong-token' }
      );
      const result = await syncAuth(c, async () => {});
      expect(result).toEqual({ data: { error: 'Token 无效' }, status: 401 });
    });

    it('should pass with valid Bearer token', async () => {
      const c = createMockContext(
        { SYNC_TOKEN: 'sync-secret' },
        { authorization: 'Bearer sync-secret' }
      );
      let nextCalled = false;
      await syncAuth(c, async () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });
  });

  describe('rateLimiter', () => {
    it('should allow requests under limit', async () => {
      const c = createMockContext({});
      const limiter = rateLimiter({ windowSeconds: 60, maxRequests: 5 });
      let nextCalled = 0;
      for (let i = 0; i < 3; i++) {
        await limiter(c, async () => { nextCalled++; });
      }
      expect(nextCalled).toBe(3);
    });

    it('should reject requests over limit', async () => {
      const kvState: Record<string, string> = {};
      const mockKV = {
        get: vi.fn(async (key: string) => kvState[key] ?? null),
        put: vi.fn(async (key: string, value: string) => { kvState[key] = value; }),
      };
      const c = createMockContext({ KV: mockKV });
      const limiter = rateLimiter({ windowSeconds: 60, maxRequests: 2 });
      await limiter(c, async () => {});
      await limiter(c, async () => {});
      const result = await limiter(c, async () => {});
      expect(result).toEqual({ data: { error: '请求过于频繁，请稍后重试' }, status: 429 });
    });
  });
});

describe('jsonError helper', () => {
  it('should create error response with correct status', () => {
    const mockC = {
      json: vi.fn((data, status) => ({ data, status })),
    };
    const result = jsonError(mockC as any, 400, 'Bad Request', { code: 'INVALID_INPUT' });
    expect(result).toEqual({ data: { error: 'Bad Request', code: 'INVALID_INPUT' }, status: 400 });
  });
});