/**
 * raw 路由 Range 处理测试：<audio>/<video> 进度条 seek 依赖 206 切片响应
 */
import { describe, it, expect } from 'vitest';
import { buildRangeResponse } from './raw';

/** 构造 500 字节的测试 body */
function makeBody(size = 500): ArrayBuffer {
  const buf = new ArrayBuffer(size);
  new Uint8Array(buf).set(Array.from({ length: size }, (_, i) => i % 256));
  return buf;
}

describe('buildRangeResponse', () => {
  const CT = 'audio/mpeg';

  it('returns 206 with full slice for bytes=0-', async () => {
    const res = buildRangeResponse('bytes=0-', makeBody(), CT);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(206);
    expect(res!.headers.get('Content-Range')).toBe('bytes 0-499/500');
    expect(res!.headers.get('Accept-Ranges')).toBe('bytes');
    expect(res!.headers.get('Content-Length')).toBe('500');
    expect(res!.headers.get('Content-Type')).toBe(CT);
    expect((await res!.arrayBuffer()).byteLength).toBe(500);
  });

  it('returns 206 with partial slice for bytes=100-199', async () => {
    const res = buildRangeResponse('bytes=100-199', makeBody(), CT);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(206);
    expect(res!.headers.get('Content-Range')).toBe('bytes 100-199/500');
    expect(res!.headers.get('Content-Length')).toBe('100');
    const buf = new Uint8Array(await res!.arrayBuffer());
    expect(buf.length).toBe(100);
    // 内容应为原 body 的第 100~199 字节
    expect(buf[0]).toBe(100);
    expect(buf[99]).toBe(199);
  });

  it('clamps end beyond file size to the last byte', async () => {
    const res = buildRangeResponse('bytes=400-9999', makeBody(), CT);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(206);
    expect(res!.headers.get('Content-Range')).toBe('bytes 400-499/500');
    expect((await res!.arrayBuffer()).byteLength).toBe(100);
  });

  it('supports suffix range bytes=-100 (last N bytes)', async () => {
    const res = buildRangeResponse('bytes=-100', makeBody(), CT);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(206);
    expect(res!.headers.get('Content-Range')).toBe('bytes 400-499/500');
    const buf = new Uint8Array(await res!.arrayBuffer());
    expect(buf.length).toBe(100);
    // 原 body 第 i 字节为 i % 256，第 400 字节即 400 % 256 = 144
    expect(buf[0]).toBe(144);
  });

  it('returns 416 when start is out of range', () => {
    const res = buildRangeResponse('bytes=500-', makeBody(), CT);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(416);
    expect(res!.headers.get('Content-Range')).toBe('bytes */500');
  });

  it('returns 416 when start > end', () => {
    const res = buildRangeResponse('bytes=200-100', makeBody(), CT);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(416);
  });

  it('ignores unparseable range header (returns null)', () => {
    expect(buildRangeResponse('bytes=abc', makeBody(), CT)).toBeNull();
    // 多段范围不支持时按完整响应处理
    expect(buildRangeResponse('bytes=0-1,5-9', makeBody(), CT)).toBeNull();
  });
});
