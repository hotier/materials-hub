<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  IconCaretRight,
  IconApps,
  IconCalendar,
} from '@arco-design/web-vue/es/icon';
import type { Material } from '@/types';

const props = defineProps<{
  items: Material[];
  selectedKey: string;
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

/** 初始展开当前选中日期所在分支（仅初始化一次，交给用户自由折叠） */
function initOpenKeys(): string[] {
  const keys = new Set<string>();
  const m = /^(\d{4})(?:-(\d{2}))?/.exec(props.selectedKey);
  if (m) {
    if (m[1]) keys.add(m[1]);
    if (m[1] && m[2]) keys.add(`${m[1]}-${m[2]}`);
  }
  return [...keys];
}
const openKeys = ref<string[]>(initOpenKeys());

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
      全部
    </a-menu-item>

    <!-- 按时间（年 -> 月 -> 日）为顶级导航，默认即是时间维度 -->
    <a-sub-menu
      v-for="y in timeGroups"
      :key="y.year"
    >
      <template #icon><IconCalendar :size="16" /></template>
      <template #title>{{ y.year }} 年</template>
      <a-sub-menu
        v-for="mo in y.months"
        :key="mo.key"
      >
        <template #title>{{ Number(mo.month) }} 月</template>
        <a-menu-item
          v-for="d in mo.days"
          :key="d.key"
        >
          {{ Number(d.day) }} 日
        </a-menu-item>
      </a-sub-menu>
    </a-sub-menu>
  </a-menu>
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
</style>
