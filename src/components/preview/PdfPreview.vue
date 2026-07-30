<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.7.284/build/pdf.worker.min.mjs'

const props = defineProps<{ url: string }>()
const emit = defineEmits<{ rendered: []; error: [msg: string] }>()

// ---- state ----
const loading = ref(true)
const errorMsg = ref('')
const pageCount = ref(0)
const currentPage = ref(1)
const scale = ref(1)
const sidebarOpen = ref(true)
const pageInput = ref(1)

let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null
let aborted = false
const canvasEls: Record<number, HTMLCanvasElement> = {}
const textLayerEls: Record<number, HTMLDivElement> = {}
const pageContainers: Record<number, HTMLElement> = {}
const thumbItems: Record<number, HTMLElement> = {}
const thumbCanvases: Record<number, HTMLCanvasElement> = {}
const contentRef = ref<HTMLElement>()
const thumbListRef = ref<HTMLElement>()
const renderedPages = new Set<number>()
const pendingRenders = new Set<Promise<void>>()

// ---- helpers ----
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

async function loadDoc() {
  loading.value = true
  errorMsg.value = ''
  aborted = false
  try {
    const data = await fetch(props.url).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.arrayBuffer()
    })
    pdfDoc = await pdfjsLib.getDocument({ data }).promise
    pageCount.value = pdfDoc.numPages
    currentPage.value = 1
    pageInput.value = 1
  } catch (e: any) {
    errorMsg.value = e?.message || 'PDF 加载失败'
    emit('error', errorMsg.value)
  } finally {
    loading.value = false
    // wait for v-else DOM mount + layout, compute accurate scale, then render
    await nextTick()
    if (!aborted && !errorMsg.value && pdfDoc) {
      scale.value = 1
      renderAll()
      emit('rendered')
    }
  }
}

// ---- canvas rendering ----
async function renderPageCanvas(pageNum: number): Promise<number> {
  if (aborted || !pdfDoc) return 0
  const canvas = canvasEls[pageNum]
  if (!canvas) return 0
  const page = await pdfDoc.getPage(pageNum)
  if (aborted) return 0
  const dpr = window.devicePixelRatio || 1
  const viewport = page.getViewport({ scale: scale.value * dpr })
  if (aborted) return 0
  canvas.height = viewport.height
  canvas.width = viewport.width
  canvas.style.height = `${viewport.height / dpr}px`
  canvas.style.width = `${viewport.width / dpr}px`
  if (aborted) return 0
  await page.render({ canvas, viewport }).promise
  return viewport.height / dpr
}

// ---- text layer ----
async function renderTextLayer(pageNum: number) {
  if (aborted || !pdfDoc) return
  const layer = textLayerEls[pageNum]
  if (!layer) return
  layer.innerHTML = ''
  const page = await pdfDoc.getPage(pageNum)
  if (aborted) return
  const viewport = page.getViewport({ scale: scale.value })
  const textContent = await page.getTextContent()
  const { items } = textContent as any
  if (!items?.length) return

  const scaleX = viewport.width / page.view[2]
  const scaleY = viewport.height / page.view[3] * -1 // invert Y
  const offsetY = viewport.height

  for (const item of items) {
    if (!item.str?.trim()) continue
    const tx = item.transform
    const left = tx[4] * scaleX
    const top = offsetY + tx[5] * scaleY - (item.height * scale.value)
    const fontSize = Math.abs(tx[0]) * scaleX

    const span = document.createElement('span')
    span.textContent = item.str
    span.style.cssText = `
      position:absolute;left:${left}px;top:${top}px;
      font-size:${fontSize}px;font-family:sans-serif;
      color:transparent;white-space:pre;pointer-events:auto;
      line-height:1;
    `
    layer.appendChild(span)
  }
}

// ---- render a single page ----
async function renderPage(pageNum: number) {
  if (aborted || !pdfDoc || renderedPages.has(pageNum)) return
  renderedPages.add(pageNum)
  await renderPageCanvas(pageNum)
  if (!aborted) renderTextLayer(pageNum)
}

