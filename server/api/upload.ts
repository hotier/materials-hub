import { Hono } from 'hono';
import type { Env } from '../types';
import { uploadSchema } from '../lib/validation';
import { parseTags } from '../lib/validation';
import { ValidationError } from '../lib/errors';
import { createMaterial } from '../services/material';
import { jsonError, stripQuotes } from '../helpers';
import { ZodError } from 'zod';

const uploadRoute = new Hono<{ Bindings: Env }>();

/**
 * POST /api/upload
 * 接收文件 → Zod 校验参数 → 上传至 R2 → 存储 KV 元数据
 */
uploadRoute.post('/', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const rawName = (formData.get('name') as string) || '';
  const rawDesc = (formData.get('desc') as string) || '';
  const rawTags = (formData.get('tags') as string) || '';
  const relativePath = (formData.get('relativePath') as string) || '';

  if (!file || file.size === 0) {
    return jsonError(c, 400, '缺少必要参数：file');
  }

  // Zod 校验元数据
  let metadata: { name: string; desc: string; tags: string };
  try {
    metadata = uploadSchema.parse({
      name: stripQuotes(rawName),
      desc: stripQuotes(rawDesc),
      tags: stripQuotes(rawTags),
    });
  } catch (err) {
    if (err instanceof ZodError) {
      const msg = err.issues[0]?.message || '参数校验失败';
      return jsonError(c, 400, msg);
    }
    throw err;
  }

  const origin = new URL(c.req.url).origin;
  const tags = parseTags(metadata.tags);

  try {
    const result = await createMaterial(
      c.env,
      file,
      { name: metadata.name, desc: metadata.desc, tags, relativePath },
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

export default uploadRoute;
