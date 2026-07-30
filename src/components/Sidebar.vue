<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { Material } from '@/types';

interface DateTreeNode {
  key: string;
  title: string;
  children?: DateTreeNode[];
}

const props = defineProps<{
  items: Material[];
  selectedKey: string;
}>();

const emit = defineEmits<{
  select: [key: string];
}>();

const selectedKeys = ref<string[]>([props.selectedKey]);

watch(() => props.selectedKey, (val) => {
  selectedKeys.value = [val];
});

const treeData = computed<DateTreeNode[]>(() => {
  const groups: Record<string, Record<string, Record<string, number>>> = {};

  for (const item of props.items) {
    const date = item.createTime || item.uploadedAt;
    if (!date) continue;
    const d = new Date(date);
    if (isNaN(d.getTime())) continue;
    const year = String(d.getFullYear());
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    groups[year] ??= {};
    groups[year][month] ??= {};
    groups[year][month][day] ??= 0;
    groups[year][month][day]++;
  }

  const tree: DateTreeNode[] = [
    { key: 'all', title: `全部 (${props.items.length})` },
  ];

  const years = Object.keys(groups).sort((a, b) => Number(b) - Number(a));
  for (const year of years) {
    const months = Object.keys(groups[year]).sort((a, b) => Number(b) - Number(a));
    const monthNodes: DateTreeNode[] = [];
    let yearTotal = 0;

    for (const month of months) {
      const days = Object.keys(groups[year][month]).sort((a, b) => Number(b) - Number(a));
      const dayNodes: DateTreeNode[] = [];
      let monthTotal = 0;

      for (const day of days) {
        const count = groups[year][month][day];
        monthTotal += count;
        dayNodes.push({
          key: `${year}-${month}-${day}`,
          title: `${Number(day)}日 (${count})`,
        });
      }

      yearTotal += monthTotal;
      monthNodes.push({
        key: `${year}-${month}`,
        title: `${Number(month)}月 (${monthTotal})`,
        children: dayNodes,
      });
    }

    tree.push({
      key: year,
      title: `${year}年 (${yearTotal})`,
      children: monthNodes,
    });
  }

  return tree;
});

function getParentKeys(key: string): string[] {
  const parents: string[] = [];
  const parts = key.split('-');
  if (parts.length >= 1) parents.push(parts[0]);
  if (parts.length >= 2) parents.push(`${parts[0]}-${parts[1]}`);
  return parents;
}

const expandedKeys = ref<string[]>(getParentKeys(props.selectedKey));

watch(() => props.selectedKey, (val) => {
  selectedKeys.value = [val];
  expandedKeys.value = getParentKeys(val);
});

function handleSelect(
  _selectedKeys: string[],
  data: { selected?: boolean; node?: DateTreeNode },
) {
  if (data.node?.key) {
    emit('select', data.node.key);
  }
}
</script>

<template>
  <div class="sidebar-inner">
    <div class="sider-section-title">时间线</div>
    <a-tree
      class="date-tree"
      :data="treeData"
      :selected-keys="selectedKeys"
      v-model:expanded-keys="expandedKeys"
      :show-line="false"
      block-node
      @select="handleSelect"
    />
  </div>
</template>

<style scoped>
.sidebar-inner {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: var(--gap-md) var(--gap-sm);
  overflow-y: auto;
  overflow-x: hidden;
}

.sider-section-title {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--color-text-tertiary);
  padding: 0 12px var(--gap-sm);
  flex-shrink: 0;
}

.date-tree {
  flex: 1;
  overflow: auto;
}

.date-tree :deep(.arco-tree-node) {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.date-tree :deep(.arco-tree-node-title-text) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.date-tree :deep(.arco-tree-node-selected .arco-tree-node-title) {
  color: var(--color-primary);
}
</style>