function tracked(p: Promise<void>) {
  pendingRenders.add(p)
  p.finally(() => pendingRenders.delete(p))
}

// ---- render all pages progressively ----
function renderAll() {
  renderedPages.clear()
  for (let i = 1; i <= pageCount.value; i++) {
    tracked(renderPage(i))
  }
  nextTick(() => scrollThumbIntoView(currentPage.value))
}

// ---- thumbnails ----
async function renderThumbnail(pageNum: number) {
  if (!pdfDoc) return
  const canvas = thumbCanvases[pageNum]
  if (!canvas) return
  const page = await pdfDoc.getPage(pageNum)
  const dpr = window.devicePixelRatio || 1
  const thumbScale = 0.25 * dpr
  const viewport = page.getViewport({ scale: thumbScale })
  canvas.height = viewport.height
  canvas.width = viewport.width
  canvas.style.height = `${viewport.height / dpr}px`
  canvas.style.width = `${viewport.width / dpr}px`
  await page.render({ canvas, viewport }).promise
}

function setThumbCanvas(page: number, el: any) {
  if (el) {
    thumbCanvases[page] = el as HTMLCanvasElement
    renderThumbnail(page)
  }
}

function scrollThumbIntoView(page: number) {
  const el = thumbItems[page]
  if (el && thumbListRef.value) {
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

// ---- page refs for template ----
function setPageRef(page: number, el: any) {
  if (el) pageContainers[page] = el as HTMLElement
}
function setThumbRef(page: number, el: any) {
  if (el) thumbItems[page] = el as HTMLElement
}
function setPageCanvas(page: number, el: any) {
  if (el && !aborted) {
    canvasEls[page] = el as HTMLCanvasElement
    // don't auto-render here — wait for loadDoc's renderAll() to apply correct scale
  }
}
function setTextLayer(page: number, el: any) {
  if (el) textLayerEls[page] = el as HTMLDivElement
}

// ---- navigation ----
function goToPage(page: number) {
  const p = clamp(Math.trunc(page) || 1, 1, pageCount.value)
  currentPage.value = p
  pageInput.value = p
  const el = pageContainers[p]
  if (el && contentRef.value) {
    el.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }
  scrollThumbIntoView(p)
}
function prevPage() { goToPage(currentPage.value - 1) }
function nextPage() { goToPage(currentPage.value + 1) }

function zoomIn() {
  scale.value = clamp(+(scale.value + 0.25).toFixed(2), 0.5, 4)
  rerender()
}
function zoomOut() {
  scale.value = clamp(+(scale.value - 0.25).toFixed(2), 0.5, 4)
  rerender()
}
function getAvailableWidth(): number {
  // try contentRef parent (.pdf-main, flex child with known width)
  const main = contentRef.value?.parentElement as HTMLElement | null
  if (main) {
    const style = getComputedStyle(main)
    const pw = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
    const w = main.clientWidth - pw - 16 // 16 for scrollbar
    if (w > 100) return w
  }
  // fallback: use viewport minus sidebar & padding
  return window.innerWidth - (sidebarOpen.value ? 200 : 0) - 64
}

function fitWidth() {
  if (!pdfDoc) return
  const w = getAvailableWidth()
  if (w <= 0) return
  pdfDoc.getPage(1).then(page => {
    const [llx, , urx] = page.view
    const pageW = urx - llx
    scale.value = +(w / pageW).toFixed(2)
    rerender()
  })
}

function rerender() {
  renderedPages.clear()
  for (let i = 1; i <= pageCount.value; i++) {
    tracked(renderPage(i))
  }
}

// ---- scroll-based page detection ----
let scrollTicking = false
function onContentScroll() {
  if (scrollTicking) return
  scrollTicking = true
  requestAnimationFrame(() => {
    if (!contentRef.value) return
    const containers = Object.values(pageContainers)
    let nearest = 1
    let minDist = Infinity
    const viewTop = contentRef.value.scrollTop
    for (const el of containers) {
      const dist = Math.abs(el.offsetTop - viewTop)
      if (dist < minDist) {
        minDist = dist
        nearest = parseInt(el.dataset.page || '1')
      }
    }
    if (nearest !== currentPage.value) {
      currentPage.value = nearest
      pageInput.value = nearest
      scrollThumbIntoView(nearest)
    }
    scrollTicking = false
  })
}

// ---- keyboard ----
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); prevPage() }
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); nextPage() }
}

