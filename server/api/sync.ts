import { Hono } from 'hono';
import type { Env } from '../types';
import { syncMetadataSchema } from '../lib/validation';
import { parseTags } from '../lib/validation';
import { ValidationError, NotFoundError } from '../lib/errors';
import { syncMaterial, deleteMaterial } from '../services/material';
import { jsonError, stripQuotes } from '../helpers';
import { ZodError } from 'zod';
import { getAllMaterials, getItem, putItem } from '../lib/kv-service';
import { getCategoryByExt } from '../lib/categories';
import { applyQuery, pickFields, type ListQuery } from '../lib/query';

const syncRoute = new Hono<{ Bindings: Env }>();

/**
 * GET /api/sync
 * 返回产出清单（供外部脚本/API 查询）
 * 支持过滤参数：ext, tag, path, q, offset, limit, fields, sort, order
 * Authorization: Bearer <SYNC_TOKEN>
 */
syncRoute.get('/', async (c) => {
  const { items: allItems, versions } = await getAllMaterials(c.env.KV);

  // 回填旧记录的 size
  const legacyItems = allItems
    .filter((item) => typeof item.size !== 'number')
    .slice(0, 20);
  await Promise.all(
    legacyItems.map(async (item) => {
      try {
        const obj = await c.env.R2.head(item.R2Key);
        if (!obj) return;
        item.size = obj.size;
        const latest = await getItem(c.env.KV, item.id);
        if (latest && typeof latest.size !== 'number') {
          await putItem(c.env.KV, { ...latest, size: obj.size });
        }
      } catch (err) {
        console.warn('[sync] 回填文件大小失败:', item.id, err);
      }
    }),
  );

  // 解析查询参数
  const query: ListQuery = {
    ext: c.req.query('ext') || undefined,
    tag: c.req.query('tag') || undefined,
    path: c.req.query('path') || undefined,
    q: c.req.query('q') || undefined,
    offset: c.req.query('offset') ? parseInt(c.req.query('offset')!, 10) : undefined,
    limit: c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : undefined,
    fields: c.req.query('fields') || undefined,
    sort: (c.req.query('sort') as ListQuery['sort']) || undefined,
    order: (c.req.query('order') as ListQuery['order']) || undefined,
  };

  const { items: filtered, total } = applyQuery(allItems, query);

  // 构建分类映射（基于全量数据，不受过滤影响）
  const cateMap: Record<string, number> = {};
  for (const item of allItems) {
    const cat = getCategoryByExt(item.ext);
    cateMap[cat] = (cateMap[cat] || 0) + 1;
  }

  // 按 fields 裁剪
  const items = query.fields
    ? filtered.map((item) => pickFields(item, query.fields))
    : filtered;

  return c.json({
    success: true,
    data: items,
    count: total,
    total,
    cateMap,
    items,
    versions: Object.fromEntries(versions),
  });
});

/**
 * POST /api/sync
 * multipart/form-data: file + name? + desc? + tags?
 * name 不填则取文件名（不含扩展名）
 * Authorization: Bearer <SYNC_TOKEN>
 */
syncRoute.post('/', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;

  if (!file || file.size === 0) {
    return jsonError(c, 400, '缺少必要参数：file');
  }

  const rawName = (formData.get('name') as string) || '';
  const rawDesc = (formData.get('desc') as string) || '';
  const rawTags = (formData.get('tags') as string) || '';

  // Zod 校验元数据
  let metadata: { name: string; desc: string; tags: string };
  try {
    metadata = syncMetadataSchema.parse({
      name: stripQuotes(rawName),
      desc: stripQuotes(rawDesc),
      tags: stripQuotes(rawTags),
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(c, 400, err.issues[0]?.message || '参数校验失败');
    }
    throw err;
  }

  const origin = new URL(c.req.url).origin;
  const tags = parseTags(metadata.tags);

  try {
    const result = await syncMaterial(
      c.env,
      file,
      { name: metadata.name, desc: metadata.desc, tags },
      origin,
    );
    return c.json(result);
  } catch (err) {
    if (err instanceof ValidationError) {
      return jsonError(c, 400, err.message);
    }
    throw err;
  }
});

/**
 * DELETE /api/sync?id=xxx
 * 命令行删除产出（复用 SYNC_TOKEN 认证）
 * Authorization: Bearer <SYNC_TOKEN>
 */
syncRoute.delete('/', async (c) => {
  const id = c.req.query('id');
  if (!id) return jsonError(c, 400, '缺少参数 id');

  try {
    await deleteMaterial(c.env, id.trim());
    return c.json({ success: true, id: id.trim() });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return jsonError(c, 404, err.message);
    }
    throw err;
  }
});

export default syncRoute;
