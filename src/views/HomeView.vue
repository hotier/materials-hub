<script setup lang="ts">
import { ref, onMounted, onUnmounted, onActivated, computed, watch, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Modal } from '@arco-design/web-vue';
import { IconPlus } from '@arco-design/web-vue/es/icon';
import { useApi } from '@/composables/useApi';
import { useToast } from '@/composables/useToast';
import AppHeader from '@/components/AppHeader.vue';
import Sidebar from '@/components/Sidebar.vue';
import MaterialList from '@/components/MaterialList.vue';
import EditModal from '@/components/EditModal.vue';
import type { Material } from '@/types';

const api = useApi();
const { toast } = useToast();
const router = useRouter();
const route = useRoute();

// 状态
const items = ref<Material[]>([]);
const cateMap = ref<Record<string, number>>({});
const loading = ref(true);
function getTodayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const activeDateKey = ref(getTodayKey());
const activeFolderKey = ref('');
const searchQuery = ref('');
const isSyncing = ref(false);

// 弹窗
const editTarget = ref<Material | null>(null);
const showEdit = ref(false);

// 计算
const filteredItems = computed(() => {
  let list = items.value;

  // 日期树筛选（进入文件夹时跳过日期筛选，显示文件夹内所有日期的文件）
  if (activeDateKey.value !== 'all' && !activeFolderKey.value) {
    const key = activeDateKey.value;
    list = list.filter((m) => {
      const date = m.createTime || m.uploadedAt;
      if (!date) return false;
      const d = new Date(date);
      if (isNaN(d.getTime())) return false;
      const year = String(d.getFullYear());
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');

      const parts = key.split('-');
      if (parts.length === 2) {
        return year === parts[0] && month === parts[1];
      }
      if (parts.length === 3) {
        return year === parts[0] && month === parts[1] && day === parts[2];
      }
      return year === key;
    });
  }

  // 文件夹筛选
  if (activeFolderKey.value) {
    const folderKey = activeFolderKey.value;
    list = list.filter((m) => {
      if (!m.relativePath) return false;
      return m.relativePath === folderKey || m.relativePath.startsWith(folderKey + '/');
    });
  }

  // 搜索（加权排序：文件名精确前缀 > 文件名/扩展名包含 > 路径 > 描述 > 标签）
  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    list = list
      .map((m) => {
        let score = 0;
        const nameLower = (m.name || m.filename || '').toLowerCase();
        const extLower = (m.ext || '').toLowerCase();
        const pathLower = (m.relativePath || '').toLowerCase();
        const descLower = (m.desc || '').toLowerCase();
        if (nameLower.startsWith(q) || extLower === q) score += 20;
        if (nameLower.includes(q) || extLower.includes(q)) score += 10;
        if (pathLower.includes(q)) score += 5;
        if (descLower.includes(q)) score += 3;
        if (m.tags?.some((t) => t.toLowerCase().includes(q))) score += 2;
        return { item: m, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
  }
  return list;
});

/** 调试：搜索 / 日期 / 文件夹变化时打印，便于定位状态卡死（必须放在 filteredItems 之后） */
watch([searchQuery, activeDateKey, activeFolderKey, () => items.value.length], () => {
  console.log('[HomeView] state:', {
    search: searchQuery.value,
    date: activeDateKey.value,
    folder: activeFolderKey.value,
    items: items.value.length,
    filtered: filteredItems.value.length,
  });
}, { immediate: true });

defineOptions({ name: 'HomeView' });

// 路由守卫已处理鉴权重定向，此处直接加载数据
onMounted(async () => {
  console.log('[HomeView] mounted, loading list...');
  await loadList();
});

// keep-alive 激活时静默刷新（从预览/上传页返回）
onActivated(() => {
  loadList();
  // 解除 popup 隐藏 + 清理残留
  document.body.classList.remove('arco-popup-hidden');
  nextTick(clearAllArcoPopups);
});

/** 清理所有残留的 Arco popup DOM */
function clearAllArcoPopups() {
  document
    .querySelectorAll('.arco-tooltip-popup, .arco-trigger-popup, .arco-dropdown-popup, .arco-popover-popup, .arco-select-popup')
    .forEach((el) => {
      if (
        el.querySelector('.arco-tooltip-content') ||
        el.querySelector('.arco-dropdown-menu') ||
        el.querySelector('.arco-popover-content') ||
        el.classList.contains('arco-tooltip-popup')
      ) {
        el.remove();
      }
    });
}

// 方法
function getLatestDateKey(list: Material[]): string {
  if (!list.length) return 'all';
  const dates = new Set<string>();
  for (const m of list) {
    const raw = m.createTime || m.uploadedAt;
    if (!raw) continue;
    const d = new Date(raw);
    if (isNaN(d.getTime())) continue;
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    dates.add(k);
  }
  if (!dates.size) return 'all';
  return [...dates].sort().pop()!;
}

function hasFilesForDate(list: Material[], key: string): boolean {
  if (key === 'all') return true;
  return list.some((m) => {
    const raw = m.createTime || m.uploadedAt;
    if (!raw) return false;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return false;
    const y = String(d.getFullYear());
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const parts = key.split('-');
    if (parts.length === 3) return y === parts[0] && mo === parts[1] && da === parts[2];
    if (parts.length === 2) return y === parts[0] && mo === parts[1];
    return y === key;
  });
}

async function loadList() {
  loading.value = true;
  try {
    const res = await api.list();
    if (res?.success !== false) {
      items.value = (res.data || []) as Material[];
      cateMap.value = res.cateMap || {};
      // 如果当前选中的日期没有文件，自动定位到最新有文件的日期
      if (!hasFilesForDate(items.value, activeDateKey.value)) {
        activeDateKey.value = getLatestDateKey(items.value);
        activeFolderKey.value = '';
      }
    }
  } catch (e: any) {
    console.error('[HomeView] loadList error:', e);
    toast('加载失败，请刷新重试', 'error');
  } finally {
    loading.value = false;
  }
}

function handleSidebarSelect(key: string) {
  // 侧边栏仅含「全部 / 按时间」，都是日期维度
  if (key === 'all' || /^\d{4}(-\d{2}){0,2}$/.test(key)) {
    activeDateKey.value = key;
  }
  // 切换时间维度时，退出文件夹下钻并清空搜索词
  activeFolderKey.value = '';
  searchQuery.value = '';
}

/** 文件夹下钻：进入某文件夹路径（由列表区点击触发） */
function handleDrill(path: string) {
  // 从「全部」点击文件夹时，自动定位到该文件夹内最新文件的日期
  if (activeDateKey.value === 'all') {
    const folderFiles = items.value.filter((m) => {
      const rp = m.relativePath || '';
      return rp === path || rp.startsWith(path + '/');
    });
    if (folderFiles.length) {
      const latest = getLatestDateKey(folderFiles);
      if (latest !== 'all') {
        activeDateKey.value = latest;
      }
    }
  }
  activeFolderKey.value = path;
  searchQuery.value = '';
}

/** 点击面包屑回到某层（含空串=全部） */
function handleCrumb(path: string) {
  activeFolderKey.value = path;
  searchQuery.value = '';
}

/** 点击面包屑的时间层级（年/月/日），回到对应时间并退出文件夹下钻 */
function handleNavigateDate(key: string) {
  activeDateKey.value = key;
  activeFolderKey.value = '';
  searchQuery.value = '';
}

function handleSelectItem(item: Material) {
  // 先清理 popup，防止 tooltip 残留到预览页
  clearAllArcoPopups();
  nextTick(() => router.push({ path: '/preview', query: { id: item.id } }));
}

function handleEdit(item: Material) {
  editTarget.value = item;
  showEdit.value = true;
}

function handleDelete(item: Material) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除「${item.name}」吗？此操作不可撤销。`,
    okText: '删除',
    cancelText: '取消',
    okButtonProps: { status: 'danger' },
    onOk: async () => {
      try {
        const res = await api.remove(item.id);
        if (res.success) {
          toast('删除成功', 'success');
          await loadList();
        }
      } catch (err: any) {
        toast(err?.message || '删除失败', 'error');
      }
    },
  });
}

function handleBatchDelete(items: Material[]) {
  if (!items.length) return;
  Modal.confirm({
    title: '批量删除',
    content: `确定要删除选中的 ${items.length} 个物料吗？此操作不可撤销。`,
    okText: '删除',
    cancelText: '取消',
    okButtonProps: { status: 'danger' },
    onOk: async () => {
      try {
        const results = await Promise.all(items.map((m) => api.remove(m.id)));
        const allOk = results.every((r: any) => r.success);
        toast(allOk ? `已删除 ${items.length} 个物料` : '部分删除失败，请刷新查看', allOk ? 'success' : 'warning');
        await loadList();
      } catch (err: any) {
        toast(err?.message || '批量删除失败', 'error');
      }
    },
  });
}

async function handleSaved() {
  showEdit.value = false;
  editTarget.value = null;
  toast('保存成功', 'success');
  await loadList();
}

async function handleSync() {
  isSyncing.value = true;
  try {
    await loadList();
    toast('同步完成', 'success');
  } catch {
    toast('同步失败', 'error');
  } finally {
    isSyncing.value = false;
  }
}

// 悬浮上传按钮 — 拖拽
const fabRef = ref<HTMLElement | null>(null);
const fabPos = ref({ x: 0, y: 0 });
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });
const hasMoved = ref(false);

function onFabPointerDown(e: PointerEvent) {
  e.preventDefault();
  isDragging.value = true;
  hasMoved.value = false;
  dragStart.value = { x: e.clientX - fabPos.value.x, y: e.clientY - fabPos.value.y };
  (fabRef.value as HTMLElement)!.setPointerCapture(e.pointerId);
}

function onFabPointerMove(e: PointerEvent) {
  if (!isDragging.value) return;
  const dx = e.clientX - dragStart.value.x;
  const dy = e.clientY - dragStart.value.y;
  if (Math.abs(e.clientX - (dragStart.value.x + fabPos.value.x)) > 3 ||
      Math.abs(e.clientY - (dragStart.value.y + fabPos.value.y)) > 3) {
    hasMoved.value = true;
  }
  fabPos.value = {
    x: Math.min(Math.max(dx, 16), window.innerWidth - 72),
    y: Math.min(Math.max(dy, 16), window.innerHeight - 72),
  };
}

function onFabPointerUp() {
  isDragging.value = false;
}

function handleFabClick() {
  if (hasMoved.value) return;
  router.push('/upload');
}

function initFabPos() {
  fabPos.value = { x: window.innerWidth - 80, y: window.innerHeight - 80 };
}

onMounted(() => { initFabPos(); window.addEventListener('resize', initFabPos); });
onUnmounted(() => { window.removeEventListener('resize', initFabPos); });
</script>

<template>
  <a-layout class="home-layout">
    <!-- 顶部导航 -->
    <a-layout-header class="home-header">
      <AppHeader
        v-model:search-query="searchQuery"
        :is-syncing="isSyncing"
        :loading="loading"
        @sync="handleSync"
        @refresh="loadList"
      />
    </a-layout-header>

    <!-- 主体区域：侧栏 + 内容 -->
    <a-layout class="home-body" has-sider>
      <a-layout-sider
        class="home-sider"
        :width="220"
        :collapsible="false"
        hide-trigger
      >
        <Sidebar
          :items="items"
          :selected-key="activeDateKey"
          @select="handleSidebarSelect"
        />
      </a-layout-sider>

      <a-layout-content class="home-content">
        <div class="home-content-inner">
          <MaterialList
            :items="filteredItems"
            :loading="loading"
            :search-query="searchQuery"
            :current-folder="activeFolderKey"
            :date-key="activeDateKey"
            @select="handleSelectItem"
            @edit="handleEdit"
            @delete="handleDelete"
            @batch-delete="handleBatchDelete"
            @drill="handleDrill"
            @crumb="handleCrumb"
            @navigate-date="handleNavigateDate"
            @update:search-query="(v: string) => searchQuery = v"
          />
        </div>
      </a-layout-content>
    </a-layout>

    <!-- 悬浮上传按钮 -->
    <button
      ref="fabRef"
      class="fab-upload"
      :style="{ left: fabPos.x + 'px', top: fabPos.y + 'px' }"
      :class="{ 'fab-dragging': isDragging }"
      @pointerdown="onFabPointerDown"
      @pointermove="onFabPointerMove"
      @pointerup="onFabPointerUp"
      @click="handleFabClick"
    >
      <IconPlus :size="24" />
    </button>

    <!-- 编辑弹窗 -->
    <EditModal
      :item="editTarget"
      :visible="showEdit"
      :categories="Object.keys(cateMap)"
      @close="showEdit = false"
      @saved="handleSaved"
    />
  </a-layout>
</template>

<style scoped>
.home-layout {
  height: 100vh;
  overflow: hidden;
  background: var(--color-bg-page);
}

.home-header {
  --layout-header-height: 52px;
  display: flex;
  align-items: center;
  height: 52px;
  padding: 0 var(--gap-lg);
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border-light);
}

.home-body {
  flex: 1;
  overflow: hidden;
}

.home-sider {
  background: var(--color-bg-surface);
  border-right: 1px solid var(--color-border-light);
}

.home-content {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.home-content-inner {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

@media (max-width: 768px) {
  .home-body {
    flex-direction: column;
  }
}

/* 悬浮上传按钮 */
.fab-upload {
  position: fixed;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  box-shadow: 0 4px 20px rgba(0, 113, 227, 0.35);
  transition: box-shadow var(--duration-fast) var(--ease-out),
              transform var(--duration-fast) var(--ease-out),
              background var(--duration-fast);
  z-index: 1000;
  touch-action: none;
  user-select: none;
}

.fab-upload:hover {
  background: var(--color-primary-hover);
  box-shadow: 0 6px 28px rgba(0, 113, 227, 0.45);
  transform: scale(1.06);
}

.fab-upload:active,
.fab-dragging {
  cursor: grabbing;
  transform: scale(1.1);
  box-shadow: 0 8px 36px rgba(0, 113, 227, 0.5);
}
</style>
