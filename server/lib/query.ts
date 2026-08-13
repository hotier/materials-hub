import type { MaterialItem } from '../types';

/** 查询参数 */
export interface ListQuery {
  /** 按扩展名过滤，支持多个逗号分隔，如 ext=pdf,md */
  ext?: string;
  /** 按标签过滤，支持多个逗号分隔（匹配任一），如 tag=doc,readme */
  tag?: string;
  /** 按相对路径前缀过滤，如 path=docs/2026 */
  path?: string;
  /** 按名称关键词搜索（不区分大小写，子串匹配） */
  q?: string;
  /** 分页：偏移量，默认 0 */
  offset?: number;
  /** 分页：每页数量，默认全部 */
  limit?: number;
  /**
   * 指定返回字段（逗号分隔），如 fields=id,name,ext,size
   * 支持的字段：id, name, desc, tags, ext, size, R2Key, createTime, relativePath
   */
  fields?: string;
  /** 排序字段，默认 createTime */
  sort?: 'createTime' | 'name' | 'size';
  /** 排序方向，默认 desc */
  order?: 'asc' | 'desc';
}

/** 对物料列表应用过滤、搜索、排序和分页 */
export function applyQuery(items: MaterialItem[], query: ListQuery): {
  items: MaterialItem[];
  total: number;
} {
  let result = items;

  // 1. 扩展名过滤
  if (query.ext) {
    const exts = query.ext.split(',').map((e) => e.trim().toLowerCase());
    if (exts.length) {
      result = result.filter((item) => exts.includes(item.ext.toLowerCase()));
    }
  }

  // 2. 标签过滤（匹配任一）
  if (query.tag) {
    const tags = query.tag.split(',').map((t) => t.trim().toLowerCase());
    if (tags.length) {
      result = result.filter((item) =>
        item.tags.some((t) => tags.includes(t.toLowerCase())),
      );
    }
  }

  // 3. 路径前缀过滤
  if (query.path) {
    const path = query.path.trim();
    result = result.filter(
      (item) => item.relativePath && item.relativePath.startsWith(path),
    );
  }

  // 4. 名称关键词搜索
  if (query.q) {
    const keyword = query.q.trim().toLowerCase();
    if (keyword) {
      result = result.filter((item) =>
        item.name.toLowerCase().includes(keyword),
      );
    }
  }

  // 5. 排序
  const sort = query.sort || 'createTime';
  const order = query.order === 'asc' ? 1 : -1;
  result = [...result].sort((a, b) => {
    let va: string | number = a[sort] ?? '';
    let vb: string | number = b[sort] ?? '';
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return -1 * order;
    if (va > vb) return 1 * order;
    return 0;
  });

  const total = result.length;

  // 6. 分页
  const offset = Math.max(0, query.offset || 0);
  if (query.limit !== undefined) {
    const limit = Math.max(1, Math.min(1000, query.limit));
    result = result.slice(offset, offset + limit);
  } else if (offset > 0) {
    result = result.slice(offset);
  }

  return { items: result, total };
}

/** 按 fields 参数裁剪返回对象 */
export function pickFields(
  item: MaterialItem,
  fieldsStr?: string,
): Record<string, unknown> {
  if (!fieldsStr) return item as unknown as Record<string, unknown>;

  const allowed = new Set(
    fieldsStr
      .split(',')
      .map((f) => f.trim())
      .filter((f) =>
        ['id', 'name', 'desc', 'tags', 'ext', 'size', 'R2Key', 'createTime', 'relativePath'].includes(f),
      ),
  );

  const result: Record<string, unknown> = {};
  for (const key of allowed) {
    result[key] = (item as unknown as Record<string, unknown>)[key];
  }
  return result;
}