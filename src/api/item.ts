import { Hono } from 'hono';
import type { Env } from '../types';
import { getMaterialList, setMaterialList, jsonError } from '../helpers';

const itemRoute = new Hono<{ Bindings: Env }>();

/**
 * DELETE /api/item?id=xxx
 * 删除产出：移除 R2 文件 + 更新 KV
 */
itemRoute.delete('/', async (c) => {
  const id = c.req.query('id');

  if (!id) return jsonError(c, 400, '缺少参数 id');

  const list = await getMaterialList(c.env.MATERIALS_KV);
  const idx = list.findIndex((m: { id: string }) => m.id === id);

  if (idx === -1) {
    return jsonError(c, 404, '产出不存在');
  }

  const item = list[idx];

  // 删除 R2 文件（失败不阻塞流程）
  try {
    await c.env.MATERIALS_BUCKET.delete(item.r2Key);
  } catch (err) {
    console.warn('R2 delete warning:', (err as Error).message);
  }

  // 更新 KV
  list.splice(idx, 1);
  await setMaterialList(c.env.MATERIALS_KV, list);

  return c.json({ success: true, id });
});

export default itemRoute;
