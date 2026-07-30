import { Hono } from 'hono';
import type { Env } from '../types';
import { getAllMaterials, getItem, putItem } from '../lib/kv-service';
import type { ListResponse, MaterialItem } from '../types';

const listRoute = new Hono<{ Bindings: Env }>();

/**
 * GET /api/list
 * 返回完整产出清单
 * 兼容前端旧格式：{ success, data, count, cateMap }
 * 同时保留新格式：{ items, versions }
 */
listRoute.get('/', async (c) => {
  const { items, versions } = await getAllMaterials(c.env.KV);

  // 兼容历史记录：新上传已在元数据中持久化 size；旧记录按批次回填一次，
  // 避免后续每一次列表请求都对所有对象发起 R2 head。
  const legacyItems = items
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

  // 构建分类映射（按扩展名分组）
  const cateMap: Record<string, number> = {};
  for (const item of items) {
    const cat = getCategoryByExt(item.ext);
    cateMap[cat] = (cateMap[cat] || 0) + 1;
  }

  return c.json({
    success: true,
    data: items,
    count: items.length,
    cateMap,
    items,      // 新格式
    versions: Object.fromEntries(versions),  // 新格式（乐观锁）
  });
});

/** 扩展名 → 展示分类 */
function getCategoryByExt(ext: string): string {
  const map: Record<string, string> = {
    html: '网页', htm: '网页',
    jpg: '图片', jpeg: '图片', png: '图片', gif: '图片', svg: '图片', webp: '图片', bmp: '图片', ico: '图标',
    pdf: '文档', doc: '文档', docx: '文档', xls: '文档', xlsx: '文档', ppt: '文档', pptx: '文档',
    txt: '文本', md: '文本', csv: '文本', xml: '文本', yaml: '文本', yml: '文本', log: '文本',
    json: '数据', sql: '数据',
    css: '代码', js: '代码', ts: '代码',
  };
  return map[ext.toLowerCase()] || '其他';
}

export default listRoute;
