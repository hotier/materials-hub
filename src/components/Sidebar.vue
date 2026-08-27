<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  IconCaretRight,
  IconApps,
  IconCalendar,
} from '@arco-design/web-vue/es/icon';
import type { Material } from '@/types';

const props = defineProps<{
  items: Material[];
  selectedKey: string;
  /** 列表加载中：用于显示时间分组骨架 */
  loading?: boolean;
}>();

const emit = defineEmits<{ (e: 'select', key: string): void }>();

/** 按时间维度构建：年 -> 月 -> 日 */
interface TimeDay {
  day: string;
  key: string;
}
interface TimeMonth {
  month: string;
  key: string;
  days: TimeDay[];
}
interface TimeYear {
  year: string;
  months: TimeMonth[];
}
const timeGroups = computed<TimeYear[]>(() => {
  const years = new Map<string, Map<string, Set<string>>>();
  for (const m of props.items) {
    const raw = m.createTime || m.uploadedAt;
    if (!raw) continue;
    const d = new Date(raw);
    if (isNaN(d.getTime())) continue;
    const year = String(d.getFullYear());
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const months = years.get(year) ?? new Map<string, Set<string>>();
    const days = months.get(month) ?? new Set<string>();
    days.add(day);
    months.set(month, days);
    years.set(year, months);
  }
  return [...years.entries()]
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([year, months]) => ({
      year,
      months: [...months.entries()]
        .sort((a, b) => Number(b[0]) - Number(a[0]))
        .map(([month, days]) => ({
          month,
          key: `${year}-${month}`,
          days: [...days.values()]
            .sort((a, b) => Number(b) - Number(a))
            .map((d) => ({ day: d, key: `${year}-${month}-${d}` })),
        })),
    }));
});

/** 当前年份 */
const currentYear = String(new Date().getFullYear());

/** 初始展开：选中 key 所在路径（年、月）；未选中具体日期（如"全部"）时展开最近年份 */
function initOpenKeys(): string[] {
  const m = /^(\d{4})(?:-(\d{2}))?/.exec(props.selectedKey);
  if (m) {
    const keys = new Set<string>([m[1]]);
    if (m[2]) keys.add(`${m[1]}-${m[2]}`);
    return [...keys];
  }
  return [currentYear];
}
const openKeys = ref<string[]>(initOpenKeys());

/** 监听选中变化：重建展开状态，只保留选中路径（年份 + 其月份），其余全部收起 */
watch(
  () => props.selectedKey,
  (key) => {
    if (!key || key === 'all') return;
    const m = /^(\d{4})(?:-(\d{2}))?/.exec(key);
    if (!m) return;
    const next = new Set<string>([m[1]]);
    if (m[2]) next.add(`${m[1]}-${m[2]}`);
    openKeys.value = [...next];
  },
  { immediate: false }
);

/** 选中 key 是否位于某节点路径内（用于父级高亮） */
function isPathOf(key: string): boolean {
  return props.selectedKey === key || props.selectedKey.startsWith(key + '-');
}

function onSelect(key: string) {
  emit('select', key);
}
</script>

<template>
  <a-menu
    class="sidebar-menu"
    :selected-keys="[selectedKey]"
    :open-keys="openKeys"
    @menu-item-click="onSelect"
    @update:open-keys="(keys: string[]) => (openKeys = keys)"
  >
    <a-menu-item key="all">
      <template #icon><IconApps :size="16" /></template>
      <span class="node-label">全部</span>
    </a-menu-item>

    <!-- 按时间（年 -> 月 -> 日）为顶级导航，默认即是时间维度 -->
    <a-sub-menu
      v-for="y in timeGroups"
      :key="y.year"
    >
      <template #icon><IconCalendar :size="16" /></template>
      <template #title>
        <span class="node-label" :class="{ 'sub-selected': isPathOf(y.year) }">{{ y.year }} 年</span>
      </template>
      <a-sub-menu
        v-for="mo in y.months"
        :key="mo.key"
      >
        <template #title>
          <span class="node-label" :class="{ 'sub-selected': isPathOf(mo.key) }">{{ Number(mo.month) }} 月</span>
        </template>
        <a-menu-item
          v-for="d in mo.days"
          :key="d.key"
        >
          <span class="node-label">{{ Number(d.day) }} 日</span>
        </a-menu-item>
      </a-sub-menu>
    </a-sub-menu>
  </a-menu>

  <!-- 加载中：时间分组骨架（与列表区加载态统一，避免空白） -->
  <a-skeleton
    v-if="loading"
    animation
    class="sidebar-skeleton"
  >
    <div v-for="n in 6" :key="n" class="sk-menu-row">
      <a-skeleton-shape class="sk-menu-icon" />
      <a-skeleton-line :rows="1" :widths="['70%']" :line-height="12" class="sk-menu-text" />
      <a-skeleton-shape class="sk-menu-caret" />
    </div>
  </a-skeleton>
</template>

<style scoped>
.sidebar-menu {
  width: 100%;
  border: none;
  background: transparent;
  padding: 0;
}

/* 菜单项上下间距收紧 */
.sidebar-menu :deep(.arco-menu-item),
.sidebar-menu :deep(.arco-menu-inline-header) {
  padding-top: 2px;
  padding-bottom: 2px;
  line-height: 20px;
  height: 24px;
  min-height: 24px;
}

/* 子菜单展开区域 */
.sidebar-menu :deep(.arco-menu-inline-collection) {
  padding-top: 0;
  padding-bottom: 0;
}

.sidebar-menu :deep(.arco-menu-sub-menu) {
  margin: 0;
}

/* 让唯一的展开图标（CaretRight）朝右，展开时旋转朝下 */
.sidebar-menu :deep(.arco-menu-icon-suffix .arco-icon-caret-right) {
  transform: rotate(0deg);
  transition: transform 0.2s ease;
}
.sidebar-menu :deep(.arco-menu-open .arco-menu-icon-suffix .arco-icon-caret-right) {
  transform: rotate(90deg);
}

/* 节点文本 */
.node-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 选中路径上的父级高亮 */
.sub-selected {
  font-weight: 600;
  color: rgb(var(--primary-6));
}

/* 加载中：时间分组骨架（与列表区加载态统一） */
.sidebar-skeleton {
  padding: 8px 0 4px;
}
.sidebar-skeleton :deep(.sk-menu-row) {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 12px;
}
.sidebar-skeleton :deep(.sk-menu-icon) {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 4px;
}
.sidebar-skeleton :deep(.sk-menu-text) {
  flex: 1;
  min-width: 0;
}
.sidebar-skeleton :deep(.sk-menu-caret) {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 3px;
}
.sidebar-skeleton :deep(.arco-skeleton-line) {
  display: block;
  line-height: 0;
}
.sidebar-skeleton :deep(.arco-skeleton-line-row) {
  margin-bottom: 0;
  border-radius: 2px;
}
</style>
