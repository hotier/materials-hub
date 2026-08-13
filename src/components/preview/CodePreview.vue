<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { getHighlighter, mapLang } from '@/composables/useShiki';

const props = defineProps<{ url: string; ext?: string }>();

const code = ref('');
const loading = ref(true);
const initError = ref('');

async function load() {
  if (!props.url) return;
  loading.value = true;
  initError.value = '';
  try {
    const highlighter = await getHighlighter();
    const res = await fetch(props.url);
    const text = await res.text();
    const lang = mapLang(props.ext);
    code.value = highlighter.codeToHtml(text, {
      lang,
      theme: 'github-light',
    });
  } catch (e) {
    code.value = '';
    initError.value = e instanceof Error ? e.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => props.url, load);
watch(() => props.ext, () => {
  if (!loading.value && code.value) load();
});
</script>

<template>
  <div class="code-preview">
    <a-spin v-if="loading" :loading="true" class="code-loading" tip="加载中..." />
    <div v-else-if="initError" class="code-error">
      <p>加载失败：{{ initError }}</p>
    </div>
    <div v-else class="code-wrap">
      <div class="code-block" v-html="code" />
    </div>
  </div>
</template>

<style scoped>
.code-preview {
  height: 100%;
  overflow: auto;
}
.preview-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: var(--gap-sm);
}
.preview-loading :deep(.arco-spin-children) {
  margin-left: 0;
}
.code-wrap {
  padding: var(--gap-lg);
}
.code-block {
  overflow: auto;
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}
/* Shiki 生成的 pre/code 自带内联样式，这里统一容器样式 */
.code-block :deep(pre) {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: var(--gap-lg);
  margin: 0;
  overflow-x: auto;
}
.code-block :deep(pre code) {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}
.code-error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-tertiary);
}
</style>