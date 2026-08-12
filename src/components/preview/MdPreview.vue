<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import MarkdownIt from 'markdown-it';
import { getHighlighter, highlightCode, mapLang } from '@/composables/useShiki';

const props = defineProps<{ url: string; mode?: 'preview' | 'source' }>();

const html = ref('');
const rawText = ref('');
const loading = ref(true);
const isSource = computed(() => props.mode === 'source');

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(str: string, lang: string): string {
    return highlightCode(str, mapLang(lang)) || md.utils.escapeHtml(str);
  },
});

async function load() {
  if (!props.url) return;
  loading.value = true;
  try {
    // 确保 Shiki 已初始化
    await getHighlighter();
    const res = await fetch(props.url);
    const text = await res.text();
    rawText.value = text;
    html.value = md.render(text);
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
    <a-spin v-if="loading" :loading="true" class="md-loading" tip="加载中..." />
    <template v-else>
      <div v-if="!isSource" class="md-content">
        <div class="md-content-inner markdown-body" v-html="html" />
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

.md-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
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

:deep(.markdown-body strong) {
  font-weight: 600;
  color: var(--color-text-primary);
}

:deep(.markdown-body em) {
  color: var(--color-text-secondary);
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

/* Shiki 代码块样式 - github-light 主题已自带内联样式，覆盖背景即可 */
:deep(.markdown-body pre) {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: 16px 20px;
  overflow-x: auto;
  margin: 1em 0;
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
  border: 1px solid var(--color-border);
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