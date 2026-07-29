import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Env, FileExt } from './types';

const kvKey = 'materials:list';

/** 支持的文件扩展名 */
export const ALLOWED_EXTS: FileExt[] = [
  'html', 'htm', 'jpg', 'jpeg', 'png', 'gif', 'svg',
  'webp', 'bmp', 'ico', 'json', 'txt', 'md', 'csv', 'xml',
  'css', 'js', 'ts', 'yaml', 'yml', 'log', 'sql',
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
  log: 'text/plain', sql: 'text/plain',
};

/** 扩展名 → 预览类型 */
const PREVIEW_TYPE_MAP: Record<string, string> = {
  html: 'html', htm: 'html',
  jpg: 'img', jpeg: 'img', png: 'img', gif: 'img',
  svg: 'img', webp: 'img', bmp: 'img', ico: 'img',
  json: 'code', xml: 'code', css: 'code', js: 'code',
  ts: 'code', yaml: 'code', yml: 'code', sql: 'code',
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
export async function getMaterialList(kv: KVNamespace) {
  const raw = await kv.get(kvKey);
  return raw ? JSON.parse(raw) : [];
}

/** 写入产出列表到 KV */
export async function setMaterialList(kv: KVNamespace, list: unknown) {
  await kv.put(kvKey, JSON.stringify(list));
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


