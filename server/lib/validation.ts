/**
 * 输入验证 — Zod Schema 定义
 */

import { z } from 'zod';

/**
 * 禁止上传的危险文件扩展名（可执行文件、脚本等）
 * 这些文件可能包含恶意代码，不应允许上传
 */
export const BLOCKED_EXTS = [
  // Windows 可执行文件
  'exe', 'bat', 'cmd', 'com', 'scr', 'pif', 'msi', 'msp', 'hta',
  // Windows 脚本/快捷方式
  'vbs', 'wsf', 'cpl', 'inf', 'reg', 'ins',
  // macOS
  'app', 'dmg', 'pkg',
  // Linux / 移动端
  'deb', 'rpm', 'apk',
  // Java
  'jar', 'war', 'ear',
  // 其他危险类型
  'ps1', 'ps2', 'psc1', 'msc', 'lnk',
] as const;

export type FileExt = string;

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

/**
 * 从文件名提取扩展名（小写），并校验是否在黑名单中
 * @returns 扩展名（小写），如果扩展名被禁止则返回 null
 */
export function validateFileExt(filename: string): FileExt | null {
  const idx = filename.lastIndexOf('.');
  const ext = idx > -1 ? filename.slice(idx + 1).toLowerCase() : '';
  if (!ext) return null;
  if ((BLOCKED_EXTS as readonly string[]).includes(ext)) return null;
  return ext;
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