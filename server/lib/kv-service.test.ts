import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getVersion,
  incrVersion,
  getItem,
  putItem,
  deleteItem,
  getIdIndex,
  setIdIndex,
  appendToIndex,
  removeFromIndex,
  getAllMaterials,
  addMaterial,
  removeMaterial,
  migrateIfNeeded,
  itemKey,
  versionKey,
  INDEX_KEY,
  ITEM_PREFIX,
  ITEM_VERSION_PREFIX,
  extractKVId,
  buildPreviewUrl,
} from '../lib/kv-service';
import type { MaterialItem } from '../types';

const mockKV = {
  get: vi.fn(),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue({ keys: [] }),
};

describe('kv-service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // resetAllMocks 会清掉 mockKV 的默认实现，这里恢复
    mockKV.get.mockResolvedValue(undefined);
    mockKV.put.mockResolvedValue(undefined);
    mockKV.delete.mockResolvedValue(undefined);
    mockKV.list.mockResolvedValue({ keys: [] });
    vi.resetModules();
  });

  describe('key helpers', () => {
    it('should generate correct item key', () => {
      expect(itemKey('abc123')).toBe('material:abc123');
    });

    it('should generate correct version key', () => {
      expect(versionKey('abc123')).toBe('material:v:abc123');
    });

    it('should have correct constants', () => {
      expect(INDEX_KEY).toBe('materials:ids');
      expect(ITEM_PREFIX).toBe('material:');
      expect(ITEM_VERSION_PREFIX).toBe('material:v:');
    });
  });

  describe('extractKVId', () => {
    it('should extract id from query', () => {
      const c = { req: { query: (k: string) => (k === 'id' ? 'test-id' : undefined) } };
      expect(extractKVId(c)).toBe('test-id');
    });

    it('should return null when id missing', () => {
      const c = { req: { query: () => undefined } };
      expect(extractKVId(c)).toBeNull();
    });
  });

  describe('buildPreviewUrl', () => {
    it('should build correct preview URL', () => {
      expect(buildPreviewUrl('https://example.com', 'abc123')).toBe('https://example.com/preview?id=abc123');
    });
  });

  describe('getVersion / incrVersion', () => {
    it('should return 0 for non-existent version', async () => {
      mockKV.get.mockResolvedValue(null);
      const ver = await getVersion(mockKV as any, 'test-id');
      expect(ver).toBe(0);
    });

    it('should return stored version', async () => {
      mockKV.get.mockResolvedValue('5');
      const ver = await getVersion(mockKV as any, 'test-id');
      expect(ver).toBe(5);
    });

    it('should increment version', async () => {
      mockKV.get.mockResolvedValue('3');
      const newVer = await incrVersion(mockKV as any, 'test-id');
      expect(newVer).toBe(4);
      expect(mockKV.put).toHaveBeenCalledWith('material:v:test-id', '4');
    });
  });

  describe('getItem', () => {
    it('should return null for non-existent item', async () => {
      mockKV.get.mockResolvedValue(null);
      const item = await getItem(mockKV as any, 'test-id');
      expect(item).toBeNull();
    });

    it('should parse and return item', async () => {
      const testItem: MaterialItem = { id: 'test-id', name: 'Test', ext: 'txt', R2Key: 'key', size: 100, createTime: '2024-01-01', tags: [] };
      mockKV.get.mockResolvedValue(JSON.stringify(testItem));
      const item = await getItem(mockKV as any, 'test-id');
      expect(item).toEqual(testItem);
    });

    it('should return null for invalid JSON', async () => {
      mockKV.get.mockResolvedValue('invalid json');
      const item = await getItem(mockKV as any, 'test-id');
      expect(item).toBeNull();
    });
  });

  describe('putItem', () => {
    it('should store item and increment version', async () => {
      mockKV.get.mockResolvedValue('0'); // current version
      const testItem: MaterialItem = { id: 'test-id', name: 'Test', ext: 'txt', R2Key: 'key', size: 100, createTime: '2024-01-01', tags: [] };
      await putItem(mockKV as any, testItem);
      expect(mockKV.put).toHaveBeenCalledWith('material:test-id', JSON.stringify(testItem));
      expect(mockKV.put).toHaveBeenCalledWith('material:v:test-id', '1');
    });

    it('should throw ConflictError on version mismatch', async () => {
      mockKV.get.mockResolvedValue('5'); // current version is 5, but expected 3
      const testItem: MaterialItem = { id: 'test-id', name: 'Test', ext: 'txt', R2Key: 'key', size: 100, createTime: '2024-01-01', tags: [] };
      await expect(putItem(mockKV as any, testItem, 3)).rejects.toThrow('数据已被修改');
    });
  });

  describe('deleteItem', () => {
    it('should delete item and version key', async () => {
      mockKV.get.mockResolvedValue('1');
      await deleteItem(mockKV as any, 'test-id');
      expect(mockKV.delete).toHaveBeenCalledWith('material:test-id');
      expect(mockKV.delete).toHaveBeenCalledWith('material:v:test-id');
    });

    it('should throw ConflictError on version mismatch', async () => {
      mockKV.get.mockResolvedValue('5');
      await expect(deleteItem(mockKV as any, 'test-id', 3)).rejects.toThrow('数据已被修改');
    });
  });

  describe('getIdIndex / setIdIndex', () => {
    it('should return empty array for non-existent index', async () => {
      mockKV.get.mockResolvedValue(null);
      const ids = await getIdIndex(mockKV as any);
      expect(ids).toEqual([]);
    });

    it('should return parsed array', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify(['id1', 'id2']));
      const ids = await getIdIndex(mockKV as any);
      expect(ids).toEqual(['id1', 'id2']);
    });

    it('should handle invalid JSON', async () => {
      mockKV.get.mockResolvedValue('invalid');
      const ids = await getIdIndex(mockKV as any);
      expect(ids).toEqual([]);
    });

    it('should write index', async () => {
      await setIdIndex(mockKV as any, ['a', 'b']);
      expect(mockKV.put).toHaveBeenCalledWith('materials:ids', JSON.stringify(['a', 'b']));
    });
  });

  describe('appendToIndex / removeFromIndex', () => {
    it('should append id to index', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify(['id1']));
      await appendToIndex(mockKV as any, 'id2');
      expect(mockKV.put).toHaveBeenCalledWith('materials:ids', JSON.stringify(['id1', 'id2']));
    });

    it('should remove id from index', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify(['id1', 'id2', 'id3']));
      await removeFromIndex(mockKV as any, 'id2');
      expect(mockKV.put).toHaveBeenCalledWith('materials:ids', JSON.stringify(['id1', 'id3']));
    });
  });

  describe('getAllMaterials', () => {
    it('should return empty when no ids', async () => {
      mockKV.get.mockResolvedValue(null);
      const result = await getAllMaterials(mockKV as any);
      expect(result.items).toEqual([]);
      expect(result.versions.size).toBe(0);
    });

    it('should return all materials with versions', async () => {
      const items: MaterialItem[] = [
        { id: '1', name: 'File 1', ext: 'pdf', R2Key: 'k1', size: 100, createTime: '2024-01-01', tags: ['a'] },
        { id: '2', name: 'File 2', ext: 'jpg', R2Key: 'k2', size: 200, createTime: '2024-01-02', tags: ['b'] },
      ];
      mockKV.get
        .mockResolvedValueOnce(JSON.stringify(['1', '2'])) // getIdIndex
        .mockResolvedValueOnce(JSON.stringify(items[0])) // getItem 1
        .mockResolvedValueOnce('1') // getVersion 1
        .mockResolvedValueOnce(JSON.stringify(items[1])) // getItem 2
        .mockResolvedValueOnce('2'); // getVersion 2

      const result = await getAllMaterials(mockKV as any);
      expect(result.items).toHaveLength(2);
      expect(result.versions.get('1')).toBe(1);
      expect(result.versions.get('2')).toBe(2);
    });

    it('should filter out null items', async () => {
      mockKV.get
        .mockResolvedValueOnce(JSON.stringify(['1', '2']))
        .mockResolvedValueOnce(JSON.stringify({ id: '1', name: 'File 1', ext: 'pdf', R2Key: 'k1', size: 100, createTime: '2024-01-01', tags: [] }))
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce(null) // item 2 missing
        .mockResolvedValueOnce('2');

      const result = await getAllMaterials(mockKV as any);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('1');
    });
  });

  describe('addMaterial / removeMaterial', () => {
    it('should add material with putItem and appendToIndex', async () => {
      const testItem: MaterialItem = { id: 'test-id', name: 'Test', ext: 'txt', R2Key: 'key', size: 100, createTime: '2024-01-01', tags: [] };
      mockKV.get.mockResolvedValue('0');
      mockKV.get.mockResolvedValueOnce('0').mockResolvedValueOnce(JSON.stringify([])); // for appendToIndex

      await addMaterial(mockKV as any, testItem);
      expect(mockKV.put).toHaveBeenCalledWith('material:test-id', JSON.stringify(testItem));
      expect(mockKV.put).toHaveBeenCalledWith('materials:ids', JSON.stringify(['test-id']));
    });

    it('should remove material with deleteItem and removeFromIndex', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify(['id1', 'test-id', 'id3'])); // for removeFromIndex

      await removeMaterial(mockKV as any, 'test-id');
      expect(mockKV.delete).toHaveBeenCalledWith('material:test-id');
      expect(mockKV.delete).toHaveBeenCalledWith('material:v:test-id');
      expect(mockKV.put).toHaveBeenCalledWith('materials:ids', JSON.stringify(['id1', 'id3']));
    });
  });

  describe('migrateIfNeeded', () => {
    it('should skip when new index exists', async () => {
      mockKV.get.mockResolvedValueOnce(JSON.stringify(['existing']));
      await migrateIfNeeded(mockKV as any);
      expect(mockKV.put).not.toHaveBeenCalled();
    });

    it('should migrate from old format', async () => {
      const oldList = [
        { id: '1', name: 'Old 1', ext: 'txt', r2Key: 'k1', size: 100, createTime: '2024-01-01', tags: [] },
        { id: '2', name: 'Old 2', ext: 'pdf', r2Key: 'k2', size: 200, createTime: '2024-01-02', tags: ['pdf'] },
      ];
      mockKV.get
        .mockResolvedValueOnce(null) // getIdIndex returns empty
        .mockResolvedValueOnce(JSON.stringify(oldList)) // OLD_KEY
        .mockResolvedValue('0'); // getVersion for putItem 内部的 incrVersion

      await migrateIfNeeded(mockKV as any);

      expect(mockKV.put).toHaveBeenCalledWith('material:1', expect.stringContaining('"name":"Old 1"'));
      expect(mockKV.put).toHaveBeenCalledWith('material:2', expect.stringContaining('"name":"Old 2"'));
      expect(mockKV.put).toHaveBeenCalledWith('materials:ids', JSON.stringify(['1', '2']));
    });

    it('should handle migration errors gracefully', async () => {
      mockKV.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('invalid json');

      await migrateIfNeeded(mockKV as any);
      // Should not throw
    });
  });
});