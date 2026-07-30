import { Hono } from 'hono';
import type { Env } from '../types';
import { getMaterialById, getMaterialFile } from '../services/material';
import { NotFoundError } from '../lib/errors';
import { jsonError } from '../helpers';

const previewRoute = new Hono<{ Bindings: Env }>();

/**
 * GET /api/preview?id=xxx&info=1
 * 获取产出内容或元数据
 */
previewRoute.get('/', async (c) => {
  const id = c.req.query('id');
  if (!id) return jsonError(c, 400, '缺少参数 id');

  // 元数据查询模式
  if (c.req.query('info') === '1') {
    try {
      const item = await getMaterialById(c.env, id.trim());
      return c.json(item);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.html(
          '<h2 style="padding:40px;text-align:center;color:#999">产出不存在</h2>',
          404,
        );
      }
      throw err;
    }
  }

  // 文件内容模式
  const result = await getMaterialFile(c.env, id.trim());
  if (!result) {
    return c.html(
      '<h2 style="padding:40px;text-align:center;color:#999">产出文件不存在</h2>',
      404,
    );
  }

  return new Response(result.body, {
    headers: {
      'Content-Type': result.contentType,
      'Cache-Control': 'public, max-age=300',
    },
  });
});

export default previewRoute;
