<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
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
const searchQuery = ref('');
const isSyncing = ref(false);

// 弹窗
const editTarget = ref<Material | null>(null);
const showEdit = ref(false);

// 计算
const filteredItems = computed(() => {
  let list = items.value;

  // 日期树筛选
  if (activeDateKey.value !== 'all') {
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

  // 搜索（加权排序：文件名 > 描述 > 标签）
  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    list = list
      .map((m) => {
        let score = 0
        if (m.filename?.toLowerCase().includes(q) || m.name?.toLowerCase().includes(q))
          score += 10
        if (m.desc?.toLowerCase().includes(q))
          score += 5
        if (m.tags?.some((t) => t.toLowerCase().includes(q)))
          score += 3
        return { item: m, score }
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item)
  }
  return list;
});

// 路由守卫已处理鉴权重定向，此处直接加载数据
onMounted(async () => {
  console.log('[HomeView] mounted, loading list...');
  await loadList();
});

// 监听路由变化，确保从其他页面返回时刷新列表
watch(
  () => route.path,
  (to, from) => {
    if (to === '/') {
      console.log('[HomeView] route changed, reloading list...');
      loadList();
    }
  },
);

// 方法
async function loadList() {
  loading.value = true;
  try {
    const res = await api.list();
    if (res?.success !== false) {
      items.value = (res.data || res.items || []) as Material[];
      cateMap.value = res.cateMap || {};
      console.log('[HomeView] list loaded:', items.value.length, 'items');
    }
  } catch (e: any) {
    console.error('[HomeView] loadList error:', e);
    toast('加载失败，请刷新重试', 'error');
  } finally {
    loading.value = false;
  }
}

function handleSelectDate(key: string) {
  activeDateKey.value = key;
}

function handleSelectItem(item: Material) {
  router.push({ path: '/preview', query: { id: item.id } });
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
  fabPos.value = { x: window.innerWidth - 68, y: window.innerHeight - 100 };
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
          @select="handleSelectDate"
        />
      </a-layout-sider>

      <a-layout-content class="home-content">
        <div class="home-content-inner">
          <MaterialList
            :items="filteredItems"
            :loading="loading"
            :search-query="searchQuery"
            @select="handleSelectItem"
            @edit="handleEdit"
            @delete="handleDelete"
            @batch-delete="handleBatchDelete"
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
