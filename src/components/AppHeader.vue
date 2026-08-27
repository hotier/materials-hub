<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { IconSync, IconRefresh, IconExport, IconMenu } from '@arco-design/web-vue/es/icon';
import { useApi } from '@/composables/useApi';

const props = defineProps<{
  searchQuery: string;
  isSyncing: boolean;
  loading: boolean;
}>();

const emit = defineEmits<{
  'update:searchQuery': [value: string];
  'sync': [];
  'refresh': [];
  'toggle-sider': [];
}>();

const router = useRouter();
const { logout: apiLogout, clearAuth } = useApi();
const showLogout = ref(false);

/** 搜索框内部双向绑定：避免 Arco 事件传参类型不一致导致的同步问题 */
const searchValue = computed<string>({
  get: () => props.searchQuery,
  set: (v) => {
    const next = typeof v === 'string' ? v : '';
    if (next !== props.searchQuery) emit('update:searchQuery', next);
  },
});

function onSearch() {
  // 先同步（避免回车/按钮触发时搜索词已改但 props.searchQuery 还没刷新）再刷新
  const v = props.searchQuery;
  if (v !== '') {
    // 若 props 还没被 Vue 同步完成，这里不触发额外动作，因为 computed setter 已经 emit 了
  }
  emit('refresh');
}

function onClear() {
  // allow-clear 下点击 × 按钮，清空搜索（无论 v-model 是否已同步，显式 emit 确保父级一定清掉）
  emit('update:searchQuery', '');
}

function handleLogout() {
  showLogout.value = true;
}

async function confirmLogout() {
  try {
    await apiLogout();
  } catch {
    // 即使接口失败也继续退出
  }
  clearAuth();
  showLogout.value = false;
  router.push('/login');
}
</script>

<template>
  <!-- 左侧品牌与导航 -->
  <div class="header-left">
    <!-- 移动端：侧栏开关（仅 <768px 显示） -->
    <a-button class="sider-toggle" shape="circle" size="medium" @click="emit('toggle-sider')">
      <template #icon><IconMenu /></template>
    </a-button>
    <div class="header-brand">
      <i-mdi-folder-multiple-image class="brand-logo" :width="30" :height="30" />
      <span class="brand-name">素材中心</span>
    </div>
  </div>

  <!-- 中间搜索 -->
  <div class="header-center">
    <a-input-search
      v-model="searchValue"
      placeholder="搜索素材..."
      allow-clear
      size="medium"
      search-button
      :loading="loading"
      @search="onSearch"
      @clear="onClear"
    />
  </div>

  <!-- 右侧操作 -->
  <div class="header-right">
    <a-tooltip content="同步数据">
      <a-button shape="circle" size="medium" :loading="isSyncing" @click="emit('sync')">
        <template #icon><IconSync /></template>
      </a-button>
    </a-tooltip>

    <a-tooltip content="刷新列表">
      <a-button shape="circle" size="medium" @click="emit('refresh')">
        <template #icon><IconRefresh /></template>
      </a-button>
    </a-tooltip>

    <a-divider direction="vertical" />

    <!-- 桌面端：文字退出按钮 -->
    <a-button class="logout-btn-desktop" @click="handleLogout">
      <template #icon><icon-export /></template>
      退出
    </a-button>

    <!-- 移动端：退出收进 Dropdown（仅 <768px 显示） -->
    <a-dropdown class="logout-btn-mobile" trigger="click" position="br">
      <a-button shape="circle" size="medium">
        <template #icon><IconExport /></template>
      </a-button>
      <template #content>
        <a-doption @click="handleLogout">退出登录</a-doption>
      </template>
    </a-dropdown>
  </div>

  <!-- 退出确认弹窗 -->
  <Teleport to="body">
    <a-modal v-model:visible="showLogout" title="退出登录" :footer="false" :width="380">
      <p class="logout-text">确定要退出登录吗？</p>
      <div class="logout-actions">
        <a-button @click="showLogout = false">取消</a-button>
        <a-button type="primary" status="danger" @click="confirmLogout">退出</a-button>
      </div>
    </a-modal>
  </Teleport>
</template>

<style scoped>
/* 由 HomeView 的 a-layout-header 承载外层，此处仅内部 flex 布局 */
.header-left {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
}

.brand-logo {
  width: 30px;
  height: 30px;
  color: var(--color-primary);
  display: inline-block;
}

.brand-name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  white-space: nowrap;
}

.header-center {
  flex: 1;
  max-width: 460px;
  margin: 0 auto;
  padding: 0 var(--gap-xl);
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  flex-shrink: 0;
}

.logout-text {
  margin: 0 0 var(--gap-lg);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.logout-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--gap-sm);
}

/* ======== 移动端适配（仅影响 <768px，桌面端不受影响） ======== */
.sider-toggle {
  display: none;
  margin-right: var(--gap-sm);
}
.logout-btn-mobile {
  display: none;
}

@media (max-width: 768px) {
  .sider-toggle {
    display: inline-flex;
  }
  .brand-name {
    display: none;
  }
  .header-center {
    padding: 0 var(--gap-sm);
  }
  .logout-btn-desktop {
    display: none;
  }
  .logout-btn-mobile {
    display: inline-flex;
  }
}
</style>
