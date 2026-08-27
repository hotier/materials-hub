<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'

const props = defineProps<{ url: string }>()
const emit = defineEmits<{ rendered: []; error: [msg: string] }>()

// ---- state ----
const loading = ref(true)
const errorMsg = ref('')
const iframeKey = ref(0)

let loadTimer: ReturnType<typeof setTimeout> | null = null

// ---- iframe events ----
function handleLoad() {
  if (loadTimer) {
    clearTimeout(loadTimer)
    loadTimer = null
  }
  loading.value = false
  emit('rendered')
}

function handleTimeout() {
  if (loadTimer) {
    clearTimeout(loadTimer)
    loadTimer = null
  }
  loading.value = false
  errorMsg.value = 'PDF 加载失败或文件不存在'
  emit('error', errorMsg.value)
}

function retry() {
  if (loadTimer) clearTimeout(loadTimer)
  errorMsg.value = ''
  loading.value = true
  iframeKey.value++
  loadTimer = setTimeout(handleTimeout, 20000)
}

// ---- lifecycle ----
watch(
  () => props.url,
  () => {
    if (loadTimer) clearTimeout(loadTimer)
    errorMsg.value = ''
    loading.value = true
    iframeKey.value++
    // 20s 超时兜底：原生 viewer 加载过慢或文件不存在
    loadTimer = setTimeout(handleTimeout, 20000)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (loadTimer) clearTimeout(loadTimer)
})
</script>

<template>
  <div class="pdf-viewer">
    <!-- Error -->
    <div v-if="errorMsg" class="pdf-error">
      <svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" stroke-width="1.5" fill="none">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p>{{ errorMsg }}</p>
      <a-button type="primary" size="small" @click="retry">重试</a-button>
    </div>

    <!-- 浏览器原生 PDF viewer -->
    <iframe
      v-show="!errorMsg"
      :key="iframeKey"
      class="pdf-iframe"
      :src="props.url"
      @load="handleLoad"
    />
  </div>
</template>

<style scoped>
.pdf-viewer {
  height: 100%;
  background: #f5f5f5;
  position: relative;
  overflow: hidden;
}

.pdf-iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: none;
  background: #f5f5f5;
}

.pdf-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--gap-md);
  height: 100%;
  color: #999;
}
.pdf-error svg { color: var(--color-danger); }
.pdf-error p { margin: 0; }
</style>