// ---- lifecycle ----
onMounted(() => {
  loadDoc()
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  aborted = true
  document.removeEventListener('keydown', onKeydown)
  pdfDoc?.destroy()
  pdfDoc = null
  pendingRenders.clear()
  renderedPages.clear()
})

watch(() => props.url, () => {
  if (pdfDoc) { pdfDoc.destroy(); pdfDoc = null }
  renderedPages.clear()
  loadDoc()
})
</script>

<template>
  <div class="pdf-viewer" :class="{ 'sidebar-hidden': !sidebarOpen }">
    <!-- Error -->
    <div v-if="errorMsg" class="pdf-error">
      <svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" stroke-width="1.5" fill="none">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p>{{ errorMsg }}</p>
    </div>

    <!-- Loading -->
    <div v-else-if="loading" class="pdf-loading">
      <a-spin :loading="true" tip="解析 PDF 中..." />
    </div>

    <template v-else>
      <!-- Thumbnail Sidebar -->
      <aside class="pdf-sidebar">
        <div class="sidebar-header">
          <span>页面缩略图</span>
        </div>
        <div class="thumb-list" ref="thumbListRef">
          <div
            v-for="p in pageCount"
            :key="p"
            class="thumb-item"
            :class="{ active: currentPage === p }"
            :data-page="p"
            :ref="(el: any) => setThumbRef(p, el)"
            @click="goToPage(p)"
          >
            <canvas :ref="(el: any) => setThumbCanvas(p, el)" />
            <span class="thumb-label">{{ p }}</span>
          </div>
        </div>
      </aside>

      <!-- Main -->
      <div class="pdf-main">
        <!-- Toolbar -->
        <div class="pdf-toolbar">
          <div class="toolbar-left">
            <button
              v-if="!sidebarOpen"
              class="toolbar-btn"
              @click="sidebarOpen = true"
              title="展开侧栏"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
              </svg>
            </button>
            <button
              v-else
              class="toolbar-btn"
              @click="sidebarOpen = false"
              title="收起侧栏"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
              </svg>
            </button>
          </div>

          <div class="toolbar-center">
            <button class="toolbar-btn" :disabled="currentPage <= 1" @click="prevPage" title="上一页">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <input
              class="page-input"
              v-model.number="pageInput"
              @keyup.enter="goToPage(pageInput)"
              @blur="pageInput = currentPage"
            />
            <span class="page-total">/ {{ pageCount }}</span>
            <button class="toolbar-btn" :disabled="currentPage >= pageCount" @click="nextPage" title="下一页">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          <div class="toolbar-right">
            <button class="toolbar-btn" :disabled="scale <= 0.5" @click="zoomOut" title="缩小">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>
            <span class="zoom-label">{{ Math.round(scale * 100) }}%</span>
            <button class="toolbar-btn" :disabled="scale >= 4" @click="zoomIn" title="放大">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>
            <button class="toolbar-btn" @click="fitWidth" title="适应宽度">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            </button>
          </div>
        </div>

        <!-- Pages -->
        <div class="pdf-content" ref="contentRef" @scroll="onContentScroll">
          <div
            v-for="p in pageCount"
            :key="p"
            class="page-wrapper"
            :data-page="p"
            :ref="(el: any) => setPageRef(p, el)"
          >
            <div class="page-container">
              <canvas :ref="(el: any) => setPageCanvas(p, el)" />
              <div class="text-layer" :ref="(el: any) => setTextLayer(p, el)" />
            </div>
            <div class="page-footer">{{ p }}</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* ====== Container ====== */
