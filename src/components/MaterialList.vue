<script setup lang="ts">
import { ref, computed } from 'vue';
import { Message } from '@arco-design/web-vue';
import { IconEdit, IconCopy, IconExport, IconDelete, IconMore } from '@arco-design/web-vue/es/icon';
import type { Material } from '@/types';
import type { TableColumnData, TableRowSelection } from '@arco-design/web-vue';

const props = defineProps<{
  items: Material[];
  loading: boolean;
  searchQuery: string;
}>();

const emit = defineEmits<{
  select: [item: Material];
  edit: [item: Material];
  delete: [item: Material];
  batchDelete: [items: Material[]];
  'update:searchQuery': [value: string];
}>();

/* ======== 行选择 ======== */
const selectedKeys = ref<string[]>([]);

const rowSelection: TableRowSelection = {
  type: 'checkbox',
  showCheckedAll: true,
  onlyCurrent: false,
};

const hasSelection = computed(() => selectedKeys.value.length > 0);

const selectedItems = computed(() =>
  props.items.filter((m) => selectedKeys.value.includes(m.id)),
);

function clearSelection() {
  selectedKeys.value = [];
}

function handleBatchDelete() {
  emit('batchDelete', selectedItems.value);
}

/* ======== 列定义 ======== */
const columns: TableColumnData[] = [
  {
    title: '名称',
    dataIndex: 'name',
    ellipsis: true,
    tooltip: true,
    width: 200,
    slotName: 'name',
  },
  {
    title: '描述',
    dataIndex: 'desc',
    ellipsis: true,
    tooltip: true,
    width: 180,
    slotName: 'desc',
  },
  {
    title: '标签',
    width: 200,
    slotName: 'tags',
  },
  {
    title: '类型',
    dataIndex: 'ext',
    width: 80,
    slotName: 'ext',
  },
  {
    title: '日期',
    width: 130,
    slotName: 'date',
  },
  {
    title: '大小',
    dataIndex: 'size',
    width: 90,
    slotName: 'size',
  },
  {
    title: '操作',
    width: 100,
    fixed: 'right',
    slotName: 'actions',
  },
];

/* ======== 事件 ======== */
function formatDate(ts?: number | string): string {
  if (!ts) return '-';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '-';
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}/${day} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function handleCopyLink(record: Material) {
  try {
    const url = `${window.location.origin}/preview?id=${record.id}`;
    await navigator.clipboard.writeText(url);
    Message.success('链接已复制到剪贴板');
  } catch {
    Message.error('复制失败');
  }
}

function handleOpenNewWindow(record: Material) {
  const url = `${window.location.origin}/preview?id=${record.id}`;
  window.open(url, '_blank');
}
</script>

