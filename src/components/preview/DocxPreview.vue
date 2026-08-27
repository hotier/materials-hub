<template>
  <div class="preview-wrap preview-wrap--fill">
    <!-- :data-src 动态绑定防止静态提升（hoisted vnode 上 ref 不生效） -->
    <div ref="container" class="docx-container" :data-src="src"></div>
    <a-spin v-if="loading" :loading="true" class="preview-loading" tip="加载中..." />
    <div v-if="error" class="preview-error">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { renderAsync } from 'docx-preview'

const props = defineProps<{ src: string }>()
const emit = defineEmits<{ rendered: []; error: [msg: string] }>()

const container = ref<HTMLElement>()
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(props.src)
    if (!res.ok) throw new Error(`请求失败：${res.status}`)
    const buf = await res.arrayBuffer()
    if (container.value) container.value.innerHTML = ''
    await renderAsync(buf, container.value!, undefined, {
      inWrapper: true,
      breakPages: true,
    })
    emit('rendered')
  } catch (e) {
    error.value = 'Word 文档加载失败'
    emit('error', 'Word 文档加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)

watch(() => props.src, () => {
  if (container.value) load()
})

onUnmounted(() => {
  if (container.value) container.value.innerHTML = ''
})
</script>

<style scoped>
.preview-wrap { position: relative; display: flex; flex-direction: column; }
.preview-wrap--fill { flex: 1; min-height: 0; overflow: auto; }

.docx-container {
  width: 100%;
  min-height: 100%;
  background: #fff;
}

.preview-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fff;
  z-index: 2;
  gap: var(--gap-sm);
}
.preview-loading :deep(.arco-spin-children) {
  margin-left: 0;
}

.preview-error {
  padding: 24px;
  text-align: center;
  color: var(--color-text-3);
}
</style>
