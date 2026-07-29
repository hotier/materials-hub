import { Hono } from 'hono';
import type { Env } from '../types';
import { jsonError, getMime, getExt } from '../helpers';

const rawRoute = new Hono<{ Bindings: Env }>();

/**
 * GET /api/raw?key=xxx
 * 直接读取 R2 中的文件（用于内嵌预览图片/代码）
 */
rawRoute.get('/', async (c) => {
  const key = c.req.query('key');

  if (!key) return jsonError(c, 400, '缺少参数 key');

  const R2Object = await c.env.R2.get(key);
  if (!R2Object) {
    return jsonError(c, 404, '文件不存在');
  }

  const ext = getExt(key);
  const mime = getMime(ext);
  let contentType = R2Object.httpMetadata?.contentType || mime;

  if (
    !contentType.includes('charset') &&
    (contentType.startsWith('text/') ||
     contentType === 'application/json' ||
     contentType === 'application/javascript' ||
     contentType === 'application/xml')
  ) {
    contentType += '; charset=utf-8';
  }

  const body = await R2Object.arrayBuffer();

  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    },
  });
});

export default rawRoute;
