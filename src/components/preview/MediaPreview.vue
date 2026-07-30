<template>
  <!-- 图片 -->
  <div v-if="cat === 'image'" class="preview-wrap preview-wrap--fill preview-wrap--img">
    <img :src="src" :alt="name" class="preview-img" @load="emit('rendered')" @error="onMediaError" />
  </div>

  <!-- 视频 -->
  <div v-else-if="cat === 'video'" class="preview-wrap preview-wrap--fill preview-wrap--video">
    <video :src="src" controls playsinline preload="metadata" class="preview-video"
      @loadedmetadata="emit('rendered')" @error="onMediaError" />
  </div>

  <!-- 音频 -->
  <div v-else-if="cat === 'audio'" class="preview-wrap preview-wrap--fill preview-wrap--audio">
    <div class="audio-card">
      <div class="audio-icon"><IconMusic :size="56" /></div>
      <p class="audio-name">{{ name }}</p>
      <audio :src="src" controls preload="metadata" class="audio-player"
        @loadedmetadata="emit('rendered')" @error="onMediaError" />
    </div>
  </div>

  <!-- HTML -->
  <div v-else-if="cat === 'html'" class="preview-wrap preview-wrap--fill preview-wrap--html">
    <iframe
      v-if="props.mode !== 'source'"
      :srcdoc="htmlContent"
      sandbox="allow-scripts allow-same-origin"
      class="preview-html"
      @load="emit('rendered')"
    />
    <div v-else class="html-source">
      <pre><code class="language-html">{{ htmlContent }}</code></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { IconMusic } from '@arco-design/web-vue/es/icon'
import type { PreviewCategory } from '@/composables/usePreview'

const props = defineProps<{
  src: string
  name: string
  cat: PreviewCategory
  mode?: 'preview' | 'source'
}>()

const emit = defineEmits<{ rendered: []; error: [msg: string] }>()

const htmlContent = ref('')

function onMediaError() {
  emit('error', '媒体加载失败')
}

watch(() => props.src, async () => {
  if (props.cat === 'html') {
    try {
      const res = await fetch(props.src)
      htmlContent.value = await res.text()
    } catch { /* ignore */ }
  }
}, { immediate: true })
</script>

<style scoped>
.preview-wrap { display: flex; flex-direction: column; }
.preview-wrap--fill { flex: 1; min-height: 0; }

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
</style>
