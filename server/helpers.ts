/**
 * 工具函数
 */

import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Env } from './types';
import type { PreviewType } from './types';

// ====== 时间工具 ======

/** 获取 Asia/Shanghai 时区的 YYYY-MM-DD 日期字符串 */
export function getShanghaiDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// ====== MIME 映射 ======

export const MIME_MAP: Record<string, string> = {
  html: 'text/html', htm: 'text/html',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
  bmp: 'image/bmp', ico: 'image/x-icon',
  json: 'application/json', txt: 'text/plain', md: 'text/markdown',
  csv: 'text/csv', xml: 'application/xml',
  css: 'text/css', js: 'application/javascript', ts: 'application/typescript',
  yaml: 'text/yaml', yml: 'text/yaml',
  log: 'text/plain', sql: 'text/plain', pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  docm: 'application/vnd.ms-word.document.macroEnabled.12',
  dotx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
  dotm: 'application/vnd.ms-word.template.macroEnabled.12',
  rtf: 'application/rtf',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  xltx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
  xlsb: 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  pptm: 'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
  potx: 'application/vnd.openxmlformats-officedocument.presentationml.template',
  ppsx: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  vsd: 'application/vnd.visio',
  vsdx: 'application/vnd.ms-visio.drawing',
  pub: 'application/x-mspublisher',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  odg: 'application/vnd.oasis.opendocument.graphics',
};

/** 扩展名 → MIME，兜底 octet-stream */
export function getMime(ext: string): string {
  return MIME_MAP[ext] || 'application/octet-stream';
}

const PREVIEW_TYPE_MAP: Record<string, string> = {
  html: 'html', htm: 'html',
  jpg: 'img', jpeg: 'img', png: 'img', gif: 'img',
  svg: 'img', webp: 'img', bmp: 'img', ico: 'img',
  json: 'code', xml: 'code', css: 'code', js: 'code',
  ts: 'code', yaml: 'code', yml: 'code', sql: 'code',
  pdf: 'pdf',
  doc: 'office', docx: 'office', docm: 'office', dotx: 'office', dotm: 'office', rtf: 'office',
  xls: 'office', xlsx: 'office', xlsm: 'office', xltx: 'office', xlsb: 'office',
  ppt: 'office', pptx: 'office', pptm: 'office', potx: 'office', ppsx: 'office',
  vsd: 'office', vsdx: 'office', pub: 'office',
  odt: 'office', ods: 'office', odp: 'office', odg: 'office',
};

/** 扩展名 → 预览类型 */
export function getPreviewType(ext: string): PreviewType {
  return (PREVIEW_TYPE_MAP[ext] as PreviewType) || 'text';
}

/** 提取文件扩展名（小写） */
export function getExt(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i > -1 ? filename.slice(i + 1).toLowerCase() : '';
}

// ====== 响应工具 ======

/** 统一 JSON 错误响应 */
export function jsonError(
  c: Context<{ Bindings: Env }>,
  status: ContentfulStatusCode,
  error: string,
  extra?: Record<string, unknown>,
) {
  return c.json({ error, ...extra }, status as any);
}

/** 去掉字符串首尾的空白和双引号（curl -F 可能带入） */
export function stripQuotes(s: string): string {
  return s.trim().replace(/^"+|"+$/g, '');
}

// ====== 兼容旧 API（标记为 deprecated） ======

/** @deprecated 使用 kv-service 中的 getItem / getAllMaterials 替代 */
export async function getMaterialList(KV: KVNamespace) {
  const { getAllMaterials, migrateIfNeeded } = await import('./lib/kv-service');
  await migrateIfNeeded(KV);
  const { items } = await getAllMaterials(KV);
  return items;
}

/** @deprecated 使用 kv-service 中的 addMaterial / removeMaterial 替代 */
export async function setMaterialList(_KV: KVNamespace, _list: unknown) {
  console.warn('[deprecated] setMaterialList 被调用，请使用 kv-service');
}
