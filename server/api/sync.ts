import { Hono } from 'hono';
import type { Env } from '../types';
import { syncMetadataSchema } from '../lib/validation';
import { parseTags } from '../lib/validation';
import { ValidationError, NotFoundError } from '../lib/errors';
import { syncMaterial, deleteMaterial } from '../services/material';
import { jsonError, stripQuotes } from '../helpers';
import { ZodError } from 'zod';

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
