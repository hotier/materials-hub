<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import MarkdownIt from 'markdown-it';
import { getHighlighter, highlightCode, mapLang } from '@/composables/useShiki';

const props = defineProps<{ url: string; mode?: 'preview' | 'source' }>();

const html = ref('');
const rawText = ref('');
const loading = ref(true);
const isSource = computed(() => props.mode === 'source');
const contentRef = ref<HTMLElement | null>(null);

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

// 将 highlight 函数保存为变量，供自定义渲染器使用
const highlightFn = (str: string, lang: string): string =>
  highlightCode(str, mapLang(lang)) || md.utils.escapeHtml(str);

// Tabler icons as inline SVG strings (24x24 viewBox, stroke-width 1.5)
const ICON_COPY = '<svg class="cp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>'
const ICON_CHECK = '<svg class="cp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 10-11"/></svg>'

// 代码块自定义渲染：添加容器、语言标签和复制按钮
md.renderer.rules.fence = (tokens, idx, _options, _env, _self) => {
  const token = tokens[idx];
  const info = token.info ? md.utils.unescapeAll(token.info).trim() : '';
  const langClass = info ? `language-${md.utils.escapeHtml(info)}` : '';
  const langLabel = info || 'plaintext';
  const highlighted = highlightFn(token.content, info);
  const codeContent = highlighted || md.utils.escapeHtml(token.content);
  return (
    `<div class="code-block-wrapper">` +
    `<div class="code-block-header">` +
    `<span class="code-block-lang">${md.utils.escapeHtml(langLabel)}</span>` +
    `<button class="code-copy-btn" type="button">${ICON_COPY}<span>复制</span></button>` +
    `</div>` +
    `<pre><code class="${langClass}">${codeContent}</code></pre>` +
    `</div>\n`
  );
};

md.renderer.rules.code_block = (tokens, idx, _options, _env, _self) => {
  const token = tokens[idx];
  const escaped = md.utils.escapeHtml(token.content);
  return (
    `<div class="code-block-wrapper">` +
    `<div class="code-block-header">` +
    `<span class="code-block-lang">plaintext</span>` +
    `<button class="code-copy-btn" type="button">${ICON_COPY}<span>复制</span></button>` +
    `</div>` +
    `<pre><code>${escaped}</code></pre>` +
    `</div>\n`
  );
};

function handleCopyClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  const btn = target.closest('.code-copy-btn') as HTMLElement | null;
  if (!btn) return;
  const wrapper = btn.closest('.code-block-wrapper');
  const codeBlock = wrapper?.querySelector('code');
  if (!codeBlock) return;
  navigator.clipboard.writeText(codeBlock.textContent || '').then(() => {
    const original = btn.innerHTML;
    btn.innerHTML = `${ICON_CHECK}<span>已复制</span>`;
    btn.classList.add('copied');
    setTimeout(() => {
      btn.innerHTML = original;
      btn.classList.remove('copied');
    }, 2000);
  });
}

// 修复 markdown-it 解析加粗时的局限性：
// markdown-it 判断 `**` 是否为合法闭合标记时，可能只识别 ASCII 范围的标点。
// 当 `**` 闭合前是 CJK 标点（如 。 ， ！ 等）且紧跟非空白字符时，
// markdown-it 无法正确将 `**` 识别为闭合标记，导致加粗渲染失败。
//
// 修复策略：预处理文本，在有问题的 `**` 附近插入空格。
// 使用 \p{P} 匹配所有 Unicode 标点（需配合 u flag），避免维护标点白名单。

function fixBold(text: string): string {
  // 修复1: **内容[标点]**紧跟非空白字符 → 在 ** 后插入空格
  // 例如：**第一步：维度打分。**对照 → **第一步：维度打分。** 对照
  text = text.replace(
    /\*\*([^*]*?\p{P})\*\*(\S)/gu,
    '**$1** $2',
  );

  // 修复2: [非空白][标点]**内容** → 在 ** 前插入空格
  // 例如：）**注意**事项 → ） **注意** 事项
  text = text.replace(
    /(\S\p{P})\*\*(\S)/gu,
    '$1 **$2',
  );

  return text;
}

async function load() {
  if (!props.url) return;
  loading.value = true;
  try {
    await getHighlighter();
    const res = await fetch(props.url);
    const text = await res.text();
    rawText.value = text;
    html.value = md.render(fixBold(text));
  } catch {
    html.value = '<p style="color:var(--color-text-tertiary)">加载失败</p>';
    rawText.value = '';
  } finally {
    loading.value = false;
  }
}

watch(() => props.url, load, { immediate: true });
</script>

<template>
  <div class="md-preview">
    <a-spin v-if="loading" :loading="true" class="preview-loading" tip="加载中..." />
    <template v-else>
      <div v-if="!isSource" class="md-content">
        <div
          ref="contentRef"
          class="md-content-inner markdown-body"
          v-html="html"
          @click="handleCopyClick"
        />
      </div>
      <div v-else class="md-source">
        <pre><code class="language-markdown">{{ rawText }}</code></pre>
      </div>
    </template>
  </div>
</template>

<style scoped>
.md-preview {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: var(--gap-sm);
}
.preview-loading :deep(.arco-spin-children) {
  margin-left: 0;
}

