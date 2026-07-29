import { Hono } from 'hono';
import type { Env } from '../types';
import { getMaterialList } from '../helpers';

const listRoute = new Hono<{ Bindings: Env }>();

/**
 * GET /api/list
 * 返回完整产出清单 JSON
 */
listRoute.get('/', async (c) => {
  const list = await getMaterialList(c.env.KV);
  return c.json(list, 200, {
    'Cache-Control': 'public, max-age=30',
  });
});

export default listRoute;