.pdf-viewer {
  display: flex;
  height: 100%;
  background: #f5f5f5;
  position: relative;
}

/* ====== Error / Loading ====== */
.pdf-error,
.pdf-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--gap-md);
  flex: 1;
  color: #999;
}
.pdf-error svg { color: var(--color-danger); }

/* ====== Sidebar ====== */
.pdf-sidebar {
  width: 200px;
  min-width: 200px;
  background: #ebebeb;
  border-right: 1px solid #d9d9d9;
  display: flex;
  flex-direction: column;
  transition: width 0.2s, min-width 0.2s, opacity 0.2s;
  overflow: hidden;
}
.sidebar-hidden .pdf-sidebar {
  width: 0;
  min-width: 0;
  border-right: none;
  opacity: 0;
  pointer-events: none;
}

.sidebar-header {
  display: flex;
  align-items: center;
  height: 42px;
  padding: 6px 12px;
  font-size: 12px;
  color: #666;
  flex-shrink: 0;
  border-bottom: 1px solid #d9d9d9;
  box-sizing: border-box;
}

.thumb-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.thumb-item {
  cursor: pointer;
  border: 2px solid transparent;
  border-radius: 4px;
  padding: 2px;
  background: #fff;
  transition: border-color 0.15s;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.thumb-item:hover { border-color: #bbb; }
.thumb-item.active { border-color: #4a90d9; }

.thumb-item canvas {
  display: block;
  max-width: 160px;
  height: auto;
}
.thumb-label {
  font-size: 10px;
  color: #888;
  margin-top: 2px;
}

/* ====== Main ====== */
.pdf-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

/* ====== Toolbar ====== */
.pdf-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: #e8e8e8;
  border-bottom: 1px solid #d9d9d9;
  flex-shrink: 0;
  gap: 12px;
}
.toolbar-left,
.toolbar-center,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}
.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}
.toolbar-btn:hover { background: #d9d9d9; color: #333; }
.toolbar-btn:disabled { opacity: 0.3; cursor: default; }
.toolbar-btn:disabled:hover { background: none; color: #666; }

.page-input {
  width: 44px;
  height: 28px;
  text-align: center;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  color: #333;
  font-size: 13px;
  outline: none;
}
.page-input:focus { border-color: #4a90d9; }
.page-total {
  font-size: 13px;
  color: #666;
  margin: 0 2px;
}
.zoom-label {
  font-size: 12px;
  color: #666;
  min-width: 40px;
  text-align: center;
  user-select: none;
}

/* ====== Pages Content ====== */
.pdf-content {
  flex: 1;
  overflow: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.pdf-content::-webkit-scrollbar { width: 8px; }
.pdf-content::-webkit-scrollbar-track { background: #e8e8e8; }
.pdf-content::-webkit-scrollbar-thumb { background: #bbb; border-radius: 4px; }

.page-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.page-container {
  position: relative;
  box-shadow: 0 2px 16px rgba(0,0,0,0.4);
  background: #fff;
  line-height: 0;
}
.page-container canvas {
  display: block;
}
.page-footer {
  font-size: 11px;
  color: #999;
  margin-top: 6px;
  user-select: none;
}

/* ====== Text Layer ====== */
.text-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  pointer-events: none;
  line-height: 1;
}
.text-layer ::selection {
  background: rgba(0, 100, 255, 0.35);
}

/* ====== Sidebar & Content Scrollbars ====== */
.thumb-list::-webkit-scrollbar { width: 6px; }
.thumb-list::-webkit-scrollbar-track { background: transparent; }
.thumb-list::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }
</style>

<!-- non-scoped: text layer selection must work even with scoped -->
<style>
.pdf-viewer .text-layer span {
  position: absolute;
  color: transparent;
  white-space: pre;
  pointer-events: auto;
  cursor: text;
  font-family: sans-serif;
  line-height: 1;
}
.pdf-viewer .text-layer span::selection {
  background: rgba(0, 100, 255, 0.35);
  color: transparent;
}
</style>
