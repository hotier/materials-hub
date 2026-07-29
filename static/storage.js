// ========================================
//   产出导航站 — 本地缓存 + 异步更新
//   策略：stale-while-revalidate
//   - 首次访问：展示缓存（若有），后台拉取最新数据
//   - 缓存 60 秒内视为新鲜，直接使用不请求
// ========================================

const STORAGE_PREFIX = 'mh:v1';
const FRESH_DURATION = 60 * 1000; // 60 秒内数据视为新鲜

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || !parsed) return null;
    return parsed;
  } catch { return null; }
}

function cacheSet(key, value) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}:${key}`, JSON.stringify(value));
  } catch { /* quota exceeded, ignore */ }
}

function cacheRemove(key) {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}:${key}`);
  } catch { /* ignore */ }
}

/**
 * 从缓存读取材料列表以立即渲染
 * @returns {{ data: Array|null, fresh: boolean }} data 可能为 null（无缓存）
 */
function getCachedList() {
  const entry = cacheGet('list');
  if (!entry || !Array.isArray(entry.data)) return { data: null, fresh: false };
  const fresh = entry.ts && (Date.now() - entry.ts < FRESH_DURATION);
  return { data: entry.data, fresh };
}

/**
 * 缓存材料列表
 */
function setCachedList(data) {
  cacheSet('list', { data, ts: Date.now() });
}

/**
 * 使材料列表缓存失效（上传/编辑/删除后调用）
 */
function invalidateListCache() {
  cacheRemove('list');
}

/**
 * 缓存单条产出元数据（供 preview.html 快速读）
 */
function cacheItem(id, item) {
  cacheSet(`item:${id}`, { data: item, ts: Date.now() });
}

/**
 * 读取单条缓存的产出
 */
function getCachedItem(id) {
  const entry = cacheGet(`item:${id}`);
  if (!entry || !entry.data) return null;
  return entry.data;
}
