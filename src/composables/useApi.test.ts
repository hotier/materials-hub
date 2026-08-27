import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useApi } from '@/composables/useApi';

describe('useApi composable', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const mockSuccessResponse = (data: any) => ({
    ok: true,
    json: () => Promise.resolve(data),
  });

  const mockErrorResponse = (status: number, error: string) => ({
    ok: false,
    status,
    json: () => Promise.resolve({ error }),
  });

  describe('list', () => {
    it('should return material list', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockSuccessResponse({
        success: true,
        data: [{ id: '1', name: 'Test', ext: 'txt', size: 100 }],
        count: 1,
        cateMap: { 文本: 1 },
        items: [{ id: '1', name: 'Test', ext: 'txt', size: 100 }],
        versions: { '1': 1 },
      }));

      const api = useApi();
      const result = await api.list();

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Test');
    });
  });

  describe('upload', () => {
    it('should upload file via multipart', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockSuccessResponse({
        success: true,
        item: { id: 'new-id', name: 'Uploaded', ext: 'pdf', size: 200 },
        previewUrl: '/preview?id=new-id',
      }));

      const api = useApi();
      const formData = new FormData();
      formData.append('file', new File(['content'], 'test.pdf', { type: 'application/pdf' }));

      const result = await api.upload(formData);

      expect(result.success).toBe(true);
      expect(result.item.name).toBe('Uploaded');
    });
  });

  describe('remove', () => {
    it('should delete item', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockSuccessResponse({ success: true, id: '1' }));

      const api = useApi();
      const result = await api.remove('1');

      expect(result.success).toBe(true);
    });
  });

  describe('update', () => {
    it('should update item metadata', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockSuccessResponse({
        success: true,
        item: { id: '1', name: 'Updated', desc: 'New desc', tags: ['tag1'] },
      }));

      const api = useApi();
      const result = await api.update('1', { name: 'Updated', desc: 'New desc', tags: ['tag1'] });

      expect(result.success).toBe(true);
      expect(result.item.name).toBe('Updated');
    });
  });

  describe('authStatus', () => {
    it('should return auth status', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockSuccessResponse({
        authenticated: true,
        requireAuth: true,
      }));

      const api = useApi();
      const result = await api.authStatus();

      expect(result.authenticated).toBe(true);
      expect(result.requireAuth).toBe(true);
    });
  });

  describe('login', () => {
    it('should login successfully', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockSuccessResponse({ success: true }));

      const api = useApi();
      const result = await api.login('password', false);

      expect(result.success).toBe(true);
    });
  });

  describe('logout', () => {
    it('should logout', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockSuccessResponse({}));

      const api = useApi();
      await api.logout();

      expect(global.fetch).toHaveBeenCalledWith('/api/logout', expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
      }));
    });
  });

  describe('URL helpers', () => {
    it('should generate preview URL', () => {
      const api = useApi();
      expect(api.previewUrl('abc123')).toBe('/api/preview?id=abc123');
    });

    it('should generate raw URL', () => {
      const api = useApi();
      expect(api.rawUrl('output/2024/01/test.txt')).toBe('/api/raw?key=output%2F2024%2F01%2Ftest.txt');
    });

    it('should generate preview page URL', () => {
      const api = useApi();
      expect(api.getPreviewPageUrl('abc123')).toBe('/preview?id=abc123');
    });
  });

  describe('401/403 redirect', () => {
    it('should redirect to login on 401', async () => {
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { href: '', pathname: '/home' } as any;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockErrorResponse(401, 'Unauthorized'));

      const api = useApi();
      await expect(api.list()).rejects.toThrow('认证已过期，请重新登录');

      expect(window.location.href).toBe('/login');

      (window as any).location = originalLocation;
    });
  });
});