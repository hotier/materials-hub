/**
 * R2 文件操作服务
 */

import type { FileExt } from '../lib/validation';
import { getMime } from '../helpers';

/** 清洗目录路径片段 */
export function sanitizeRelPath(p: string): string {
  return p
    .replace(/\\/g, '/')
    .split('/')
    .map((s) => s.replace(/[^a-zA-Z0-9._-]/g, '_'))
    .filter((s) => s && s !== '.' && s !== '..')
    .join('/');
}

/** 生成唯一 ID（32 位字母数字混合） */
export function generateId(): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let id = '';
  for (let i = 0; i < 32; i++) {
    id += chars[bytes[i] % chars.length];
  }
  return id;
}

/** 构建 R2 存储 Key，格式：output/<date>/<id>.<ext> */
export function buildR2Key(
  filename: string,
  datePrefix: string,
  id: string,
  relativePath?: string,
): string {
  const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.') + 1).toLowerCase() : '';

  if (relativePath) {
    const dirPart = sanitizeRelPath(relativePath);
    return `output/${datePrefix}/${dirPart}/${id}.${ext}`;
  }

  return `output/${datePrefix}/${id}.${ext}`;
}

/** 上传文件到 R2 */
export async function uploadToR2(
  R2: R2Bucket,
  key: string,
  buffer: ArrayBuffer,
  ext: FileExt,
): Promise<void> {
  const contentType = getMime(ext);
  await R2.put(key, buffer, {
    httpMetadata: { contentType },
  });
}

/** 从 R2 读取文件 */
export async function getFromR2(
  R2: R2Bucket,
  key: string,
): Promise<R2ObjectBody | null> {
  return R2.get(key);
}

/** 从 R2 删除文件（静默失败） */
export async function deleteFromR2(R2: R2Bucket, key: string): Promise<void> {
  try {
    await R2.delete(key);
  } catch (err) {
    console.warn('[R2] 删除失败:', key, (err as Error).message);
  }
}
