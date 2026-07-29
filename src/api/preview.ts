import { Hono } from 'hono';
import type { Env } from '../types';
import { getMaterialList, jsonError, getMime, getExt } from '../helpers';

const previewRoute = new Hono<{ Bindings: Env }>();

/**
 * GET /api/preview?id=xxx
 * 代理读取 R2 中的文件，根据扩展名返回正确的 Content-Type
 */
previewRoute.get('/', async (c) => {
  const id = c.req.query('id');

  if (!id) return jsonError(c, 400, '缺少参数 id');

  // 从 KV 查找产出
  const list = await getMaterialList(c.env.KV);
  const item = list.find((m: { id: string }) => m.id === id);

  if (!item) {
    return c.html('<h2 style="padding:40px;text-align:center;color:#999">产出不存在</h2>', 404);
  }

  // 从 R2 读取
  const R2Object = await c.env.R2.get(item.R2Key);
  if (!R2Object) {
    return c.html('<h2 style="padding:40px;text-align:center;color:#999">产出文件不存在</h2>', 404);
  }

  // 根据扩展名取 MIME 兜底 R2 对象的 Content-Type
  const ext = (item.ext as string) || getExt(item.R2Key as string);
  const mime = getMime(ext);
  let contentType = R2Object.httpMetadata?.contentType || mime;

  // 文本类文件补充 charset=utf-8，避免新窗口/下载乱码
  if (
    !contentType.includes('charset') &&
    (contentType.startsWith('text/') ||
     contentType === 'application/json' ||
     contentType === 'application/javascript' ||
     contentType === 'application/typescript' ||
     contentType === 'application/xml')
  ) {
    contentType += '; charset=utf-8';
  }

  // 二进制内容走 c.body，文本内容也可直接返回
  const body = await R2Object.arrayBuffer();

  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=300',
    },
  });
});

export default previewRoute;
