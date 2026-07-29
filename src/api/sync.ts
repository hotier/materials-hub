import { Hono } from 'hono';
import type { Env, MaterialItem } from '../types';
import {
  getMaterialList, setMaterialList, jsonError,
  getExt, isAllowedExt, getMime, ALLOWED_EXTS, stripQuotes,
  getShanghaiDate,
} from '../helpers';

const syncRoute = new Hono<{ Bindings: Env }>();

/**
 * POST /api/sync
 * multipart/form-data: file + name? + desc? + tags?
 * name 不填则取文件名（不含扩展名）
 * Authorization: Bearer <SYNC_TOKEN>
 */
syncRoute.post('/', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return jsonError(c, 400, '缺少必要参数：file');
  }

  // name 不填则取文件名（不含扩展名）
  const rawName = (formData.get('name') as string)?.slice(0, 60) || '';
  const name = rawName
    ? stripQuotes(rawName)
    : stripQuotes(file.name.replace(/\.[^.]*$/, ''));
  const desc = stripQuotes((formData.get('desc') as string)?.slice(0, 200) || '');
  const tagsStr = stripQuotes((formData.get('tags') as string) || '');

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
  const datePrefix = getShanghaiDate().replace(/-/g, '/');
  const R2Key = `output/${datePrefix}/${id}-${safeName}`;

  const buffer = await file.arrayBuffer();
  await c.env.R2.put(R2Key, buffer, {
    httpMetadata: { contentType: getMime(ext) },
  });

  const item: MaterialItem = {
    id,
    name,
    desc,
    tags,
    ext,
    R2Key,
    createTime: getShanghaiDate(),
  };

  const list = await getMaterialList(c.env.KV);
  list.push(item);
  await setMaterialList(c.env.KV, list);

  const previewUrl = `${new URL(c.req.url).origin}/preview?id=${id}`;
  return c.json({ success: true, item, previewUrl });
});

/**
 * DELETE /api/sync?id=xxx
 * 命令行删除产出（复用 SYNC_TOKEN 认证）
 * Authorization: Bearer <SYNC_TOKEN>
 */
syncRoute.delete('/', async (c) => {
  const id = c.req.query('id');

  if (!id) return jsonError(c, 400, '缺少参数 id');

  const list = await getMaterialList(c.env.KV);
  const idx = list.findIndex((m: { id: string }) => m.id === id);

  if (idx === -1) {
    return jsonError(c, 404, '产出不存在');
  }

  const item = list[idx];

  // 删除 R2 文件（失败不阻塞）
  try {
    await c.env.R2.delete(item.R2Key);
  } catch (err) {
    console.warn('R2 delete warning:', (err as Error).message);
  }

  list.splice(idx, 1);
  await setMaterialList(c.env.KV, list);

  return c.json({ success: true, id });
});

export default syncRoute;
