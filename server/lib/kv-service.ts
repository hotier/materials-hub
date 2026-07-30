/**
 * KV 存储抽象层
 *
 * 架构改进：从单 Key 大 JSON 改为 per-item Key + 索引列表
 * - material:<id>  → 每个产出的完整元数据
 * - materials:ids   → 有序 ID 列表（仅存 ID 数组，极轻量）
 *
 * 优势：
 * 1. 突破单 Key 128KB/25MB 限制
 * 2. 更新单条数据只需写 2 个 Key（item + index）
 * 3. 支持乐观锁防止并发覆盖
 */

import type { MaterialItem } from '../types';
import { ConflictError } from './errors';

const INDEX_KEY = 'materials:ids';
const ITEM_PREFIX = 'material:';
const ITEM_VERSION_PREFIX = 'material:v:';

/** 生成带前缀的 item key */
function itemKey(id: string) {
  return `${ITEM_PREFIX}${id}`;
}

/** 生成版本号 key */
function versionKey(id: string) {
  return `${ITEM_VERSION_PREFIX}${id}`;
}

/** 路由键 /kv-k 参数 */
export function extractKVId(c: { req: { query: (k: string) => string | undefined } }): string | null {
  const id = c.req.query('id');
  return id ? id.trim() : null;
}

/** 构建预览 URL */
export function buildPreviewUrl(origin: string, id: string): string {
  return `${origin}/preview?id=${id}`;
}

/** 获取版本号 */
export async function getVersion(KV: KVNamespace, id: string): Promise<number> {
  const raw = await KV.get(versionKey(id));
  return raw ? parseInt(raw, 10) : 0;
}

/** 递增版本号（返回新版本号） */
async function incrVersion(KV: KVNamespace, id: string): Promise<number> {
  const newVer = (await getVersion(KV, id)) + 1;
  await KV.put(versionKey(id), String(newVer));
  return newVer;
}

/** 读取单个产出 */
export async function getItem(
  KV: KVNamespace,
  id: string,
): Promise<MaterialItem | null> {
  const raw = await KV.get(itemKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MaterialItem;
  } catch {
    return null;
  }
}

/** 写入单个产出（带乐观锁检查） */
export async function putItem(
  KV: KVNamespace,
  item: MaterialItem,
  expectedVersion?: number,
): Promise<void> {
  if (expectedVersion !== undefined) {
    const currentVer = await getVersion(KV, item.id);
    if (currentVer !== expectedVersion) {
      throw new ConflictError();
    }
  }

  // 先写数据再写索引（减少不一致窗口）
  await KV.put(itemKey(item.id), JSON.stringify(item));
  await incrVersion(KV, item.id);
}

/** 删除单个产出 */
export async function deleteItem(
  KV: KVNamespace,
  id: string,
  expectedVersion?: number,
): Promise<void> {
  if (expectedVersion !== undefined) {
    const currentVer = await getVersion(KV, id);
    if (currentVer !== expectedVersion) {
      throw new ConflictError();
    }
  }

  await KV.delete(itemKey(id));
  await KV.delete(versionKey(id));
}

/** 获取全部产出 ID 索引 */
export async function getIdIndex(KV: KVNamespace): Promise<string[]> {
  const raw = await KV.get(INDEX_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** 写入 ID 索引 */
async function setIdIndex(KV: KVNamespace, ids: string[]): Promise<void> {
  await KV.put(INDEX_KEY, JSON.stringify(ids));
}

/** 添加产出 ID 到索引末尾 */
export async function appendToIndex(KV: KVNamespace, id: string): Promise<void> {
  const ids = await getIdIndex(KV);
  ids.push(id);
  await setIdIndex(KV, ids);
}

/** 从索引中移除产出 ID */
export async function removeFromIndex(KV: KVNamespace, id: string): Promise<void> {
  const ids = await getIdIndex(KV);
  await setIdIndex(KV, ids.filter((i) => i !== id));
}

/** 获取全部产出列表（带版本号的批量读取） */
export async function getAllMaterials(
  KV: KVNamespace,
): Promise<{ items: MaterialItem[]; versions: Map<string, number> }> {
  const ids = await getIdIndex(KV);
  if (ids.length === 0) return { items: [], versions: new Map() };

  // 并行读取所有产出
  const results = await Promise.all(
    ids.map(async (id) => {
      const [item, ver] = await Promise.all([
        getItem(KV, id),
        getVersion(KV, id),
      ]);
      return { id, item, ver };
    }),
  );

  const items: MaterialItem[] = [];
  const versions = new Map<string, number>();
  for (const { id, item, ver } of results) {
    if (item) {
      items.push(item);
      versions.set(id, ver);
    }
  }

  return { items, versions };
}

/** 添加产出（数据 + 索引） */
export async function addMaterial(
  KV: KVNamespace,
  item: MaterialItem,
): Promise<void> {
  await putItem(KV, item);
  await appendToIndex(KV, item.id);
}

/** 删除产出（数据 + 索引） */
export async function removeMaterial(
  KV: KVNamespace,
  id: string,
): Promise<void> {
  await deleteItem(KV, id);
  await removeFromIndex(KV, id);
}

/**
 * 从旧的单 Key 格式迁移到新的 per-item 格式（兼容旧数据）
 * 仅在有旧数据且新索引为空时执行
 */
export async function migrateIfNeeded(KV: KVNamespace): Promise<void> {
  const newIds = await getIdIndex(KV);
  if (newIds.length > 0) return; // 已迁移

  const OLD_KEY = 'materials:list';
  const raw = await KV.get(OLD_KEY);
  if (!raw) return;

  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) return;

    console.log(`[migrate] 开始迁移 ${list.length} 条旧数据…`);

    const ids: string[] = [];
    for (const item of list as (MaterialItem & { r2Key?: string })[]) {
      const normalized: MaterialItem = {
        ...item,
        R2Key: (item as MaterialItem).R2Key || (item as { r2Key?: string }).r2Key || '',
      };
      await putItem(KV, normalized);
      ids.push(normalized.id);
    }

    await setIdIndex(KV, ids);
    console.log(`[migrate] 迁移完成，共 ${ids.length} 条`);
  } catch (err) {
    console.error('[migrate] 迁移失败:', err);
  }
}
