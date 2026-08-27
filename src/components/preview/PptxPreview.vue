<template>
  <div class="preview-wrap preview-wrap--fill">
    <!-- :data-src 动态绑定防止静态提升（hoisted vnode 上 ref 不生效） -->
    <div ref="container" class="pptx-container" :data-src="src">
      <div ref="inner" class="pptx-inner"></div>
    </div>
    <a-spin v-if="loading" :loading="true" class="preview-loading" tip="加载中..." />
    <div v-if="error" class="preview-error">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { init } from 'pptx-preview'

const props = defineProps<{ src: string }>()
const emit = defineEmits<{ rendered: []; error: [msg: string] }>()

const container = ref<HTMLElement>()
const inner = ref<HTMLElement>()
const loading = ref(true)
const error = ref('')
let buf: ArrayBuffer | null = null
let resizeObserver: ResizeObserver | null = null
let resizeTimer: ReturnType<typeof setTimeout> | null = null

/** 按容器实际尺寸渲染（pptx-preview 的 viewPort 在 init 时固定，尺寸变化需重建） */
async function render() {
  if (!container.value || !inner.value || !buf) return
  loading.value = true
  error.value = ''
  try {
    // offsetWidth 返回布局像素，浏览器缩放或 CSS zoom 下也正确；
    // PPT 渲染进 .pptx-inner（容器宽度的 80%），居中展示
    const width = Math.max(Math.round(inner.value.offsetWidth), 320)
    const height = Math.max(Math.round(inner.value.offsetHeight), 240)
    inner.value.innerHTML = ''
    const viewer = init(inner.value, { width, height })
    await viewer.preview(buf)
    // 库会把 viewPort.height 固定为 wrapper 高度（内部小窗滚动），
    // 改为 auto 让高度随内容自适应，滚动交给外层容器
    const wrapper = inner.value.querySelector<HTMLElement>('.pptx-preview-wrapper')
    if (wrapper) {
      wrapper.style.height = 'auto'
      wrapper.style.overflowY = 'visible'
    }
    centerFirst()
    emit('rendered')
  } catch (e) {
    error.value = 'PPT 文件加载失败'
    emit('error', 'PPT 文件加载失败')
  } finally {
    loading.value = false
  }
}

/** 内容超高时 margin:auto 垂直归零，这里补偿让第一页垂直居中 */
function centerFirst() {
  if (!container.value || !inner.value) return
  const containerH = container.value.clientHeight
  const contentH = inner.value.scrollHeight
  if (contentH >= containerH) {
    const first = inner.value.querySelector('.pptx-preview-slide-wrapper')
    if (first) {
      const firstH = first.getBoundingClientRect().height
      inner.value.style.paddingTop = `${Math.max(Math.floor((containerH - firstH) / 2), 0)}px`
    }
  } else {
    inner.value.style.paddingTop = ''
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(props.src)
    if (!res.ok) throw new Error(`请求失败：${res.status}`)
    buf = await res.arrayBuffer()
    await nextTick()
    await render()
  } catch (e) {
    error.value = 'PPT 文件加载失败'
    emit('error', 'PPT 文件加载失败')
  } finally {
    loading.value = false
  }
}

/** 尺寸变化后防抖重渲染（容器变化与浏览器缩放都走这里） */
function scheduleRender() {
  if (!buf) return
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(render, 150)
}

onMounted(() => {
  if (container.value) {
    resizeObserver = new ResizeObserver(scheduleRender)
    resizeObserver.observe(container.value)
  }
  // 浏览器缩放（Ctrl ±）会触发 window resize，同样需要重新按新尺寸渲染
  window.addEventListener('resize', scheduleRender)
  load()
})

watch(() => props.src, () => {
  if (container.value) load()
})

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect()
  window.removeEventListener('resize', scheduleRender)
  if (resizeTimer) clearTimeout(resizeTimer)
  if (inner.value) inner.value.innerHTML = ''
})
</script>

<style scoped>
.preview-wrap { position: relative; display: flex; flex-direction: column; }
.preview-wrap--fill { flex: 1; min-height: 0; overflow: auto; }

.pptx-container {
  width: 100%;
  height: 100%;
  background: #fff;
  display: flex;
  overflow: auto;
}

/* PPT 渲染层占整个容器的 80%；margin:auto 使其水平垂直居中，
   内容超高时 auto margin 归零，滚动查看不受裁剪影响 */
.pptx-inner {
  width: 80%;
  flex-shrink: 0;
  margin: auto;
  padding: 0 0 12px;
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