.md-source {
  flex: 1;
  overflow: auto;
}
.md-source pre {
  margin: 0;
  padding: var(--gap-xl) var(--gap-2xl);
  background: var(--color-bg-page);
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.7;
  min-height: 100%;
}
.md-source code {
  color: var(--color-text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.md-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}
.md-content-inner {
  max-width: 900px;
  margin: 0 auto;
  padding: var(--gap-2xl) var(--gap-3xl);
}

:deep(.markdown-body) {
  color: var(--color-text-primary);
  font-size: 15px;
  line-height: 1.8;
  word-wrap: break-word;
}

:deep(.markdown-body > *:first-child) {
  margin-top: 0;
}

:deep(.markdown-body > *:last-child) {
  margin-bottom: 0;
}

:deep(.markdown-body h1),
:deep(.markdown-body h2),
:deep(.markdown-body h3),
:deep(.markdown-body h4),
:deep(.markdown-body h5),
:deep(.markdown-body h6) {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  line-height: 1.3;
  margin: 1.4em 0 0.6em;
}

:deep(.markdown-body h1) {
  font-size: 28px;
  padding-bottom: 0.4em;
  border-bottom: 2px solid var(--color-border);
}
:deep(.markdown-body h2) {
  font-size: 22px;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--color-border-light);
}
:deep(.markdown-body h3) { font-size: 18px; }
:deep(.markdown-body h4) { font-size: 16px; }
:deep(.markdown-body h5) { font-size: 15px; }
:deep(.markdown-body h6) { font-size: 14px; color: var(--color-text-secondary); }

:deep(.markdown-body p) {
  margin: 0.9em 0;
}

:deep(.markdown-body strong),
:deep(.markdown-body b) {
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

:deep(.markdown-body em) {
  color: var(--color-text-secondary);
}

:deep(.markdown-body del),
:deep(.markdown-body s) {
  color: var(--color-text-tertiary);
  text-decoration: line-through;
}

:deep(.markdown-body ul),
:deep(.markdown-body ol) {
  padding-left: 1.8em;
  margin: 0.9em 0;
}

:deep(.markdown-body ul) {
  list-style: disc;
}

:deep(.markdown-body ol) {
  list-style: decimal;
}

:deep(.markdown-body li) {
  margin: 0.4em 0;
}

:deep(.markdown-body li > p) {
  margin: 0.4em 0;
}

:deep(.markdown-body li > ul),
:deep(.markdown-body li > ol) {
  margin: 0.4em 0;
}

:deep(.markdown-body input[type='checkbox']) {
  margin: 0 0.4em;
}

:deep(.markdown-body code) {
  background: rgba(175, 184, 193, 0.2);
  padding: 0.2em 0.45em;
  border-radius: 4px;
  font-size: 0.88em;
  font-family: var(--font-mono);
  color: #d6336c;
}

/* 代码块容器：语言标签 + 复制按钮 */
:deep(.markdown-body .code-block-wrapper) {
  position: relative;
  margin: 1em 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-surface);
  overflow: hidden;
}

:deep(.markdown-body .code-block-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: var(--color-bg-page);
  border-bottom: 1px solid var(--color-border);
  font-family: var(--font-mono);
  font-size: 12px;
}

:deep(.markdown-body .code-block-lang) {
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

:deep(.markdown-body .code-copy-btn) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-surface);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  line-height: 1.6;
}

:deep(.markdown-body .code-copy-btn .cp-icon) {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

:deep(.markdown-body .code-copy-btn:hover) {
  color: var(--color-primary);
  border-color: var(--color-primary);
  background: var(--color-primary-subtle);
}

:deep(.markdown-body .code-copy-btn.copied) {
  color: var(--color-success);
  border-color: var(--color-success);
  background: var(--color-success-subtle);
}

/* 代码块 pre 样式 */
:deep(.markdown-body pre) {
  background: var(--color-bg-surface);
  border: none;
  border-radius: 0;
  padding: 16px 20px;
  overflow-x: auto;
  margin: 0;
  line-height: 1.6;
}

:deep(.markdown-body pre code) {
  background: none;
  padding: 0;
  font-size: 0.88em;
  color: inherit;
  font-family: var(--font-mono);
}

:deep(.markdown-body blockquote) {
  border-left: 4px solid var(--color-primary);
  margin: 1em 0;
  padding: 0.6em 1em;
  color: var(--color-text-secondary);
  background: var(--color-primary-subtle);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

:deep(.markdown-body blockquote > :first-child) { margin-top: 0; }
:deep(.markdown-body blockquote > :last-child) { margin-bottom: 0; }

:deep(.markdown-body a) {
  color: var(--color-primary);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color .15s;
}
:deep(.markdown-body a:hover) {
  border-bottom-color: var(--color-primary);
}

:deep(.markdown-body img) {
  max-width: 100%;
  border-radius: var(--radius-md);
  margin: 0.5em 0;
}

:deep(.markdown-body hr) {
  height: 2px;
  padding: 0;
  margin: 2em 0;
  background-color: var(--color-border-light);
  border: 0;
}

:deep(.markdown-body table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1.2em 0;
  font-size: 0.95em;
}

:deep(.markdown-body th),
:deep(.markdown-body td) {
  padding: 8px 14px;
  border: 1px solid #d1d1d6;
  text-align: left;
}

:deep(.markdown-body th) {
  background: var(--color-bg-page);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

:deep(.markdown-body tr:nth-child(even)) {
  background: rgba(0, 0, 0, 0.02);
}

:deep(.markdown-body kbd) {
  background: var(--color-bg-page);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 1px 5px;
  font-family: var(--font-mono);
  font-size: 0.85em;
  box-shadow: 0 1px 0 rgba(0,0,0,0.1);
}
</style>