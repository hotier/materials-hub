import { Hono } from 'hono';
import type { Env, MaterialItem } from '../types';
import {
  getMaterialList, setMaterialList, jsonError,
  getExt, isAllowedExt, getMime, ALLOWED_EXTS, stripQuotes,
} from '../helpers';

const uploadRoute = new Hono<{ Bindings: Env }>();

/**
 * POST /api/upload
 * 接收任意支持格式的文件 → 上传至 R2 → 更新 KV 元数据
 */
uploadRoute.post('/', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const name = stripQuotes((formData.get('name') as string)?.slice(0, 60) || '');
  const desc = stripQuotes((formData.get('desc') as string)?.slice(0, 200) || '');
  const tagsStr = stripQuotes((formData.get('tags') as string) || '');

  // 参数校验
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

  // 生成唯一 ID 和安全的 R2 路径（按年月日归档）
  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
  const r2Key = `output/${datePrefix}/${id}-${safeName}`;

  // 上传 R2
  const buffer = await file.arrayBuffer();
  await c.env.MATERIALS_BUCKET.put(r2Key, buffer, {
    httpMetadata: { contentType: getMime(ext) },
  });

  // 构建元数据
  const item: MaterialItem = {
    id,
    name,
    desc,
    tags,
    ext,
    r2Key,
    createTime: new Date().toISOString().slice(0, 10),
  };

  // 更新 KV
  const list = await getMaterialList(c.env.MATERIALS_KV);
  list.push(item);
  await setMaterialList(c.env.MATERIALS_KV, list);

  return c.json({ success: true, item });
});

export default uploadRoute;
