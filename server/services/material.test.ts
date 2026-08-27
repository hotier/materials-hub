import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMaterial, syncMaterial, listMaterials, getMaterialById, updateMaterial, deleteMaterial, getMaterialFile, getFileByKey } from '../services/material';
import { generateId, buildR2Key, uploadToR2, getFromR2, deleteFromR2 } from '../services/r2';
import { getShanghaiDate, getMime } from '../helpers';
import type { Env, MaterialItem } from '../types';

// Mock Cloudflare bindings
const mockR2 = {
  put: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(null),
  head: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue(undefined),
};

const mockKV = {
  get: vi.fn().mockResolvedValue(null),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue({ keys: [] }),
};

const mockEnv: Env = {
  R2: mockR2 as any,
  KV: mockKV as any,
  LOGIN_TOKEN: 'test-token',
  SYNC_TOKEN: 'sync-token',
};

const mockFile = (name: string, size: number = 1024) => {
  const file = new File(['test content'], name, { type: 'text/plain' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('material service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:30:00Z'));
  });

  describe('createMaterial', () => {
    it('should upload file to R2 and store metadata in KV', async () => {
      const file = mockFile('test.pdf', 2048);
      mockR2.put.mockResolvedValue(undefined);
      mockKV.put.mockResolvedValue(undefined);

      const result = await createMaterial(
        mockEnv,
        file,
        { name: 'Test PDF', desc: 'A test file', tags: ['pdf', 'test'], relativePath: 'docs/' },
        'https://example.com'
      );

      expect(mockR2.put).toHaveBeenCalled();
      expect(mockKV.put).toHaveBeenCalled();
      expect(result.item.name).toBe('Test PDF');
      expect(result.item.ext).toBe('pdf');
      expect(result.item.size).toBe(2048);
      expect(result.item.tags).toEqual(['pdf', 'test']);
      expect(result.item.relativePath).toBe('docs/');
      expect(result.previewUrl).toBe('https://example.com/preview?id=' + result.item.id);
    });

    it('should reject unsupported file types', async () => {
      const file = mockFile('test.exe');
      await expect(createMaterial(mockEnv, file, { name: 'Test', desc: '', tags: [] }, 'https://example.com'))
        .rejects.toThrow('文件格式不合法（扩展名缺失或被禁止）');
    });

    it('should reject files over 10MB', async () => {
      const file = mockFile('large.pdf', 11 * 1024 * 1024);
      await expect(createMaterial(mockEnv, file, { name: 'Test', desc: '', tags: [] }, 'https://example.com'))
        .rejects.toThrow('文件大小不能超过 10MB');
    });

    it('should cleanup R2 on KV failure', async () => {
      const file = mockFile('test.pdf');
      mockR2.put.mockResolvedValue(undefined);
      mockKV.put.mockRejectedValue(new Error('KV error'));
      mockR2.delete.mockResolvedValue(undefined);

      await expect(createMaterial(mockEnv, file, { name: 'Test', desc: '', tags: [] }, 'https://example.com'))
        .rejects.toThrow('KV error');

      expect(mockR2.delete).toHaveBeenCalled();
    });
  });

  describe('syncMaterial', () => {
    it('should upload with crypto.randomUUID', async () => {
      const file = mockFile('sync.txt');
      mockR2.put.mockResolvedValue(undefined);
      mockKV.put.mockResolvedValue(undefined);

      const result = await syncMaterial(mockEnv, file, { name: 'Sync', desc: '', tags: ['sync'] }, 'https://example.com');

      expect(result.item.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(result.item.name).toBe('Sync');
    });

    it('should use filename as name when not provided', async () => {
      const file = mockFile('document.docx');
      mockR2.put.mockResolvedValue(undefined);
      mockKV.put.mockResolvedValue(undefined);

      const result = await syncMaterial(mockEnv, file, { name: '', desc: '', tags: [] }, 'https://example.com');

      expect(result.item.name).toBe('document');
      expect(result.item.ext).toBe('docx');
    });
  });

  describe('listMaterials', () => {
    it('should return all materials', async () => {
      const items: MaterialItem[] = [
        { id: '1', name: 'File 1', ext: 'pdf', R2Key: 'k1', size: 100, createTime: '2024-01-01', tags: ['a'] },
        { id: '2', name: 'File 2', ext: 'jpg', R2Key: 'k2', size: 200, createTime: '2024-01-02', tags: ['b'] },
      ];
      mockKV.get.mockImplementation(async (key: string) => {
        if (key === 'materials:ids') return JSON.stringify(['1', '2']);
        if (key === 'material:1') return JSON.stringify(items[0]);
        if (key === 'material:2') return JSON.stringify(items[1]);
        if (key === 'material:v:1' || key === 'material:v:2') return '1';
        return null;
      });

      const result = await listMaterials(mockEnv);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('File 1');
    });

    it('should return empty array when no materials', async () => {
      mockKV.get.mockResolvedValue(null);
      const result = await listMaterials(mockEnv);
      expect(result).toEqual([]);
    });
  });

  describe('getMaterialById', () => {
    it('should return material by id', async () => {
      const item: MaterialItem = { id: '1', name: 'Test', ext: 'pdf', R2Key: 'k1', size: 100, createTime: '2024-01-01', tags: [] };
      mockKV.get.mockResolvedValue(JSON.stringify(item));

      const result = await getMaterialById(mockEnv, '1');
      expect(result).toEqual(item);
    });

    it('should throw NotFoundError when not exists', async () => {
      mockKV.get.mockResolvedValue(null);
      await expect(getMaterialById(mockEnv, 'nonexistent')).rejects.toThrow('产出不存在');
    });
  });

  describe('updateMaterial', () => {
    it('should update material metadata', async () => {
      const item: MaterialItem = { id: '1', name: 'Old', ext: 'pdf', R2Key: 'k1', size: 100, createTime: '2024-01-01', tags: ['old'] };
      mockKV.get
        .mockResolvedValueOnce(JSON.stringify(item)) // getItem
        .mockResolvedValueOnce('1') // getVersion（乐观锁读取）
        .mockResolvedValueOnce('1'); // putItem 内部再次 getVersion
      mockKV.put.mockResolvedValue(undefined);

      const result = await updateMaterial(mockEnv, '1', { name: 'New', desc: 'Updated', tags: ['new'] });

      expect(result.name).toBe('New');
      expect(result.desc).toBe('Updated');
      expect(result.tags).toEqual(['new']);
      expect(mockKV.put).toHaveBeenCalled();
    });

    it('should throw NotFoundError when not exists', async () => {
      mockKV.get.mockResolvedValue(null);
      await expect(updateMaterial(mockEnv, 'nonexistent', { name: 'New' })).rejects.toThrow('产出不存在');
    });
  });

  describe('deleteMaterial', () => {
    it('should delete from R2 and KV', async () => {
      const item: MaterialItem = { id: '1', name: 'Test', ext: 'pdf', R2Key: 'k1', size: 100, createTime: '2024-01-01', tags: [] };
      mockKV.get.mockResolvedValue(JSON.stringify(item));
      mockR2.get.mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)) });
      mockR2.delete.mockResolvedValue(undefined);
      mockKV.delete.mockResolvedValue(undefined);

      await deleteMaterial(mockEnv, '1');

      expect(mockR2.delete).toHaveBeenCalledWith('k1');
      expect(mockKV.delete).toHaveBeenCalledWith('material:1');
    });

    it('should restore R2 on KV failure', async () => {
      const item: MaterialItem = { id: '1', name: 'Test', ext: 'pdf', R2Key: 'k1', size: 100, createTime: '2024-01-01', tags: [] };
      mockKV.get.mockResolvedValue(JSON.stringify(item));
      mockR2.get.mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)) });
      mockR2.delete.mockResolvedValue(undefined);
      mockKV.delete.mockRejectedValue(new Error('KV delete failed'));
      mockR2.put.mockResolvedValue(undefined);

      await expect(deleteMaterial(mockEnv, '1')).rejects.toThrow('KV delete failed');

      expect(mockR2.put).toHaveBeenCalledWith('k1', expect.any(ArrayBuffer), expect.any(Object));
    });
  });

  describe('getMaterialFile', () => {
    it('should return file with correct content type', async () => {
      const item: MaterialItem = { id: '1', name: 'Test', ext: 'pdf', R2Key: 'k1', size: 100, createTime: '2024-01-01', tags: [] };
      const buffer = new ArrayBuffer(100);
      mockKV.get.mockResolvedValue(JSON.stringify(item));
      mockR2.get.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(buffer),
        httpMetadata: { contentType: 'application/pdf' },
      });

      const result = await getMaterialFile(mockEnv, '1');

      expect(result).not.toBeNull();
      expect(result!.body).toBe(buffer);
      expect(result!.contentType).toContain('application/pdf');
    });

    it('should add charset for text types', async () => {
      const item: MaterialItem = { id: '1', name: 'Test', ext: 'txt', R2Key: 'k1', size: 100, createTime: '2024-01-01', tags: [] };
      mockKV.get.mockResolvedValue(JSON.stringify(item));
      mockR2.get.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
        httpMetadata: { contentType: 'text/plain' },
      });

      const result = await getMaterialFile(mockEnv, '1');
      expect(result!.contentType).toBe('text/plain; charset=utf-8');
    });
  });

  describe('getFileByKey', () => {
    it('should return file by R2 key', async () => {
      const buffer = new ArrayBuffer(100);
      mockR2.get.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(buffer),
        httpMetadata: { contentType: 'image/png' },
      });

      const result = await getFileByKey(mockEnv, 'output/2024/01/15/test.png');

      expect(result).not.toBeNull();
      expect(result!.body).toBe(buffer);
      expect(result!.contentType).toBe('image/png');
    });
  });
});

