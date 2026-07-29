import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Env, FileExt } from './types';

const KV_KEY = 'materials:list';

/** 支持的文件扩展名 */
export const ALLOWED_EXTS: FileExt[] = [
  'html', 'htm', 'jpg', 'jpeg', 'png', 'gif', 'svg',
  'webp', 'bmp', 'ico', 'json', 'txt', 'md', 'csv', 'xml',
  'css', 'js', 'ts', 'yaml', 'yml', 'log', 'sql', 'pdf',
  // Office 文档（Word / Excel / PowerPoint 及模板、宏启用格式）
  'doc', 'docx', 'docm', 'dotx', 'dotm', 'rtf',
  'xls', 'xlsx', 'xlsm', 'xltx', 'xlsb',
  'ppt', 'pptx', 'pptm', 'potx', 'ppsx',
  // 其他 Microsoft Office（Visio / Publisher）
  'vsd', 'vsdx', 'pub',
  // OpenDocument（LibreOffice / OpenOffice）
  'odt', 'ods', 'odp', 'odg',
];

/** 扩展名 → MIME */
const MIME_MAP: Record<string, string> = {
  html: 'text/html', htm: 'text/html',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
  bmp: 'image/bmp', ico: 'image/x-icon',
  json: 'application/json', txt: 'text/plain', md: 'text/markdown',
  csv: 'text/csv', xml: 'application/xml',
  css: 'text/css', js: 'application/javascript', ts: 'application/typescript',
  yaml: 'text/yaml', yml: 'text/yaml',
  log: 'text/plain', sql: 'text/plain', pdf: 'application/pdf',
  // Word
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  docm: 'application/vnd.ms-word.document.macroEnabled.12',
  dotx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
  dotm: 'application/vnd.ms-word.template.macroEnabled.12',
  rtf: 'application/rtf',
  // Excel
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  xltx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
  xlsb: 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  // PowerPoint
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  pptm: 'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
  potx: 'application/vnd.openxmlformats-officedocument.presentationml.template',
  ppsx: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  // 其他 Microsoft Office
  vsd: 'application/vnd.visio',
  vsdx: 'application/vnd.ms-visio.drawing',
  pub: 'application/x-mspublisher',
  // OpenDocument
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  odg: 'application/vnd.oasis.opendocument.graphics',
};

/** 扩展名 → 预览类型 */
const PREVIEW_TYPE_MAP: Record<string, string> = {
  html: 'html', htm: 'html',
  jpg: 'img', jpeg: 'img', png: 'img', gif: 'img',
  svg: 'img', webp: 'img', bmp: 'img', ico: 'img',
  json: 'code', xml: 'code', css: 'code', js: 'code',
  ts: 'code', yaml: 'code', yml: 'code', sql: 'code',
  pdf: 'pdf',
  // Office 文档
  doc: 'office', docx: 'office', docm: 'office', dotx: 'office', dotm: 'office', rtf: 'office',
  xls: 'office', xlsx: 'office', xlsm: 'office', xltx: 'office', xlsb: 'office',
  ppt: 'office', pptx: 'office', pptm: 'office', potx: 'office', ppsx: 'office',
  vsd: 'office', vsdx: 'office', pub: 'office',
  odt: 'office', ods: 'office', odp: 'office', odg: 'office',
};

/** 提取文件扩展名（小写） */
export function getExt(filename: string): FileExt {
  const i = filename.lastIndexOf('.');
  return i > -1 ? filename.slice(i + 1).toLowerCase() : '';
}

/** 扩展名 → MIME，兜底 octet-stream */
export function getMime(ext: FileExt): string {
  return MIME_MAP[ext] || 'application/octet-stream';
}

/** 扩展名 → 预览类型，兜底 text */
export function getPreviewType(ext: FileExt): string {
  return PREVIEW_TYPE_MAP[ext] || 'text';
}

/** 验证扩展名是否允许 */
export function isAllowedExt(ext: FileExt): boolean {
  return ALLOWED_EXTS.includes(ext);
}

/** 从 KV 读取产出列表 */
export async function getMaterialList(KV: KVNamespace) {
  const raw = await KV.get(KV_KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    // 兼容旧数据：字段曾命名为 r2Key
    return (list as (MaterialItem & { r2Key?: string })[]).map((it) =>
      it.R2Key ? it : { ...it, R2Key: it.r2Key as string }
    );
  } catch {
    return [];
  }
}

/** 写入产出列表到 KV */
export async function setMaterialList(KV: KVNamespace, list: unknown) {
  await KV.put(KV_KEY, JSON.stringify(list));
}

/** 统一 JSON 错误响应 */
export function jsonError(c: Context<{ Bindings: Env }>, status: ContentfulStatusCode, error: string, extra?: Record<string, unknown>) {
  return c.json({ error, ...extra }, status);
}

/** 去掉字符串首尾的空白和双引号（curl -F 可能带入） */
export function stripQuotes(s: string): string {
  return s.trim().replace(/^"+|"+$/g, '');
}

/** 创建 session token（过期时间戳 + HMAC 签名，用 LOGIN_TOKEN 做密钥） */
export async function createSessionToken(secret: string, maxAge = 7 * 24 * 60 * 60): Promise<string> {
  const expires = Date.now() + maxAge * 1000;
  const payload = `${expires}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${payload}.${hex}`;
}

/** 验证 session token */
export async function verifySessionToken(token: string, secret: string): Promise<boolean> {
  const [payload, sigHex] = token.split('.');
  if (!payload || !sigHex) return false;

  const expires = parseInt(payload, 10);
  if (isNaN(expires) || Date.now() > expires) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const sig = new Uint8Array(sigHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  return crypto.subtle.verify('HMAC', key, sig, enc.encode(payload));
}


