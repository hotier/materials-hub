import { Hono } from 'hono';
import type { Env, MaterialItem } from '../types';
import {
  getMaterialList, setMaterialList, jsonError,
  getExt, isAllowedExt, getMime, ALLOWED_EXTS, stripQuotes,
} from '../helpers';

const syncRoute = new Hono<{ Bindings: Env }>();

/**
 * POST /api/sync
 * multipart/form-data: file + name + desc? + tags?
 * Authorization: Bearer <SYNC_TOKEN>
 */
syncRoute.post('/', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const name = stripQuotes((formData.get('name') as string)?.slice(0, 60) || '');
  const desc = stripQuotes((formData.get('desc') as string)?.slice(0, 200) || '');
  const tagsStr = stripQuotes((formData.get('tags') as string) || '');

  if (!file || !name) {
    return jsonError(c, 400, '缺少必要参数：file 和 name');
  }

  const ext = getExt(file.name);
  if (!ext || !isAllowedExt(ext)) {
    return jsonError(c, 400, `不支持的文件格式，允许：${ALLOWED_EXTS.join(', ')}`);
  }

  if (file.size > 10 * 1024 * 1024) {
    return jsonError(c, 400, '文件大小不能超过 10MB');
  }

  const tags = tagsStr
    ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
  const r2Key = `output/${datePrefix}/${id}-${safeName}`;

  const buffer = await file.arrayBuffer();
  await c.env.MATERIALS_BUCKET.put(r2Key, buffer, {
    httpMetadata: { contentType: getMime(ext) },
  });

  const item: MaterialItem = {
    id,
    name,
    desc,
    tags,
    ext,
    r2Key,
    createTime: new Date().toISOString().slice(0, 10),
  };

  const list = await getMaterialList(c.env.MATERIALS_KV);
  list.push(item);
  await setMaterialList(c.env.MATERIALS_KV, list);

  return c.json({ success: true, item });
});

/**
 * DELETE /api/sync?id=xxx
 * 命令行删除产出（复用 SYNC_TOKEN 认证）
 * Authorization: Bearer <SYNC_TOKEN>
 */
syncRoute.delete('/', async (c) => {
  const id = c.req.query('id');

  if (!id) return jsonError(c, 400, '缺少参数 id');

  const list = await getMaterialList(c.env.MATERIALS_KV);
  const idx = list.findIndex((m: { id: string }) => m.id === id);

  if (idx === -1) {
    return jsonError(c, 404, '产出不存在');
  }

  const item = list[idx];

  // 删除 R2 文件（失败不阻塞）
  try {
    await c.env.MATERIALS_BUCKET.delete(item.r2Key);
  } catch (err) {
    console.warn('R2 delete warning:', (err as Error).message);
  }

  list.splice(idx, 1);
  await setMaterialList(c.env.MATERIALS_KV, list);

  return c.json({ success: true, id });
});

export default syncRoute;
