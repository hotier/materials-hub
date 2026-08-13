<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IconArrowLeft, IconDownload, IconFile } from '@arco-design/web-vue/es/icon';
import { useApi } from '@/composables/useApi';
import { useToast } from '@/composables/useToast';
import { usePreview } from '@/composables/usePreview';
import { getExtIcon, getExtColor } from '@/utils/fileType';
import MdPreview from '@/components/preview/MdPreview.vue';
import CodePreview from '@/components/preview/CodePreview.vue';
import MediaPreview from '@/components/preview/MediaPreview.vue';
import DocxPreview from '@/components/preview/DocxPreview.vue';
import ExcelPreview from '@/components/preview/ExcelPreview.vue';
import PdfPreview from '@/components/preview/PdfPreview.vue';
import type { Material } from '@/types';

const route = useRoute();
const router = useRouter();
const api = useApi();
const { toast } = useToast();
const { getCategory } = usePreview();

const item = ref<Material | null>(null);
const loading = ref(true);
const isAuthenticated = ref(false);
const errorMsg = ref('');

const APP_TITLE = 'Materials Hub';

/** 去掉文件名后缀（仅保留最后一段扩展名） */
function stripExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}

const cat = computed(() => getCategory(item.value));

const fileUrl = computed(() => {
  if (!item.value) return '';
  return api.rawUrl(item.value.R2Key);
});

const viewMode = ref<'preview' | 'source'>('preview');
const showModeToggle = computed(() => cat.value === 'md' || cat.value === 'html');

const isDownloadable = computed(() => !!fileUrl.value);

