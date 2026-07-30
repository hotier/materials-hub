import { Hono } from 'hono';
import type { Env } from '../types';
import { editSchema } from '../lib/validation';
import { NotFoundError, ConflictError, AppError } from '../lib/errors';
import { updateMaterial, deleteMaterial, getMaterialById } from '../services/material';
import { jsonError } from '../helpers';
import { ZodError } from 'zod';

const itemRoute = new Hono<{ Bindings: Env }>();

/**
 * GET /api/item?id=xxx
 * 获取单个产出元数据（用于预览页）
 */
itemRoute.get('/', async (c) => {
  const id = c.req.query('id');
  if (!id) return jsonError(c, 400, '缺少参数 id');

  try {
    const item = await getMaterialById(c.env, id.trim());
    return c.json({ success: true, data: item });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return jsonError(c, 404, err.message);
    }
    throw err;
  }
});

/**
 * PUT /api/item?id=xxx
 * 编辑产出元数据（名称 / 描述 / 标签）
 * 支持 JSON body 或 form data
 */
itemRoute.put('/', async (c) => {
  const id = c.req.query('id');
  if (!id) return jsonError(c, 400, '缺少参数 id');

  // 解析请求体
  let raw: Record<string, unknown>;
  const ct = c.req.header('content-type') || '';
  if (ct.includes('application/json')) {
    raw = await c.req.json();
  } else {
    raw = await c.req.parseBody();
    // parseBody 可能返回带有数字 key 的多文件对象，过滤掉
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (isNaN(Number(k))) clean[k] = v;
    }
    raw = clean;
  }

  // Zod 校验
  let updates: { name: string; desc?: string; tags?: string[] };
  try {
    const parsed = editSchema.parse(raw);
    updates = {
      name: parsed.name,
      desc: parsed.desc,
      tags: Array.isArray(parsed.tags)
        ? parsed.tags
        : parsed.tags
          ? String(parsed.tags).split(',').map((t) => t.trim()).filter(Boolean)
          : undefined,
    };
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(c, 400, err.issues[0]?.message || '参数校验失败');
    }
    throw err;
  }

  try {
    const item = await updateMaterial(c.env, id.trim(), updates);
    return c.json({ success: true, item });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return jsonError(c, 404, err.message);
    }
    if (err instanceof ConflictError) {
      return jsonError(c, 409, err.message);
    }
    throw err;
  }
});

/**
 * DELETE /api/item?id=xxx
 * 删除产出：R2 文件 + KV 元数据
 */
itemRoute.delete('/', async (c) => {
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

export default itemRoute;
