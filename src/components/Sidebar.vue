<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { IconCaretRight } from '@arco-design/web-vue/es/icon';
import type { TreeNodeData } from '@arco-design/web-vue/es/tree/interface';
import type { Material } from '@/types';

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

// ── 把一组物料按 relativePath 构建文件夹子树 ──
function buildFolderTree(items: Material[]) {
  const treeMap = new Map<string, Map<string, number>>();

  for (const item of items) {
    const rp = item.relativePath || '';
    if (!rp) continue;
    const parts = rp.split('/');
    for (let i = 0; i < parts.length; i++) {
      const parentPath = parts.slice(0, i).join('/');
      const thisPath = parts.slice(0, i + 1).join('/');

      if (!thisPath) continue;
      if (!treeMap.has(parentPath)) treeMap.set(parentPath, new Map());
      const parent = treeMap.get(parentPath)!;
      parent.set(thisPath, (parent.get(thisPath) || 0) + 1);
    }
  }

  function buildNodes(parentPath: string) {
    const children = treeMap.get(parentPath);
    if (!children) return [];

    return Array.from(children.entries()).map(([fullPath, count]) => {
      const name = fullPath.split('/').pop() || fullPath;
      const hasChildren = treeMap.has(fullPath);
      const node: Record<string, unknown> = {
        title: name,
        key: fullPath,
      };
      if (hasChildren) {
        node.children = buildNodes(fullPath);
      }
      return node;
    });
  }

  return buildNodes('');
}

// ── 日期树 ──
const treeData = computed(() => {
  const tree: Record<string, unknown>[] = [
    { title: '全部', key: 'all' },
  ];

  const yearGroups = new Map<string, Map<string, Map<string, Material[]>>>();

  for (const item of props.items) {
    const date = item.createTime || item.uploadedAt;
    if (!date) continue;
    const d = new Date(date);
    if (isNaN(d.getTime())) continue;
    const [year, month, day] = [
      String(d.getFullYear()),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ];

    if (!yearGroups.has(year)) yearGroups.set(year, new Map());
    const months = yearGroups.get(year)!;
    if (!months.has(month)) months.set(month, new Map());
    const days = months.get(month)!;
    const key = `${year}-${month}-${day}`;
    if (!days.has(key)) days.set(key, []);
    days.get(key)!.push(item);
  }

  const years = [...yearGroups.keys()].sort((a, b) => Number(b) - Number(a));
  for (const year of years) {
    const months = yearGroups.get(year)!;
    const sortedMonths = [...months.keys()].sort((a, b) => Number(b) - Number(a));
    const monthNodes: Record<string, unknown>[] = [];
    let yearTotal = 0;

    for (const month of sortedMonths) {
      const days = months.get(month)!;
      const sortedDayKeys = [...days.keys()].sort((a, b) => {
        const [, , da] = a.split('-');
        const [, , db] = b.split('-');
        return Number(db) - Number(da);
      });
      const dayNodes: Record<string, unknown>[] = [];
      let monthTotal = 0;

      for (const key of sortedDayKeys) {
        const dayItems = days.get(key)!;
        const cnt = dayItems.length;
        const [, , day] = key.split('-');
        monthTotal += cnt;

        const folderNodes = buildFolderTree(dayItems);
        const node: Record<string, unknown> = {
          title: `${Number(day)}日`,
          key,
        };
        if (folderNodes.length > 0) {
          node.children = folderNodes;
        }
        dayNodes.push(node);
      }

      yearTotal += monthTotal;
      monthNodes.push({
        title: `${Number(month)}月`,
        key: `${year}-${month}`,
        children: dayNodes,
      });
    }

    tree.push({
      title: `${year}年`,
      key: year,
      children: monthNodes,
    });
  }

  return tree;
});

// ── 展开逻辑 ──
function getParentKeys(key: string): string[] {
  const parents: string[] = [];
  const parts = key.split('-');
  if (parts.length >= 1) parents.push(parts[0]);
  if (parts.length >= 2) parents.push(`${parts[0]}-${parts[1]}`);
  return parents;
}

// 递归查找 key 在树中的祖先路径
function findAncestorPath(key: string, nodes: Record<string, unknown>[]): string[] | null {
  for (const node of nodes) {
    if (node.key === key) return [];
    if (node.children) {
      const path = findAncestorPath(key, node.children as Record<string, unknown>[]);
      if (path !== null) {
        return [node.key as string, ...path];
      }
    }
  }
  return null;
}

const expandedKeys = ref<string[]>(getParentKeys(props.selectedKey));
watch(() => props.selectedKey, (val) => {
  if (val === 'all' || /^\d{4}(-\d{2}){0,2}$/.test(val)) {
    expandedKeys.value = getParentKeys(val);
  } else {
    // 文件夹 key：查找并展开祖先日期节点
    const ancestors = findAncestorPath(val, treeData.value);
    if (ancestors) {
      expandedKeys.value = [...new Set([...expandedKeys.value, ...ancestors])];
    }
  }
});

function handleSelect(
  _keys: (string | number)[],
  data: { node?: TreeNodeData },
) {
  const key = data.node?.key;
  if (key !== undefined) {
    emit('select', String(key));
  }
}
</script>

<template>
  <div class="sidebar-inner">
    <a-tree
      class="sidebar-tree"
      :data="treeData"
      :selected-keys="selectedKeys"
      v-model:expanded-keys="expandedKeys"
      :show-line="true"
      block-node
      @select="handleSelect"
    >
      <template #switcher-icon>
        <span class="tree-caret-wrap">
          <icon-caret-right :size="12" />
        </span>
      </template>
    </a-tree>
  </div>
</template>

<style scoped>
.sidebar-inner {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: var(--gap-sm) var(--gap-sm) var(--gap-md);
  overflow: hidden;
}

.sidebar-tree {
  flex: 1;
  overflow: auto;
}

.sidebar-tree :deep(.arco-tree-node) {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.sidebar-tree :deep(.arco-tree-node-title-text) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-tree :deep(.arco-tree-node-selected .arco-tree-node-title) {
  color: var(--color-primary);
}

/* 收起时保留 IconCaretRight 的默认朝向，展开时旋转为朝下。 */
.tree-caret-wrap {
  display: inline-flex;
  transform-origin: center;
  transition: transform 0.2s ease;
}

/* Arco 会默认旋转 switcher 内的图标；重置它，避免收起时变成朝上。 */
.sidebar-tree :deep(.tree-caret-wrap .arco-icon-caret-right) {
  transform: none !important;
}

.sidebar-tree :deep(.arco-tree-node-switcher-expanded .tree-caret-wrap) {
  transform: rotate(90deg);
}

</style>
