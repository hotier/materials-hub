import { Hono } from 'hono';
import type { Env } from '../types';
import { getAllMaterials, getItem, putItem } from '../lib/kv-service';
import { getCategoryByExt } from '../lib/categories';
import { applyQuery, type ListQuery } from '../lib/query';

const listRoute = new Hono<{ Bindings: Env }>();

/**
 * GET /api/list
 * 返回产出清单（前端 Cookie 会话认证）
 * 支持过滤参数：ext, tag, path, q, offset, limit, sort, order
 */
listRoute.get('/', async (c) => {
  const { items: allItems, versions } = await getAllMaterials(c.env.KV);

  // 兼容历史记录：新上传已在元数据中持久化 size；旧记录按批次回填一次，
  // 避免后续每一次列表请求都对所有对象发起 R2 head。
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
        console.warn('[list] 回填文件大小失败:', item.id, err);
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
    sort: (c.req.query('sort') as ListQuery['sort']) || undefined,
    order: (c.req.query('order') as ListQuery['order']) || undefined,
  };

  const { items: filtered, total } = applyQuery(allItems, query);

  // 构建分类映射（基于全量数据）
  const cateMap: Record<string, number> = {};
  for (const item of allItems) {
    const cat = getCategoryByExt(item.ext);
    cateMap[cat] = (cateMap[cat] || 0) + 1;
  }

  return c.json({
    success: true,
    data: filtered,
    count: total,
    total,
    cateMap,
    items: filtered,
    versions: Object.fromEntries(versions),
  });
});

export default listRoute;
