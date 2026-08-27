<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { Message } from '@arco-design/web-vue';
import {
  IconEdit,
  IconCopy,
  IconExport,
  IconDelete,
  IconMore,
  IconFolder,
} from '@arco-design/web-vue/es/icon';
import type { Material } from '@/types';
import type { TableColumnData, TableData } from '@arco-design/web-vue';
import { getExtIcon, getExtColor, FOLDER_COLOR } from '@/utils/fileType';
import { useApi } from '@/composables/useApi';
import { usePreview } from '@/composables/usePreview';
import EllipsisTooltip from '@/components/EllipsisTooltip.vue';

const props = defineProps<{
  items: Material[];
  loading: boolean;
  searchQuery: string;
  currentFolder: string;
  dateKey: string;
}>();

const emit = defineEmits<{
  select: [item: Material];
  edit: [item: Material];
  delete: [item: Material];
  batchDelete: [items: Material[]];
  'update:searchQuery': [value: string];
  drill: [path: string];
  crumb: [path: string];
  'navigate-date': [key: string];
}>();

const route = useRoute();

// 监听路由变化，清理残留的 tooltip
watch(() => route.fullPath, () => {
  clearAllPopups();
});

/* ======== 文件夹下钻 ======== */
interface FolderEntry {
  name: string;
  fullPath: string;
  count: number;
  latestDate?: number | string;
  totalSize: number;
}

/** 统一行数据：文件夹或文件 */
interface UnifiedRow {
  kind: 'folder' | 'file';
  key: string;
  name: string;
  fullPath: string;
  count?: number;
  latestDate?: number | string;
  totalSize?: number;
  material?: Material;
}

/** 判断物料是否属于当前文件夹范围（currentFolder 为空 = 根/某一天） */
function inScope(rp: string): boolean {
  if (!props.currentFolder) return true;
  return rp === props.currentFolder || rp.startsWith(props.currentFolder + '/');
}

/** 当前文件夹下的「下一级文件夹」列表（含计数）。
 *  根目录即某一天：当天文件的 relativePath 指向其所在文件夹，
 *  因此列表先显示文件夹卡片，点击文件夹才下钻显示其内部文件。 */
