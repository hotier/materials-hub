import { Hono } from 'hono';
import type { Env } from '../types';
import { getItem } from '../lib/kv-service';
import { jsonError } from '../helpers';

const downloadRoute = new Hono<{ Bindings: Env }>();

/**
 * GET /api/download?id=xxx
 * 下载文件（需 Cookie 认证，返回 Content-Disposition: attachment）
 */
downloadRoute.get('/', async (c) => {
  const id = c.req.query('id');
  if (!id) return jsonError(c, 400, '缺少参数 id');

  const item = await getItem(c.env.KV, id);
  if (!item) return jsonError(c, 404, '文件不存在');

  const obj = await c.env.R2.get(item.R2Key);
  if (!obj) return jsonError(c, 404, '文件不存在');

  const filename = `${item.name}${item.ext ? '.' + item.ext : ''}`;
  const ext = item.ext ? '.' + item.ext : '';

  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="download${ext}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'private, no-store',
    },
  });
});

export default downloadRoute;