import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Mock Cloudflare bindings
class MockR2Bucket {
  private store = new Map<string, { body: ArrayBuffer; httpMetadata?: { contentType?: string } }>();

  async put(key: string, body: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }) {
    this.store.set(key, { body, httpMetadata: options?.httpMetadata });
  }

  async get(key: string) {
    const item = this.store.get(key);
    if (!item) return null;
    return {
      arrayBuffer: () => Promise.resolve(item.body),
      httpMetadata: item.httpMetadata,
    };
  }

  async head(key: string) {
    const item = this.store.get(key);
    if (!item) return null;
    return {
      size: item.body.byteLength,
      httpMetadata: item.httpMetadata,
    };
  }

  async delete(key: string) {
    this.store.delete(key);
  }
}

class MockKVNamespace {
  private store = new Map<string, string>();

  async get(key: string, type?: 'text' | 'json' | 'arrayBuffer') {
    const value = this.store.get(key);
    if (!value) return null;
    if (type === 'json') return JSON.parse(value);
    if (type === 'arrayBuffer') {
      const encoder = new TextEncoder();
      return encoder.encode(value).buffer;
    }
    return value;
  }

  async put(key: string, value: string) {
    this.store.set(key, value);
  }

  async delete(key: string) {
    this.store.delete(key);
  }

  async list() {
    return { keys: Array.from(this.store.keys()).map(name => ({ name })) };
  }
}

// Set global mocks
vi.stubGlobal('R2Bucket', MockR2Bucket);
vi.stubGlobal('KVNamespace', MockKVNamespace);

// Mock Env
const mockR2 = new MockR2Bucket();
const mockKV = new MockKVNamespace();
vi.stubGlobal('env', {
  R2: mockR2,
  KV: mockKV,
  LOGIN_TOKEN: 'test-login-token',
  SYNC_TOKEN: 'test-sync-token',
});

// MSW server for API mocking
const server = setupServer(
  http.get('/api/list', () => HttpResponse.json({
    success: true,
    data: [],
    count: 0,
    cateMap: {},
    items: [],
    versions: {},
  })),
  http.post('/api/upload', () => HttpResponse.json({
    success: true,
    item: { id: 'test-id', name: 'test', ext: 'txt', size: 100, createTime: '2024-01-01', tags: [] },
    previewUrl: '/preview?id=test-id',
  })),
  http.delete('/api/item', () => HttpResponse.json({ success: true, id: 'test-id' })),
  http.put('/api/item', () => HttpResponse.json({ success: true, item: {} })),
  http.get('/api/auth-status', () => HttpResponse.json({ authenticated: true, requireAuth: true })),
  http.post('/api/login', () => HttpResponse.json({ success: true })),
  http.post('/api/logout', () => HttpResponse.json({ success: true })),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());