const folderList = computed<FolderEntry[]>(() => {
  const map = new Map<string, FolderEntry>();
  for (const m of props.items) {
    const rp = m.relativePath || '';
    if (!inScope(rp)) continue;
    const rest = props.currentFolder ? rp.slice(props.currentFolder.length + 1) : rp;
    if (!rest) continue; // 文件就在此文件夹内，不视为子文件夹
    const slash = rest.indexOf('/');
    const name = slash === -1 ? rest : rest.slice(0, slash);
    const fullPath = props.currentFolder ? `${props.currentFolder}/${name}` : name;
    const entry = map.get(fullPath) ?? { name, fullPath, count: 0, latestDate: undefined, totalSize: 0 };
    entry.count += 1;
    // 累加文件大小
    entry.totalSize += m.size || 0;
    // 收集文件夹内最新文件日期
    const fileDate = m.createTime || m.uploadedAt;
    if (fileDate) {
      const curr = new Date(fileDate).getTime();
      if (!isNaN(curr)) {
        const prev = entry.latestDate ? new Date(entry.latestDate).getTime() : -Infinity;
        if (curr > prev) {
          entry.latestDate = fileDate;
        }
      }
    }
    map.set(fullPath, entry);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh'));
});

/** 直接位于当前文件夹内的文件（其 relativePath 即当前文件夹） */
const fileList = computed<Material[]>(() => {
  return props.items.filter((m) => {
    const rp = m.relativePath || '';
    if (!inScope(rp)) return false;
    const rest = props.currentFolder ? rp.slice(props.currentFolder.length + 1) : rp;
    return rest === '';
  });
});

/** 筛选时使用：当前作用域内的所有文件（包括子文件夹内的） */
const allFilesInScope = computed<Material[]>(() => {
  return props.items.filter((m) => inScope(m.relativePath || ''));
});

/* ======== 排序和筛选状态 ======== */
type SortDirection = 'ascend' | 'descend' | '';
const sortField = ref<string>('date');
const sortDirection = ref<SortDirection>('descend');
const filterState = ref<Record<string, string[]>>({});

/** 判断是否有激活的筛选条件 */
const hasActiveFilter = computed(() => {
  return Object.values(filterState.value).some((v) => v && v.length > 0);
});

/** 统一列表：文件夹与文件混排，默认按日期从近到远排序
 *  当有筛选条件时，显示所有匹配的文件（包括子文件夹内的），不显示文件夹行 */
const unifiedList = computed<UnifiedRow[]>(() => {
  if (hasActiveFilter.value) {
    // 筛选模式：显示所有匹配的文件（包括子文件夹内的）
    return allFilesInScope.value.map((m) => ({
      kind: 'file' as const,
      key: `file:${m.id}`,
      name: m.name,
      fullPath: m.relativePath || '',
      material: m,
    })).sort((a, b) => {
      const aDate = a.material?.createTime || 0;
      const bDate = b.material?.createTime || 0;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
  }

  // 默认模式：显示当前层级的文件夹 + 文件
  const folderRows: UnifiedRow[] = folderList.value.map((f) => ({
    kind: 'folder',
    key: `folder:${f.fullPath}`,
    name: f.name,
    fullPath: f.fullPath,
    count: f.count,
    latestDate: f.latestDate,
    totalSize: f.totalSize,
  }));
  const fileRows: UnifiedRow[] = fileList.value.map((m) => ({
    kind: 'file',
    key: `file:${m.id}`,
    name: m.name,
    fullPath: m.relativePath || '',
    material: m,
  }));
  return [...folderRows, ...fileRows].sort((a, b) => {
    const aDate = a.material?.createTime || a.latestDate || 0;
    const bDate = b.material?.createTime || b.latestDate || 0;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
});

/** 面包屑：年 - 月 - 日 - 文件夹 - 子文件夹 ... 完整层级路径 */
interface CrumbItem {
  label: string;
  type: 'date' | 'folder';
  key: string;
}
const breadcrumb = computed<CrumbItem[]>(() => {
  const items: CrumbItem[] = [{ label: '首页', type: 'date', key: 'all' }];
  if (!props.dateKey || props.dateKey === 'all') {
    // 只有首页
  } else {
    const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(props.dateKey);
    if (m) {
      if (m[1]) items.push({ label: `${m[1]}年`, type: 'date', key: m[1] });
      if (m[2]) items.push({ label: `${Number(m[2])}月`, type: 'date', key: `${m[1]}-${m[2]}` });
      if (m[3]) items.push({ label: `${Number(m[3])}日`, type: 'date', key: `${m[1]}-${m[2]}-${m[3]}` });
    }
  }
  if (props.currentFolder) {
    const parts = props.currentFolder.split('/');
    let acc = '';
    for (const p of parts) {
      acc = acc ? `${acc}/${p}` : p;
      items.push({ label: p, type: 'folder', key: acc });
    }
  }
  return items;
});

function handleDrill(path: string) {
  emit('drill', path);
}
function handleCrumb(path: string) {
  emit('crumb', path);
}

/** 清理所有残留的 Arco popup DOM */
function clearAllPopups() {
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

/** 行点击：文件夹下钻 */
function handleRowClick(row: UnifiedRow) {
  clearAllPopups();
  emit('drill', row.fullPath);
}

/** 文件行点击：先清理 popup 再导航 */
function handleFileClick(material: Material) {
  clearAllPopups();
  emit('select', material);
}

/** 给文件夹行添加特殊 class */
function getRowClassName(row: UnifiedRow): string {
  return row.kind === 'folder' ? 'row-folder' : '';
}

/** 表格容器高度，用于计算 scroll.y */
const listRef = ref<HTMLElement | null>(null);
const tableScrollY = ref(300);

function calcScrollY() {
  if (!listRef.value) return;
  const h = listRef.value.clientHeight;
  tableScrollY.value = Math.max(200, h - 48); // 48 = Arco 表头高度
}

let resizeObserver: ResizeObserver | null = null;

/* ======== 移动端检测（768px 以下），用于响应式列定义 ======== */
const isMobile = ref(false);
let mq: MediaQueryList | null = null;

function updateIsMobile() {
  isMobile.value = window.matchMedia('(max-width: 768px)').matches;
}

onMounted(() => {
  mq = window.matchMedia('(max-width: 768px)');
  updateIsMobile();
  mq.addEventListener('change', updateIsMobile);
  nextTick(() => {
    calcScrollY();
    if (listRef.value) {
      resizeObserver = new ResizeObserver(() => calcScrollY());
      resizeObserver.observe(listRef.value);
    }
  });
});

onUnmounted(() => {
  mq?.removeEventListener('change', updateIsMobile);
  resizeObserver?.disconnect();
  clearAllPopups();
});

/* ======== 行选择 ======== */
const selectedKeys = ref<string[]>([]);

/** 空态描述（用于表格空态） */
const emptyDescription = computed(() => {
  if (props.searchQuery.trim()) {
    return `未找到「${props.searchQuery.trim()}」相关结果`;
  }
  if (hasActiveFilter.value) {
    return '没有符合筛选条件的物料';
  }
  return '暂无物料';
});

/** 类型筛选选项（仅当前作用域内的文件） */
const extFilterOptions = computed(() => {
  const exts = new Set<string>();
  for (const m of props.items) {
    if (inScope(m.relativePath || '') && m.ext) exts.add(m.ext.toUpperCase());
  }
  return Array.from(exts).sort().map((ext) => ({ text: ext, value: ext }));
});

/** 标签筛选选项（仅当前作用域内的文件） */
const tagFilterOptions = computed(() => {
  const tags = new Set<string>();
  for (const m of props.items) {
    if (inScope(m.relativePath || '') && m.tags) {
      for (const t of m.tags) tags.add(t);
    }
  }
  return Array.from(tags).sort().map((tag) => ({ text: tag, value: tag }));
});

/** 判断行是否为文件（可选中） */
function isFileRow(row: UnifiedRow): boolean {
  return row.kind === 'file';
}

/** 仅允许文件行选中 */
const rowSelection = computed(() => ({
  type: 'checkbox' as const,
  showCheckedAll: true,
  onlyCurrent: false,
  selectable: (row: UnifiedRow) => isFileRow(row),
}));

const hasSelection = computed(() => selectedItems.value.length > 0);

const selectedItems = computed(() =>
  allFilesInScope.value.filter((m) => selectedKeys.value.includes(`file:${m.id}`)),
);

// 切换文件夹 / 筛选条件时清空选择，避免出现不可见项的脏选中
watch(
  () => [props.currentFolder, props.searchQuery, props.items],
  () => {
    selectedKeys.value = [];
  },
);

function clearSelection() {
  selectedKeys.value = [];
}

function handleBatchDelete() {
  emit('batchDelete', selectedItems.value);
}

/* ======== 列定义 ======== */
/** 类型列筛选配置（桌面/移动共用） */
const extFilterable = computed<TableColumnData['filterable']>(() => ({
  filters: extFilterOptions.value,
  filter: (filteredValue: string[], record: TableData) => {
    if (!filteredValue || filteredValue.length === 0) return true;
    const r = record as UnifiedRow;
    if (r.kind === 'folder') return false;
    const ext = (r.material?.ext || '').toUpperCase();
    return filteredValue.includes(ext);
  },
  multiple: true,
}));

/** 标签列筛选配置 */
const tagFilterable = computed<TableColumnData['filterable']>(() => ({
  filters: tagFilterOptions.value,
  filter: (filteredValue: string[], record: TableData) => {
    if (!filteredValue || filteredValue.length === 0) return true;
    const r = record as UnifiedRow;
    if (r.kind !== 'file') return false;
    if (!r.material?.tags || r.material.tags.length === 0) return false;
    return filteredValue.some((v) => r.material!.tags!.includes(v));
  },
  multiple: true,
}));

/** 日期列排序配置：数据默认已按日期降序排列，故不设 defaultSortOrder，初始不激活排序状态 */
const dateSortable = {
  sortDirections: ['ascend', 'descend'],
  sorter: (a: UnifiedRow, b: UnifiedRow, options?: { direction?: string }) => {
    const aDate = a.material?.createTime || a.latestDate || 0;
    const bDate = b.material?.createTime || b.latestDate || 0;
    const result = new Date(aDate).getTime() - new Date(bDate).getTime();
    return options?.direction === 'descend' ? -result : result;
  },
} as unknown as TableColumnData['sortable'];

/** 大小列排序配置 */
const sizeSortable = {
  sortDirections: ['ascend', 'descend'],
  sorter: (a: UnifiedRow, b: UnifiedRow, options?: { direction?: string }) => {
    const aSize = a.material?.size || a.totalSize || 0;
    const bSize = b.material?.size || b.totalSize || 0;
    const result = aSize - bSize;
    return options?.direction === 'descend' ? -result : result;
  },
} as unknown as TableColumnData['sortable'];

const columns = computed<TableColumnData[]>(() => {
  // 桌面端：完整列（名称/描述/标签/类型/日期/大小/操作）
  const desktop: TableColumnData[] = [
    { title: '名称', dataIndex: 'name', ellipsis: true, tooltip: true, width: 200, slotName: 'name' },
    { title: '描述', dataIndex: 'desc', ellipsis: true, tooltip: true, width: 220, slotName: 'desc' },
    { title: '标签', width: 240, slotName: 'tags', filterable: tagFilterable.value },
    { title: '类型', dataIndex: 'ext', width: 80, slotName: 'ext', filterable: extFilterable.value },
    { title: '日期', dataIndex: 'date', width: 130, slotName: 'date', sortable: dateSortable },
    { title: '大小', dataIndex: 'size', width: 90, slotName: 'size', sortable: sizeSortable },
    { title: '操作', width: 100, fixed: 'right', slotName: 'actions' },
  ];
  if (!isMobile.value) return desktop;
  // 移动端：精简列（名称/类型/日期/大小/操作），减少横向滚动距离
  return [
    { title: '名称', dataIndex: 'name', ellipsis: true, tooltip: true, width: 170, slotName: 'name' },
    { title: '类型', dataIndex: 'ext', width: 80, slotName: 'ext', filterable: extFilterable.value },
    { title: '日期', dataIndex: 'date', width: 122, slotName: 'date', sortable: dateSortable },
    { title: '大小', dataIndex: 'size', width: 82, slotName: 'size', sortable: sizeSortable },
    { title: '操作', width: 92, fixed: 'right', slotName: 'actions' },
  ];
});

/** 表格横向滚动宽度：移动端收窄，桌面端保持原样 */
const tableScrollX = computed(() => (isMobile.value ? 600 : 1100));

/* ======== 事件 ======== */
function formatDate(ts?: number | string): string {
  if (!ts) return '-';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '-';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
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
  const cat = usePreview().getCategory(record);
  // Office / 未知类型：浏览器无法原生渲染（raw 只会返回"暂不支持"提示页），
  // 新窗口打开前端预览页，由 Docx/Pptx 等组件渲染
  if (cat === 'docx' || cat === 'excel' || cat === 'pptx' || cat === 'unknown') {
    window.open(useApi().getPreviewPageUrl(record.id), '_blank');
    return;
  }
  // 图片/视频/音频/PDF/文本/代码等：浏览器可原生解析，直接打开原文件
  window.open(useApi().rawUrl(record.R2Key, true), '_blank');
}

/** 排序变化处理 */
function handleSortChange(field: string, direction: string) {
  sortField.value = field;
  sortDirection.value = direction as SortDirection;
}

/** 获取相对路径（用于筛选模式下显示文件所在子文件夹） */
function getRelativePath(fullPath: string): string {
  if (!props.currentFolder) {
    // 根目录下，显示父文件夹
    const parts = fullPath.split('/');
    return parts.length > 1 ? ` (${parts.slice(0, -1).join('/')})` : '';
  }
  // 当前文件夹下，显示子文件夹
  const rest = fullPath.slice(props.currentFolder.length + 1);
  const parts = rest.split('/');
  return parts.length > 1 ? ` (${parts.slice(0, -1).join('/')})` : '';
}

/** 筛选变化处理 */
function handleFilterChange(field: string, values: string[]) {
  if (values.length === 0) {
    delete filterState.value[field];
  } else {
    filterState.value[field] = values;
  }
  filterState.value = { ...filterState.value };
}
</script>

<template>
  <div ref="listRef" class="material-list">
    <!-- 批量操作栏 -->
    <div v-if="hasSelection" class="batch-bar">
      <div class="batch-actions">
        <a-button size="small" status="danger" @click="handleBatchDelete">
          <template #icon><IconDelete /></template>
          批量删除
        </a-button>
        <a-button size="small" @click="clearSelection">取消选择</a-button>
      </div>
      <span class="batch-count">已选 <strong>{{ selectedItems.length }}</strong> 项</span>
    </div>

    <!-- 面包屑：首页 > 年 > 月 > 日 > 文件夹 > 子文件夹 ... -->
    <a-breadcrumb v-if="breadcrumb.length" class="crumb-bar" separator=">">
      <a-breadcrumb-item
        v-for="c in breadcrumb"
        :key="`${c.type}:${c.key}`"
        class="crumb-item"
        @click="c.type === 'date' ? emit('navigate-date', c.key) : emit('crumb', c.key)"
        >{{ c.label }}</a-breadcrumb-item
      >
    </a-breadcrumb>

    <!-- 覆盖层：初始加载时全屏 loading -->
    <div
      v-if="loading && !unifiedList.length"
      class="list-overlay"
    >
      <div class="list-loading">
        <a-spin tip="加载中..." />
      </div>
    </div>

    <!-- 文件夹与文件统一表格：始终渲染，避免 insertBefore 报错（Arco 内部 teleport/锚点依赖稳定节点） -->
    <a-table
      class="list-table"
      :class="{ 'has-selection': hasSelection }"
      :columns="columns"
      :data="unifiedList"
      :loading="false"
      :row-selection="rowSelection"
      :row-class-name="getRowClassName"
      v-model:selected-keys="selectedKeys"
      :pagination="false"
      :bordered="{ wrapper: true, cell: false }"
      row-key="key"
      :hoverable="true"
      size="medium"
      :scroll="{ x: tableScrollX, y: tableScrollY }"
      @sorter-change="(field, direction) => handleSortChange(field as string, direction)"
      @filter-change="(field, values) => handleFilterChange(field as string, values as string[])"
    >
      <template #name="{ record }">
        <!-- 文件夹行 -->
        <span v-if="record.kind === 'folder'" class="cell-folder-name" @click="handleRowClick(record)">
          <IconFolder :size="16" class="name-icon" />
          <EllipsisTooltip :content="record.name">{{ record.name }}</EllipsisTooltip>
        </span>
        <!-- 文件行 -->
        <span v-else class="cell-name" @click="handleFileClick(record.material!)">
          <component :is="getExtIcon(record.material?.ext || '')" :width="16" :height="16" class="name-icon" />
          <EllipsisTooltip :content="record.material?.name || ''">{{ record.material?.name }}</EllipsisTooltip>
          <span v-if="hasActiveFilter && record.fullPath" class="cell-path-hint">
            <!-- 筛选模式下显示子文件夹路径 -->
            {{ getRelativePath(record.fullPath) }}
          </span>
        </span>
      </template>
      <template #desc="{ record }">
        <template v-if="record.kind === 'file'">
          <EllipsisTooltip :content="record.material?.desc || ''" text-class="cell-desc">{{ record.material?.desc || '-' }}</EllipsisTooltip>
        </template>
        <span v-else class="cell-muted">-</span>
      </template>
      <template #tags="{ record }">
        <div v-if="record.kind === 'file' && record.material?.tags?.length" class="cell-tags">
          <a-tag v-for="tag in record.material.tags" :key="tag" size="small">{{ tag }}</a-tag>
        </div>
        <span v-else class="cell-muted">-</span>
      </template>
      <template #ext="{ record }">
        <template v-if="record.kind === 'file'">
          <a-tag
            v-if="record.material?.ext"
            size="small"
            :color="getExtColor(record.material.ext)"
          >
            <template #icon>
              <component :is="getExtIcon(record.material.ext)" :width="14" :height="14" />
            </template>
            {{ record.material.ext.toUpperCase() }}
          </a-tag>
          <span v-else class="cell-muted">-</span>
        </template>
        <a-tag v-else size="small" :color="FOLDER_COLOR">
            <template #icon><IconFolder :size="14" /></template>
            文件夹
          </a-tag>
      </template>
      <template #date="{ record }">
        <span v-if="record.kind === 'file'" class="cell-date">{{ formatDate(record.material?.createTime) }}</span>
        <span v-else class="cell-date">{{ formatDate(record.latestDate) }}</span>
      </template>
      <template #size="{ record }">
        <span v-if="record.kind === 'file'" class="cell-size">{{ formatSize(record.material?.size) }}</span>
        <span v-else class="cell-size">{{ formatSize(record.totalSize) }}</span>
      </template>
      <template #actions="{ record }">
        <div v-if="record.kind === 'file'" class="cell-actions" @click.stop>
          <a-dropdown trigger="click" :popup-max-height="false">
            <span class="action-btn action-more">
              <IconMore :size="18" />
            </span>
            <template #content>
              <a-doption @click="emit('edit', record.material!)">
                <template #icon><IconEdit /></template>
                编辑
              </a-doption>
              <a-doption @click="handleCopyLink(record.material!)">
                <template #icon><IconCopy /></template>
                复制链接
              </a-doption>
              <a-doption @click="handleOpenNewWindow(record.material!)">
                <template #icon><IconExport /></template>
                新窗口打开
              </a-doption>
              <a-doption class="menu-item-danger" @click="emit('delete', record.material!)">
                <template #icon><IconDelete /></template>
                删除
              </a-doption>
            </template>
          </a-dropdown>
        </div>
      </template>
      <template #empty>
        <div :style="{ minHeight: tableScrollY - 48 + 'px', display: 'flex', alignItems: 'center', justifyContent: 'center' }">
          <a-empty :description="emptyDescription" />
        </div>
      </template>
    </a-table>
  </div>
</template>

<style scoped>
.material-list {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

/* ======== 批量操作栏 ======== */
.batch-bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px var(--gap-lg);
  background: rgba(255, 255, 255, 0.65);
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
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

/* ======== 面包屑（a-breadcrumb） ======== */
.crumb-bar {
  padding: 8px var(--gap-lg);
  border-bottom: 1px solid var(--color-border-light);
  font-size: var(--font-size-base);
  flex-shrink: 0;
  background: var(--color-bg-surface);
  line-height: 20px;
}
.crumb-bar :deep(.arco-breadcrumb-item) {
  cursor: pointer;
  margin: 0;
}
.crumb-bar :deep(.arco-breadcrumb-item .arco-breadcrumb-text) {
  color: var(--color-text-3);
  transition: color var(--duration-fast);
  font-weight: var(--font-weight-regular);
}
.crumb-bar :deep(.arco-breadcrumb-item .arco-breadcrumb-text:hover) {
  color: var(--color-primary);
}
.crumb-bar :deep(.arco-breadcrumb-item:last-child .arco-breadcrumb-text) {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}
.crumb-bar :deep(.arco-breadcrumb-separator) {
  color: var(--color-text-4);
  margin: 0 4px;
  font-size: 12px;
}

/* ======== 文件夹行样式 ======== */
.cell-folder-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-base);
  max-width: 100%;
  overflow: hidden;
  cursor: pointer;
}
.cell-folder-name :deep(span) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0; /* flex 子项允许收缩，溢出检测（scrollWidth>clientWidth）才准确 */
  max-width: 100%;
}

/* ======== 表格 ======== */
.list-table {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* 固定表头背景色 */
.list-table :deep(.arco-table-thead th) {
  background: var(--color-bg-page);
}

.list-table :deep(.arco-table-thead th .arco-table-th-item) {
  background: var(--color-bg-page);
}

/* 文件夹行视觉区分 */
.list-table :deep(.arco-table-tr.row-folder) {
  background: var(--color-primary-light-3, #f2f3f5);
}
.list-table :deep(.arco-table-tr.row-folder:hover > .arco-table-td) {
  background: var(--color-primary-light-2, #e8f3ff) !important;
}
.list-table :deep(.arco-table-tr.row-folder .arco-table-td) {
  background: transparent;
}
/* 隐藏文件夹行的复选框 */
.list-table :deep(.arco-table-tr.row-folder > .arco-table-td.arco-table-checkbox) {
  display: none;
}

/* 压缩复选框列宽度 */
.list-table :deep(.arco-table-selection-checkbox-col) {
  width: 24px !important;
  min-width: 24px !important;
  max-width: 24px !important;
}
.list-table :deep(.arco-table-th.arco-table-checkbox),
.list-table :deep(.arco-table-td.arco-table-checkbox) {
  padding: 0 !important;
  text-align: center;
  justify-content: center;
}
.list-table :deep(.arco-table-th.arco-table-checkbox .arco-table-th-item),
.list-table :deep(.arco-table-td.arco-table-checkbox .arco-table-checkbox) {
  margin: 0;
}
/* 名称列左间距缩小 */
.list-table :deep(.arco-table-col-1) {
  padding-left: 4px !important;
}
/* 默认隐藏复选框内容，hover 行时显示 */
.list-table :deep(.arco-table-td.arco-table-checkbox .arco-checkbox) {
  opacity: 0;
  transition: opacity 0.15s ease;
}
/* 表头全选框始终可见 */
.list-table :deep(.arco-table-th.arco-table-checkbox .arco-checkbox) {
  opacity: 1 !important;
}
/* hover 行时显示该行复选框 */
.list-table :deep(.arco-table-tr:hover > .arco-table-td.arco-table-checkbox .arco-checkbox) {
  opacity: 1;
}
/* 有选中项时表头全选框保持显示 */
.list-table.has-selection :deep(.arco-table-th.arco-table-checkbox .arco-checkbox),
/* 已选中行的复选框始终显示 */
.list-table :deep(.arco-table-tr.arco-table-tr-checked > .arco-table-td.arco-table-checkbox .arco-checkbox) {
  opacity: 1;
}

.list-table :deep(.arco-table-container) {
  border: none !important;
}

.list-table :deep(.arco-table-th) {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
  background: var(--color-bg-page);
}

/* ======== 单元格样式 ======== */
.name-icon {
  flex-shrink: 0;
  display: block;
}
.cell-name {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  overflow: hidden;
  cursor: pointer;
}
.cell-name :deep(span) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0; /* flex 子项允许收缩，溢出检测（scrollWidth>clientWidth）才准确 */
  max-width: 100%;
}
.cell-path-hint {
  color: var(--color-text-4);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-regular);
  margin-left: 8px;
  flex-shrink: 0;
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

/* Arco 自定义颜色标签默认用白色文字，浅色背景下改为深色 */
:deep(.arco-tag.arco-tag-custom-color) {
  color: var(--color-text-2);
}

:deep(.arco-tag.arco-tag-custom-color .arco-icon-hover.arco-tag-icon-hover:hover::before) {
  background-color: rgba(0, 0, 0, 0.06);
}

:deep(.arco-tag.arco-tag-custom-color .arco-tag-close-btn) {
  color: var(--color-text-2);
}

/* 确保图标在标签内垂直居中 */
:deep(.arco-tag-icon) {
  display: inline-flex;
  align-items: center;
}

:deep(.arco-tag-icon svg) {
  display: block;
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
::deep(.menu-item-danger) {
  color: rgb(245, 63, 63) !important;
}
::deep(.menu-item-danger:hover) {
  background: var(--color-danger-light-1) !important;
}
::deep(.arco-dropdown-option-icon) {
  display: inline-flex;
  align-items: center;
}

.list-overlay {
  position: absolute;
  inset: 36px 0 0 0; /* 避开面包屑高度 */
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-2, #f7f8fa);
}

.list-overlay .list-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

/* ======== 移动端适配（仅影响 <768px，桌面端不受影响） ======== */
@media (max-width: 768px) {
  /* 触屏无 hover：复选框始终可见，保证可勾选行 */
  .list-table :deep(.arco-table-td.arco-table-checkbox .arco-checkbox) {
    opacity: 1;
  }
  /* 面包屑过长时横向滚动 */
  .crumb-bar {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    white-space: nowrap;
  }
  /* 批量操作栏在移动端紧凑一些 */
  .batch-bar {
    padding: 8px var(--gap-md);
  }
  .batch-actions {
    gap: var(--gap-xs);
  }
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
