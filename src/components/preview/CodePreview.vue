<script setup lang="ts">
import { ref, watch } from 'vue';
import hljs from 'highlight.js';

const props = defineProps<{ url: string; ext?: string }>();

const code = ref('');
const loading = ref(true);

function mapLang(ext?: string): string {
  if (!ext) return 'plaintext';
  const map: Record<string, string> = {
    html: 'xml', css: 'css', js: 'javascript', ts: 'typescript',
    json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml',
    sql: 'sql', txt: 'plaintext', log: 'plaintext', csv: 'plaintext',
  };
  return map[ext.toLowerCase()] || ext.toLowerCase();
}

async function load() {
  if (!props.url) return;
  loading.value = true;
  try {
    const res = await fetch(props.url);
    const text = await res.text();
    const lang = mapLang(props.ext);
    if (lang && hljs.getLanguage(lang)) {
      code.value = hljs.highlight(text, { language: lang }).value;
    } else {
      code.value = hljs.highlightAuto(text).value;
    }
  } catch {
    code.value = '加载失败';
  } finally {
    loading.value = false;
  }
}

watch(() => props.url, load, { immediate: true });
</script>

<template>
  <div class="code-preview">
    <a-spin v-if="loading" :loading="true" class="code-loading" tip="加载中..." />
    <div v-else class="code-wrap">
      <pre class="code-block"><code class="code-html" v-html="code" /></pre>
    </div>
  </div>
</template>

<style scoped>
.code-preview {
  height: 100%;
  overflow: auto;
}
.code-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
.code-wrap {
  padding: var(--gap-lg);
}
.code-block {
  background: var(--color-bg-page);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: var(--gap-lg);
  overflow-x: auto;
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}
.code-html {
  color: var(--color-text-primary);
}
</style>
