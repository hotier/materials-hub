/**
 * 安全工具 — 常量时间比较、Token 创建与验证
 */

const encoder = new TextEncoder();

/** 将 ArrayBuffer 转为 hex 字符串 */
function bufferToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** hex 字符串转 Uint8Array */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * 常量时间字符串比较（防时序攻击）
 * 适用于 Token / API Key 比对
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // 仍做常量时间比较以避免泄露长度信息
    const dummy = new Uint8Array(a.length);
    const aa = encoder.encode(a);
    let result = 0;
    for (let i = 0; i < aa.length; i++) {
      result |= aa[i] ^ (dummy[i] ?? 0);
    }
    return false;
  }

  const aa = encoder.encode(a);
  const bb = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < aa.length; i++) {
    result |= aa[i] ^ bb[i];
  }
  return result === 0;
}

/**
 * 创建 HMAC-SHA256 session token
 * 格式: {expiryTimestamp}.{hexSignature}
 */
export async function createSessionToken(
  secret: string,
  maxAge = 7 * 24 * 60 * 60,
): Promise<string> {
  const expires = Date.now() + maxAge * 1000;
  const payload = `${expires}`;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return `${payload}.${bufferToHex(sig)}`;
}

/**
 * 验证 HMAC-SHA256 session token
 */
export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<boolean> {
  const [payload, sigHex] = token.split('.');
  if (!payload || !sigHex) return false;

  const expires = parseInt(payload, 10);
  if (isNaN(expires) || Date.now() > expires) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const sig = hexToBytes(sigHex);
  return crypto.subtle.verify('HMAC', key, sig, encoder.encode(payload));
}
