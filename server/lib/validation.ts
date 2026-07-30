/**
 * 输入验证 — Zod Schema 定义
 */

import { z } from 'zod';

/** 允许的文件扩展名 */
export const ALLOWED_EXTS = [
  'html', 'htm', 'jpg', 'jpeg', 'png', 'gif', 'svg',
  'webp', 'bmp', 'ico', 'json', 'txt', 'md', 'csv', 'xml',
  'css', 'js', 'ts', 'yaml', 'yml', 'log', 'sql', 'pdf',
  // Office 文档
  'doc', 'docx', 'docm', 'dotx', 'dotm', 'rtf',
  'xls', 'xlsx', 'xlsm', 'xltx', 'xlsb',
  'ppt', 'pptx', 'pptm', 'potx', 'ppsx',
  // 其他 Microsoft Office
  'vsd', 'vsdx', 'pub',
  // OpenDocument
  'odt', 'ods', 'odp', 'odg',
] as const;

export type FileExt = (typeof ALLOWED_EXTS)[number];

/** 标签 Schema */
const tagSchema = z.string().trim().min(1).max(30);

/** 上传请求 Schema */
export const uploadSchema = z.object({
  name: z.string().trim().min(1, '名称为必填项').max(60, '名称最多 60 个字符'),
  desc: z.string().trim().max(200, '描述最多 200 个字符').optional().default(''),
  tags: z.string().trim().optional().default(''),
});

/** 编辑请求 Schema */
export const editSchema = z.object({
  name: z.string().trim().min(1, '名称为必填项').max(60, '名称最多 60 个字符'),
  desc: z.string().trim().max(200, '描述最多 200 个字符').optional(),
  tags: z
    .union([z.array(z.string()), z.string()])
    .optional(),
});

/** 登录请求 Schema */
export const loginSchema = z.object({
  password: z.string().min(1, '密码不能为空'),
});

/** 同步请求 Schema（name 可选，不填则取文件名） */
export const syncMetadataSchema = z.object({
  name: z.string().trim().max(60).optional().default(''),
  desc: z.string().trim().max(200).optional().default(''),
  tags: z.string().trim().optional().default(''),
});

/** 文件名校验 */
export function validateFileExt(filename: string): FileExt | null {
  const idx = filename.lastIndexOf('.');
  const ext = idx > -1 ? filename.slice(idx + 1).toLowerCase() : '';
  return ALLOWED_EXTS.includes(ext as FileExt) ? (ext as FileExt) : null;
}

/** 文件大小校验（默认 10MB） */
export function validateFileSize(
  size: number,
  maxBytes = 10 * 1024 * 1024,
): boolean {
  return size > 0 && size <= maxBytes;
}

/** 解析标签字符串为数组 */
export function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}
