/**
 * 产出业务逻辑 Service 层
 */

import type { Env, MaterialItem } from '../types';
import type { FileExt } from '../lib/validation';
import { ValidationError, NotFoundError, AppError } from '../lib/errors';
import { validateFileExt, validateFileSize } from '../lib/validation';
import {
  getItem,
  getAllMaterials,
  addMaterial,
  removeMaterial,
  putItem,
  buildPreviewUrl,
  getVersion,
} from '../lib/kv-service';
import {
  buildR2Key,
  uploadToR2,
  getFromR2,
  deleteFromR2,
  generateId,
} from './r2';
import { getShanghaiDate, getMime } from '../helpers';

// ===== Create =====

/** 上传产出 */
export async function createMaterial(
  env: Env,
  file: File,
  metadata: { name: string; desc: string; tags: string[]; relativePath?: string },
  origin: string,
): Promise<{ item: MaterialItem; previewUrl: string }> {
  const ext = validateFileExt(file.name);
  if (!ext) throw new ValidationError('不支持的文件格式，仅支持: doc/docx/xls/xlsx/ppt/pptx/pdf/html/jpg/png/gif/svg/txt/md/json/csv/xml/yaml/css/js/ts 等');
  if (!validateFileSize(file.size)) throw new ValidationError('文件大小不能超过 10MB');

  const id = generateId();
  const datePrefix = getShanghaiDate().replace(/-/g, '/');
  const R2Key = buildR2Key(file.name, datePrefix, id, metadata.relativePath);

  const buffer = await file.arrayBuffer();
  await uploadToR2(env.R2, R2Key, buffer, ext);

  const item: MaterialItem = {
    id,
    name: metadata.name,
    desc: metadata.desc || undefined,
    tags: metadata.tags,
    ext,
    R2Key,
    createTime: getShanghaiDate(),
  };

  await addMaterial(env.KV, item);

  const previewUrl = buildPreviewUrl(origin, id);
  return { item, previewUrl };
}

/** 同步上传产出 */
export async function syncMaterial(
  env: Env,
  file: File,
  metadata: { name: string; desc: string; tags: string[] },
  origin: string,
): Promise<{ item: MaterialItem; previewUrl: string }> {
  const ext = validateFileExt(file.name);
  if (!ext) throw new ValidationError('不支持的文件格式');
  if (!validateFileSize(file.size)) throw new ValidationError('文件大小不能超过 10MB');

  const name = metadata.name || file.name.replace(/\.[^.]*$/, '');
  const id = crypto.randomUUID();
  const datePrefix = getShanghaiDate().replace(/-/g, '/');
  const R2Key = buildR2Key(file.name, datePrefix, id);

  const buffer = await file.arrayBuffer();
  await uploadToR2(env.R2, R2Key, buffer, ext);

  const item: MaterialItem = {
    id,
    name,
    desc: metadata.desc || undefined,
    tags: metadata.tags,
    ext,
    R2Key,
    createTime: getShanghaiDate(),
  };

  await addMaterial(env.KV, item);

  const previewUrl = buildPreviewUrl(origin, id);
  return { item, previewUrl };
}

// ===== Read =====

/** 获取产出列表 */
export async function listMaterials(env: Env): Promise<MaterialItem[]> {
  const { items } = await getAllMaterials(env.KV);
  return items;
}

/** 根据 ID 获取产出元数据 */
export async function getMaterialById(env: Env, id: string): Promise<MaterialItem> {
  const item = await getItem(env.KV, id);
  if (!item) throw new NotFoundError('产出');
  return item;
}

// ===== Update =====

/** 编辑产出元数据（含乐观锁） */
export async function updateMaterial(
  env: Env,
  id: string,
  updates: { name: string; desc?: string; tags?: string[] },
): Promise<MaterialItem> {
  const item = await getItem(env.KV, id);
  if (!item) throw new NotFoundError('产出');

  const currentVer = await getVersion(env.KV, id);

  item.name = updates.name;
  if (updates.desc !== undefined) item.desc = updates.desc;
  if (updates.tags !== undefined) item.tags = updates.tags;

  await putItem(env.KV, item, currentVer);
  return item;
}

// ===== Delete =====

/** 删除产出（R2 文件 + KV 元数据） */
export async function deleteMaterial(env: Env, id: string): Promise<void> {
  const item = await getItem(env.KV, id);
  if (!item) throw new NotFoundError('产出');

  await deleteFromR2(env.R2, item.R2Key);
  await removeMaterial(env.KV, id);
}

// ===== File Access =====

/** 从 R2 读取产出文件内容（用于预览/原始下载） */
export async function getMaterialFile(
  env: Env,
  id: string,
): Promise<{ body: ArrayBuffer; contentType: string; item: MaterialItem } | null> {
  const item = await getItem(env.KV, id);
  if (!item) return null;

  const obj = await getFromR2(env.R2, item.R2Key);
  if (!obj) return null;

  let contentType = obj.httpMetadata?.contentType ||
    getMime(item.ext as FileExt) ||
    'application/octet-stream';

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

  const body = await obj.arrayBuffer();
  return { body, contentType, item };
}

/** 通过 R2 key 直接读取文件 */
export async function getFileByKey(
  env: Env,
  key: string,
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  const obj = await getFromR2(env.R2, key);
  if (!obj) return null;

  const ext = key.includes('.') ? key.slice(key.lastIndexOf('.') + 1).toLowerCase() : '';

  let contentType = obj.httpMetadata?.contentType ||
    getMime(ext) ||
    'application/octet-stream';

  if (
    !contentType.includes('charset') &&
    (contentType.startsWith('text/') ||
      contentType === 'application/json' ||
      contentType === 'application/javascript' ||
      contentType === 'application/xml')
  ) {
    contentType += '; charset=utf-8';
  }

  const body = await obj.arrayBuffer();
  return { body, contentType };
}