describe('r2 service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateId', () => {
    it('should generate 32-char alphanumeric ID', () => {
      const id = generateId();
      expect(id).toHaveLength(32);
      expect(id).toMatch(/^[a-zA-Z0-9]+$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('buildR2Key', () => {
    it('should build key with date prefix and ID', () => {
      const key = buildR2Key('test.pdf', '2024/01/15', 'abc123');
      expect(key).toBe('output/2024/01/15/abc123.pdf');
    });

    it('should include relative path', () => {
      const key = buildR2Key('test.pdf', '2024/01/15', 'abc123', 'docs/guide');
      expect(key).toBe('output/2024/01/15/docs/guide/abc123.pdf');
    });

    it('should sanitize relative path', () => {
      const key = buildR2Key('test.pdf', '2024/01/15', 'abc123', '../evil/../../etc');
      expect(key).toBe('output/2024/01/15/evil/etc/abc123.pdf');
    });

    it('should handle files without extension', () => {
      const key = buildR2Key('README', '2024/01/15', 'abc123');
      expect(key).toBe('output/2024/01/15/abc123.');
    });
  });

  describe('uploadToR2', () => {
    it('should upload with correct content type', async () => {
      const buffer = new ArrayBuffer(100);
      await uploadToR2(mockR2 as any, 'key', buffer, 'pdf');
      expect(mockR2.put).toHaveBeenCalledWith('key', buffer, {
        httpMetadata: { contentType: 'application/pdf' },
      });
    });
  });
});

describe('helpers', () => {
  describe('getShanghaiDate', () => {
    it('should return YYYY-MM-DD in Shanghai timezone', () => {
      // 2024-01-15T10:30:00Z = 2024-01-15T18:30:00+08:00
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T10:30:00Z'));
      expect(getShanghaiDate()).toBe('2024-01-15');
    });

    it('should handle timezone boundary', () => {
      // 2024-01-15T16:00:00Z = 2024-01-16T00:00:00+08:00
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T16:00:00Z'));
      expect(getShanghaiDate()).toBe('2024-01-16');
    });
  });

  describe('getMime', () => {
    it('should return correct MIME types', () => {
      expect(getMime('pdf')).toBe('application/pdf');
      expect(getMime('jpg')).toBe('image/jpeg');
      expect(getMime('png')).toBe('image/png');
      expect(getMime('txt')).toBe('text/plain');
      expect(getMime('json')).toBe('application/json');
      expect(getMime('unknown')).toBe('application/octet-stream');
    });
  });
});