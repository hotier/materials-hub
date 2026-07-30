import { Hono } from 'hono';
import type { Env } from '../types';
import { getFileByKey } from '../services/material';
import { jsonError } from '../helpers';

const rawRoute = new Hono<{ Bindings: Env }>();

/**
 * GET /api/raw?key=xxx
 * 直接读取 R2 中的文件（用于内嵌预览图片/代码）
 */
rawRoute.get('/', async (c) => {
  const key = c.req.query('key');
  if (!key) return jsonError(c, 400, '缺少参数 key');

  const result = await getFileByKey(c.env, key);
  if (!result) {
    return jsonError(c, 404, '文件不存在');
  }

  return new Response(result.body, {
    headers: {
      'Content-Type': result.contentType,
      'Cache-Control': 'public, max-age=3600',
    },
  });
});

export default rawRoute;