/** 清理所有残留的 Arco popup DOM */
function clearAllArcoPopups() {
  document
    .querySelectorAll('.arco-tooltip-popup, .arco-trigger-popup, .arco-dropdown-popup, .arco-popover-popup, .arco-select-popup')
    .forEach((el) => {
      // 只移除确实包含 popup 内容的元素，避免误删其他 trigger
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

onMounted(async () => {
  // 解除 popup 隐藏 + 清理残留 popup（双重保障）
  document.body.classList.remove('arco-popup-hidden');
  clearAllArcoPopups();
  nextTick(clearAllArcoPopups);
  setTimeout(clearAllArcoPopups, 50);
  setTimeout(clearAllArcoPopups, 200);
  setTimeout(clearAllArcoPopups, 500);

  const id = route.query.id as string;
  if (!id) {
    router.replace('/');
    return;
  }
  // 检查认证状态（用于下载功能）
  try {
    const auth = await api.authStatus();
    isAuthenticated.value = auth.authenticated;
  } catch {
    isAuthenticated.value = false;
  }
  await loadItem(id);
});

async function loadItem(id: string) {
  loading.value = true;
  errorMsg.value = '';
  try {
    const res = await api.getPreviewInfo(id);
    if (res.success && res.data) {
      item.value = res.data;
      document.title = stripExt(item.value.name || '文件预览');
    } else {
      errorMsg.value = res.message || '文件不存在或已被删除';
    }
  } catch {
    errorMsg.value = '加载失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}

function goBack() {
  document.title = APP_TITLE;
  if (window.history.length > 1) {
    router.back();
  } else {
    router.replace('/');
  }
}

onUnmounted(() => {
  document.title = APP_TITLE;
});

function download() {
  if (!item.value) return;
  if (!isAuthenticated.value) {
    toast('请先登录后下载', 'warning');
    router.push('/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search));
    return;
  }
  const a = document.createElement('a');
  a.href = `/api/download?id=${encodeURIComponent(item.value.id)}`;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

</script>

<template>
  <div class="preview-page">
    <!-- 导航栏 -->
    <header class="preview-header">
      <div class="header-left">
        <a-button type="text" @click="goBack">
          <template #icon><IconArrowLeft /></template>
        </a-button>
        <div class="header-info">
          <h1 class="header-title">{{ item?.name || '加载中...' }}</h1>
          <a-tag v-if="item?.ext" size="small" :color="getExtColor(item.ext)">
            <template #icon>
              <component :is="getExtIcon(item.ext)" :width="14" :height="14" />
            </template>
            {{ item.ext.toUpperCase() }}
          </a-tag>
        </div>
        <div v-if="showModeToggle" class="view-mode">
          <a-switch v-model="viewMode" checked-value="preview" unchecked-value="source" :type="('text' as any)">
            <template #checked>预览</template>
            <template #unchecked>源码</template>
          </a-switch>
        </div>
      </div>
      <div class="header-right">
        <a-button
          v-if="isDownloadable"
          type="outline"
          size="small"
          :status="!isAuthenticated ? 'warning' : undefined"
          @click="download"
        >
          <template #icon><IconDownload /></template>
          {{ isAuthenticated ? '下载' : '登录后下载' }}
        </a-button>
      </div>
    </header>

    <!-- 内容区 -->
    <main class="preview-body">
      <a-spin v-if="loading" class="preview-loading" :loading="true" tip="加载中..." />

      <div v-else-if="errorMsg" class="preview-error">
        <div class="error-icon"><IconFile :size="64" /></div>
        <h2>无法预览</h2>
        <p>{{ errorMsg }}</p>
        <a-button type="primary" @click="goBack">返回列表</a-button>
      </div>

      <template v-else-if="item">
        <!-- Markdown -->
        <MdPreview v-if="cat === 'md'" :url="fileUrl" :mode="viewMode" />
        <!-- Office -->
        <DocxPreview v-else-if="cat === 'docx'" :src="fileUrl" />
        <ExcelPreview v-else-if="cat === 'excel'" :url="fileUrl" />
        <PdfPreview v-else-if="cat === 'pdf'" :url="fileUrl" />
        <!-- 媒体 -->
        <MediaPreview v-else-if="cat === 'image' || cat === 'video' || cat === 'audio' || cat === 'html'" :src="fileUrl" :name="item.name" :cat="cat" :mode="viewMode" />
        <!-- 代码 -->
        <CodePreview v-else-if="cat === 'code'" :url="fileUrl" :ext="item.ext" />
        <!-- 不支持 -->
        <div v-else class="preview-unknown">
          <div class="unknown-icon"><IconFile :size="64" /></div>
          <h2>暂不支持预览</h2>
          <p>此文件类型 (.{{ item.ext }}) 暂不支持在线预览</p>
          <a-button
            v-if="isDownloadable"
            type="primary"
            @click="download"
          >
            <template #icon><IconDownload /></template>
            {{ isAuthenticated ? '下载文件' : '登录后下载' }}
          </a-button>
        </div>
      </template>
    </main>
  </div>
</template>

<style scoped>
.preview-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--color-bg-page);
  font-family: var(--font-family);
}

/* ====== 导航栏 ====== */
.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--gap-sm) var(--gap-lg);
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border-light);
  backdrop-filter: blur(20px);
  position: sticky;
  top: 0;
  z-index: 10;
  flex-shrink: 0;
}
.header-left {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  min-width: 0;
}
.header-info {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  min-width: 0;
}
.header-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.header-right {
  flex-shrink: 0;
}

.view-mode {
  margin-left: var(--gap-md);
  flex-shrink: 0;
}

/* ====== 内容区 ====== */
.preview-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: auto;
  min-height: 0;
}
.preview-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
.preview-unknown {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: var(--gap-md);
  text-align: center;
  padding: var(--gap-2xl);
}
.unknown-icon {
  color: var(--color-text-tertiary);
  opacity: 0.5;
}
.preview-unknown h2 {
  font-size: var(--font-size-lg);
  color: var(--color-text-primary);
  margin: 0;
}
.preview-unknown p {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

.preview-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: var(--gap-md);
  text-align: center;
  padding: var(--gap-2xl);
}
.preview-error .error-icon {
  color: var(--color-text-tertiary);
  opacity: 0.5;
}
.preview-error h2 {
  font-size: var(--font-size-lg);
  color: var(--color-text-primary);
  margin: 0;
}
.preview-error p {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

/* 自定义颜色标签：深色文字 + 图标居中 */
:deep(.arco-tag.arco-tag-custom-color) {
  color: var(--color-text-2);
}

:deep(.arco-tag.arco-tag-custom-color .arco-icon-hover.arco-tag-icon-hover:hover::before) {
  background-color: rgba(0, 0, 0, 0.06);
}

:deep(.arco-tag.arco-tag-custom-color .arco-tag-close-btn) {
  color: var(--color-text-2);
}

:deep(.arco-tag-icon) {
  display: inline-flex;
  align-items: center;
}

:deep(.arco-tag-icon svg) {
  display: block;
}
</style>
