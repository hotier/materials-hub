import { Hono } from 'hono';
import type { Env } from '../types';
import { getFileByKey } from '../services/material';
import { jsonError } from '../helpers';

const rawRoute = new Hono<{ Bindings: Env }>();

/** 转义 HTML，防止文件名/文件内容注入 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 浏览器原生可播放的视频 MIME（mp4/webm/ogg；avi/mkv/mov 等无法原生播放） */
const PLAYABLE_VIDEO = new Set(['video/mp4', 'video/webm', 'video/ogg']);

/** 是否属于文本/代码类（可嵌入 HTML 展示） */
function isTextual(contentType: string): boolean {
  if (contentType.startsWith('text/')) {
    // 排除 text/html：HTML 文件应原样渲染（前端预览用 iframe 加载 raw）
    return !contentType.includes('html');
  }
  return /^application\/(?:json|ld\+json|javascript|xml|yaml|x-yaml|toml|sql|graphql|x-sh|shell-script|x-php|x-python|python|x-ruby|perl|x-perl|x-java|java|typescript|x-typescript|x-sql)/.test(
    contentType,
  );
}

/** 生成带 <title> 的 HTML 包装页，让浏览器标签页标题显示文件名 */
function buildWrapPage(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
html,body{margin:0;height:100%;background:#f2f2f2}
.wrap{display:flex;align-items:center;justify-content:center;min-height:100%}
img,video{max-width:100%;max-height:100%;display:block}
video{background:#000}
audio{width:80%;max-width:480px}
.code{white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:1.6;color:#1f2328;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:24px auto;max-width:960px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

/** 二次请求的 URL（inline=1 时直接返回原文件内容） */
function inlineSrc(key: string): string {
  return `/api/raw?key=${encodeURIComponent(key)}&inline=1`;
}

/** 强制下载的 URL（download=1 时返回 attachment） */
function downloadSrc(key: string): string {
  return `/api/raw?key=${encodeURIComponent(key)}&download=1`;
}

/** 浏览器无法解析的类型：返回提示页（标题=文件名 + 下载按钮） */
function buildNoticePage(title: string, key: string, ext: string): string {
  const extText = ext ? `（.${escapeHtml(ext)}）` : '';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
html,body{height:100%;margin:0;display:flex;align-items:center;justify-content:center;background:#f2f2f2;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
.card{text-align:center;background:#fff;border-radius:12px;padding:48px 40px;box-shadow:0 6px 24px rgba(0,0,0,.08);max-width:420px;margin:24px}
.icon{width:56px;height:56px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#f2f3f5}
h2{margin:0 0 8px;font-size:18px;color:#1d2129;font-weight:600}
p{margin:0 0 24px;font-size:14px;color:#86909c;line-height:1.6}
.btn{display:inline-block;background:#165dff;color:#fff;padding:9px 28px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500}
.btn:hover{opacity:.9}
</style>
</head>
<body>
<div class="card">
  <div class="icon"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#165dff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></div>
  <h2>暂不支持在线预览</h2>
  <p>该文件类型${extText}浏览器无法直接解析，请下载后查看</p>
  <a class="btn" href="${downloadSrc(key)}">下载文件</a>
</div>
</body>
</html>`;
}

/**
 * GET /api/raw?key=xxx
 * 直接读取 R2 中的文件（用于内嵌预览图片/代码）
 *
 * 浏览器直接导航到 raw URL（新窗口打开）时，标签页标题固定显示 URL。
 * 因此对"导航类"请求（Accept 含 text/html）按类型返回带 <title> 的 HTML 包装页，
 * 让标题显示文件名：图片/视频/音频用原生媒体标签加载，文本/代码内嵌展示。
 * 其余请求（<img>/<video>/<audio>/<iframe>/fetch/下载）直接返回文件内容。
 */
rawRoute.get('/', async (c) => {
  const key = c.req.query('key');
  if (!key) return jsonError(c, 400, '缺少参数 key');

  const result = await getFileByKey(c.env, key);
  if (!result) {
    return jsonError(c, 404, '文件不存在');
  }

  const isInline = c.req.query('inline') === '1';
  const isDownload = c.req.query('download') === '1';
  const isView = c.req.query('view') === '1';
  const accept = c.req.header('Accept') || '';
  // 前端"新窗口打开"带 view=1（新 URL 可绕开旧缓存）；直接访问则靠 Accept 判定
  const isTopNavigation =
    isView || (!isInline && !isDownload && accept.includes('text/html'));
  const title = escapeHtml(result.name || '预览');
  const ct = result.contentType;
  // KV 中 name 不含扩展名（ext 单独存），下载/标题需拼回扩展名
  const ext = key.includes('.') ? key.slice(key.lastIndexOf('.') + 1).toLowerCase() : '';
  const fileName = result.name ? (ext ? `${result.name}.${ext}` : result.name) : '';

  // ---- 显式下载：强制 attachment ----
  if (isDownload) {
    const headers: Record<string, string> = {
      'Content-Type': ct,
      'Cache-Control': 'no-store',
    };
    if (fileName) {
      headers['Content-Disposition'] =
        `attachment; filename="download${ext ? '.' + ext : ''}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
    }
    return new Response(result.body, { headers });
  }

  // ---- 浏览器直接导航：返回带标题的包装页 ----
  if (isTopNavigation) {
    let bodyHtml = '';

    if (ct.startsWith('image/')) {
      bodyHtml = `<div class="wrap"><img src="${inlineSrc(key)}" alt="${title}"></div>`;
    } else if (ct.startsWith('video/') && PLAYABLE_VIDEO.has(ct.split(';')[0].trim())) {
      bodyHtml = `<div class="wrap"><video src="${inlineSrc(key)}" controls playsinline></video></div>`;
    } else if (ct.startsWith('audio/')) {
      bodyHtml = `<div class="wrap"><audio src="${inlineSrc(key)}" controls></audio></div>`;
    } else if (isTextual(ct)) {
      const text = new TextDecoder('utf-8').decode(result.body);
      bodyHtml = `<pre class="code">${escapeHtml(text)}</pre>`;
    }

    if (bodyHtml) {
      return new Response(buildWrapPage(title, bodyHtml), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    // PDF：浏览器原生 viewer 渲染，直接返回（标题来自 Content-Disposition）
    const isPdf = ct === 'application/pdf' || ct === 'application/x-pdf' || ct.endsWith('/pdf');
    if (!isPdf) {
      // 浏览器无法解析的类型（Excel/Word/zip 等）：返回提示页 + 下载按钮
      return new Response(buildNoticePage(title, key, ext), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }
  }

  // ---- 其余请求：直接返回原文件 ----
  const headers: Record<string, string> = {
    'Content-Type': ct,
    'Cache-Control': 'public, max-age=3600',
  };
  // 设置文件名：PDF 等场景浏览器原生 viewer 会将其显示为标题
  if (fileName) {
    headers['Content-Disposition'] =
      `inline; filename="download${ext ? '.' + ext : ''}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
  }

  return new Response(result.body, { headers });
});

export default rawRoute;
