<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { IconSync, IconRefresh, IconExport } from '@arco-design/web-vue/es/icon';
import { useApi } from '@/composables/useApi';

defineProps<{
  searchQuery: string;
  isSyncing: boolean;
  loading: boolean;
}>();

const emit = defineEmits<{
  'update:searchQuery': [value: string];
  'sync': [];
  'refresh': [];
}>();

const router = useRouter();
const { logout: apiLogout, clearAuth } = useApi();
const showLogout = ref(false);

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
    <div class="header-brand">
      <i-mdi-folder-multiple-image class="brand-logo" :width="30" :height="30" />
      <span class="brand-name">素材中心</span>
    </div>
  </div>

  <!-- 中间搜索 -->
  <div class="header-center">
    <a-input-search
      :model-value="searchQuery"
      placeholder="搜索素材..."
      allow-clear
      size="medium"
      search-button
      :loading="loading"
      @update:model-value="(v: string) => emit('update:searchQuery', v)"
      @search="emit('refresh')"
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

    <a-button @click="handleLogout">
      <template #icon><icon-export /></template>
      退出
    </a-button>
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
</style>
