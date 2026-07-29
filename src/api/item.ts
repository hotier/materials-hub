import { Hono } from 'hono';
import type { Env } from '../types';
import { getMaterialList, setMaterialList, jsonError } from '../helpers';

const itemRoute = new Hono<{ Bindings: Env }>();

/**
 * PUT /api/item?id=xxx
 * 编辑产出（名称 / 描述 / 标签）
 */
itemRoute.put('/', async (c) => {
  const id = c.req.query('id');
  let name = '';
  let desc: string | undefined;
  let tags: string[] | undefined;

  // 支持 JSON body 或 form data
  const ct = c.req.header('content-type') || '';
  if (ct.includes('application/json')) {
    const body = await c.req.json();
    name = body.name || '';
    if (body.desc !== undefined) desc = body.desc ?? '';
    if (body.tags !== undefined) {
      tags = Array.isArray(body.tags)
        ? body.tags
        : String(body.tags).split(',').map((t: string) => t.trim()).filter(Boolean);
    }
  } else {
    const body = await c.req.parseBody();
    name = (body.name as string) || '';
    if (body.desc !== undefined) desc = (body.desc as string) ?? '';
    const tagsStr = body.tags as string | undefined;
    if (tagsStr !== undefined) {
      tags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);
    }
  }

  if (!id) return jsonError(c, 400, '缺少参数 id');
  if (!name) return jsonError(c, 400, '名称不能为空');

  const list = await getMaterialList(c.env.KV);
  const idx = list.findIndex((m: { id: string }) => m.id === id);

  if (idx === -1) return jsonError(c, 404, '产出不存在');

  list[idx].name = name;
  if (desc !== undefined) list[idx].desc = desc;
  if (tags !== undefined) list[idx].tags = tags;

  await setMaterialList(c.env.KV, list);

  return c.json({ success: true, item: list[idx] });
});

/**
 * DELETE /api/item?id=xxx
 * 删除产出：移除 R2 文件 + 更新 KV
 */
itemRoute.delete('/', async (c) => {
  const id = c.req.query('id');

  if (!id) return jsonError(c, 400, '缺少参数 id');

  const list = await getMaterialList(c.env.KV);
  const idx = list.findIndex((m: { id: string }) => m.id === id);

  if (idx === -1) {
    return jsonError(c, 404, '产出不存在');
  }

  const item = list[idx];

  // 删除 R2 文件（失败不阻塞流程）
  try {
    await c.env.R2.delete(item.R2Key);
  } catch (err) {
    console.warn('R2 delete warning:', (err as Error).message);
  }

  // 更新 KV
  list.splice(idx, 1);
  await setMaterialList(c.env.KV, list);

  return c.json({ success: true, id });
});

export default itemRoute;
