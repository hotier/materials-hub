<template>
  <div class="preview-wrap preview-wrap--fill">
    <!-- 非 HTML 类型：loading 时显示 spinner -->
    <a-spin
      v-if="loading && cat !== 'html'"
      :loading="true"
      class="preview-loading"
      tip="加载中..."
    />

    <!-- HTML 源码模式：loading 时显示 spinner -->
    <a-spin
      v-else-if="loading && cat === 'html' && mode === 'source'"
      :loading="true"
      class="preview-loading"
      tip="加载中..."
    />

    <!-- 图片 -->
    <div v-else-if="cat === 'image'" class="preview-wrap preview-wrap--fill preview-wrap--img">
      <img :src="src" :alt="name" class="preview-img" @load="onLoaded" @error="onMediaError" />
    </div>

    <!-- 视频 -->
    <div v-else-if="cat === 'video'" class="preview-wrap preview-wrap--fill preview-wrap--video">
      <video :src="src" controls playsinline preload="metadata" class="preview-video"
        @loadedmetadata="onLoaded" @error="onMediaError" />
    </div>

    <!-- 音频 -->
    <div v-else-if="cat === 'audio'" class="preview-wrap preview-wrap--fill preview-wrap--audio">
      <div class="audio-card">
        <div class="audio-icon"><IconMusic :size="56" /></div>
        <p class="audio-name">{{ name }}</p>
        <audio :src="src" controls preload="metadata" class="audio-player"
          @loadedmetadata="onLoaded" @error="onMediaError" />
      </div>
    </div>

    <!-- HTML 预览模式：iframe 立即显示，浏览器自行处理加载 -->
    <div v-else-if="cat === 'html' && mode !== 'source'" class="preview-wrap preview-wrap--fill preview-wrap--html">
      <iframe
        :src="src"
        class="preview-html"
        @load="onPreviewLoad"
        @error="onMediaError"
      />
    </div>

    <!-- HTML 源码模式：优先显示高亮内容，降级为纯文本 -->
    <div v-else-if="cat === 'html' && mode === 'source'" class="preview-wrap preview-wrap--fill preview-wrap--html">
      <div v-if="highlightedHtmlContent" class="html-source html-source--highlighted" v-html="highlightedHtmlContent" />
      <div v-else class="html-source">
        <pre><code>{{ htmlContent }}</code></pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { IconMusic } from '@arco-design/web-vue/es/icon'
import type { PreviewCategory } from '@/composables/usePreview'
import { getHighlighter } from '@/composables/useShiki'

const props = defineProps<{
  src: string
  name: string
  cat: PreviewCategory
  mode?: 'preview' | 'source'
}>()

const emit = defineEmits<{ rendered: []; error: [msg: string] }>()

const loading = ref(true)
const htmlContent = ref('')
const highlightedHtmlContent = ref('')

function onLoaded() {
  loading.value = false
  emit('rendered')
}

function onMediaError() {
  loading.value = false
  emit('error', '媒体加载失败')
}

function onPreviewLoad() {
  loading.value = false
  emit('rendered')
}

function prefetchHtml() {
  if (htmlContent.value) return
  fetch(props.src)
    .then(res => res.text())
    .then(async text => {
      htmlContent.value = text
      try {
        const highlighter = await getHighlighter()
        highlightedHtmlContent.value = highlighter.codeToHtml(text, {
          lang: 'html',
          theme: 'github-light',
        })
      } catch {
        highlightedHtmlContent.value = ''
      }
      if (props.cat === 'html' && props.mode === 'source' && loading.value) {
        loading.value = false
        emit('rendered')
      }
    })
    .catch(() => { /* ignore */ })
}

// 监听 src 变化
watch(() => props.src, () => {
  if (props.cat === 'html') {
    htmlContent.value = ''
    highlightedHtmlContent.value = ''
    // 预览模式：iframe 立即显示，不需要 loading 阻塞
    // 但需要标记 loading=true 以便 iframe @load 触发关闭
    // 这里我们根据模式决定初始 loading 状态
    if (props.mode === 'source') {
      loading.value = true
      prefetchHtml()
    } else {
      // 预览模式：iframe 直接渲染，不阻塞
      loading.value = false
      emit('rendered')
      prefetchHtml()
    }
  } else {
    loading.value = true
  }
}, { immediate: true })

// 监听模式切换
watch(() => props.mode, () => {
  if (props.cat !== 'html') return
  if (props.mode === 'source') {
    if (htmlContent.value) {
      loading.value = false
    } else {
      loading.value = true
      prefetchHtml()
    }
  } else if (props.mode === 'preview') {
    loading.value = false
    prefetchHtml()
  }
})

// 监听 cat 变化
watch(() => props.cat, () => {
  if (props.cat === 'html') {
    if (props.mode === 'source' && !htmlContent.value) {
      loading.value = true
      prefetchHtml()
    } else {
      loading.value = false
    }
  } else {
    loading.value = true
  }
})
</script>

<style scoped>
.preview-wrap { display: flex; flex-direction: column; }
.preview-wrap--fill { flex: 1; min-height: 0; }

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

.preview-wrap--html { overflow: hidden; }

.preview-wrap--img { background: var(--color-bg-page); align-items: center; justify-content: center; padding: 24px; }
.preview-img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: var(--radius-sm); box-shadow: var(--shadow-lg); }

.preview-wrap--video { background: var(--color-bg-inverse, #0d0d0d); align-items: center; justify-content: center; padding: 24px; }
.preview-video { max-width: 100%; max-height: 100%; border-radius: var(--radius-md); outline: none; }

.preview-wrap--audio { align-items: center; justify-content: center; background: var(--color-bg-page); }
.audio-card { display: flex; flex-direction: column; align-items: center; gap: var(--gap-lg); }
.audio-icon { opacity: .8; color: var(--color-primary); }
.audio-name { color: var(--color-text-primary); font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); margin: 0; max-width: 320px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.audio-player { width: 360px; max-width: 90vw; outline: none; }

.preview-html { width: 100%; flex: 1; border: none; }

.html-source {
  flex: 1;
  overflow: auto;
}
.html-source pre {
  margin: 0;
  padding: var(--gap-xl) var(--gap-2xl);
  background: var(--color-bg-page);
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.7;
  min-height: 100%;
}
.html-source code {
  color: var(--color-text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.html-source--highlighted {
  padding: var(--gap-lg);
}
.html-source--highlighted :deep(pre) {
  margin: 0;
  padding: var(--gap-lg);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  overflow-x: auto;
}
.html-source--highlighted :deep(pre code) {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  line-height: 1.6;
  color: var(--color-text-primary);
  white-space: pre;
  word-break: normal;
}
</style>