<template>
  <div class="material-list">
    <!-- 批量操作栏 -->
    <div v-if="hasSelection" class="batch-bar">
      <span class="batch-count">已选 <strong>{{ selectedKeys.length }}</strong> 项</span>
      <div class="batch-actions">
        <a-button size="small" status="danger" @click="handleBatchDelete">
          <template #icon><IconDelete /></template>
          批量删除
        </a-button>
        <a-button size="small" @click="clearSelection">取消选择</a-button>
      </div>
    </div>

    <!-- 表格 -->
    <a-table
      v-if="loading || items.length"
      class="list-table"
      :columns="columns"
      :data="items"
      :loading="loading"
      :row-selection="rowSelection"
      v-model:selected-keys="selectedKeys"
      :pagination="false"
      :bordered="{ wrapper: true, cell: false }"
      :stripe="true"
      :column-resizable="true"
      row-key="id"
      :hoverable="true"
      size="medium"
      :scroll="{ x: 1000 }"
    >
      <template #name="{ record }">
        <span class="cell-name" @click="emit('select', record)">
          <a-tooltip :content="record.name" position="top" :mouse-enter-delay="400">
            <span>{{ record.name }}</span>
          </a-tooltip>
        </span>
      </template>
      <template #desc="{ record }">
        <a-tooltip :content="record.desc || ''" position="top" :mouse-enter-delay="400">
          <span class="cell-desc">{{ record.desc || '-' }}</span>
        </a-tooltip>
      </template>
      <template #tags="{ record }">
        <div class="cell-tags" v-if="record.tags?.length">
          <a-tag v-for="tag in record.tags" :key="tag" size="small">{{ tag }}</a-tag>
        </div>
        <span v-else class="cell-muted">-</span>
      </template>
      <template #ext="{ record }">
        <a-tag v-if="record.ext" size="small" color="arcoblue">{{ record.ext.toUpperCase() }}</a-tag>
        <span v-else class="cell-muted">-</span>
      </template>
      <template #date="{ record }">
        <span class="cell-date">{{ formatDate(record.createTime) }}</span>
      </template>
      <template #size="{ record }">
        <span class="cell-size">{{ formatSize(record.size) }}</span>
      </template>
      <template #actions="{ record }">
        <div class="cell-actions" @click.stop>
          <a-dropdown trigger="click" :popup-max-height="false">
            <span class="action-btn action-more">
              <IconMore :size="18" />
            </span>
            <template #content>
              <a-doption @click="emit('edit', record)">
                <template #icon><IconEdit /></template>
                编辑
              </a-doption>
              <a-doption @click="handleCopyLink(record)">
                <template #icon><IconCopy /></template>
                复制链接
              </a-doption>
              <a-doption @click="handleOpenNewWindow(record)">
                <template #icon><IconExport /></template>
                新窗口打开
              </a-doption>
              <a-doption class="menu-item-danger" @click="emit('delete', record)">
                <template #icon><IconDelete /></template>
                删除
              </a-doption>
            </template>
          </a-dropdown>
        </div>
      </template>
    </a-table>

    <!-- 空态 -->
    <div v-else class="list-empty">
      <a-empty v-if="searchQuery.trim()" :description="`未找到「${searchQuery.trim()}」相关结果`" />
      <a-empty v-else description="暂无物料" />
    </div>
  </div>
</template>

<style scoped>
.material-list {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ======== 批量操作栏 ======== */
.batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px var(--gap-lg);
  background: var(--color-primary-light-1);
  border-bottom: 1px solid var(--color-primary-light-2);
  flex-shrink: 0;
}
.batch-count {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
}
.batch-count strong {
  font-weight: var(--font-weight-bold);
}
.batch-actions {
  display: flex;
  gap: var(--gap-sm);
}

/* ======== 表格 ======== */
.list-table {
  flex: 1;
  min-height: 0;
}

::deep(.arco-table-container) {
  border: none !important;
}

::deep(.arco-table-th) {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  letter-spacing: 0.5px;
  text-transform: uppercase;
  background: var(--color-bg-page);
}

/* ======== 单元格样式 ======== */
.cell-name {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
  cursor: pointer;
}
.cell-desc {
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}
.cell-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.cell-date {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-base);
}
.cell-size {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-base);
}
.cell-muted {
  color: var(--color-text-tertiary);
}

.cell-actions {
  display: flex;
  align-items: center;
  gap: var(--gap-xs);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text-tertiary);
  transition: all var(--duration-fast);
}
.action-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-primary);
}

/* 下拉菜单危险项 */
:deep(.menu-item-danger) {
  color: rgb(245, 63, 63) !important;
}
:deep(.menu-item-danger:hover) {
  background: var(--color-danger-light-1) !important;
}
:deep(.arco-dropdown-option-icon) {
  display: inline-flex;
  align-items: center;
}

.list-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

</style>

<style>
/* 下拉菜单面板圆角修复（非 scoped，因为下拉菜单 teleport 到 body） */
.arco-trigger-popup .arco-dropdown-menu {
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--color-border-2, #e5e6eb);
}
.arco-trigger-popup .arco-dropdown-list {
  border-radius: 6px;
  overflow: hidden;
}
</style>
