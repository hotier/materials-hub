<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IconArrowLeft, IconDownload, IconFile } from '@arco-design/web-vue/es/icon';
import { useApi } from '@/composables/useApi';
import { useToast } from '@/composables/useToast';
import { usePreview } from '@/composables/usePreview';
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

const cat = computed(() => getCategory(item.value));

const fileUrl = computed(() => {
  if (!item.value) return '';
  return api.rawUrl(item.value.R2Key);
});

const viewMode = ref<'preview' | 'source'>('preview');
const showModeToggle = computed(() => cat.value === 'md' || cat.value === 'html');

const isDownloadable = computed(() => !!fileUrl.value);

onMounted(async () => {
  const id = route.query.id as string;
  if (!id) {
    router.replace('/');
    return;
  }
  await loadItem(id);
});

async function loadItem(id: string) {
  loading.value = true;
  try {
    const res = await api.getById(id);
    if (res.success) {
      item.value = res.data as Material;
      document.title = `${item.value.name || '文件预览'} - Materials Hub`;
    } else {
      toast('文件不存在', 'error');
      router.replace('/');
    }
  } catch {
    toast('加载失败', 'error');
    router.replace('/');
  } finally {
    loading.value = false;
  }
}

function goBack() {
  router.replace('/')
}

function download() {
  if (!fileUrl.value || !item.value) return;
  const name = item.value.ext ? `${item.value.name}.${item.value.ext}` : item.value.name;
  const a = document.createElement('a');
  a.href = fileUrl.value;
  a.download = name;
  a.click();
}

function formatSize(bytes: number): string {
  if (!bytes) return '未知';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
          <a-tag v-if="item?.ext" size="small" color="arcoblue">{{ item.ext.toUpperCase() }}</a-tag>
          <span v-if="item" class="header-meta">{{ item.size ? formatSize(item.size) : '' }}</span>
        </div>
        <div v-if="showModeToggle" class="view-mode">
          <a-switch v-model="viewMode" checked-value="preview" unchecked-value="source" type="text">
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
          @click="download"
        >
          <template #icon><IconDownload /></template>
          下载
        </a-button>
      </div>
    </header>

    <!-- 内容区 -->
    <main class="preview-body">
      <a-spin v-if="loading" class="preview-loading" :loading="true" tip="加载中..." />

      <template v-else-if="item">
        <!-- Markdown -->
        <MdPreview v-if="cat === 'md'" :url="fileUrl" :mode="viewMode" />
        <!-- Office -->
        <DocxPreview v-else-if="cat === 'docx'" :url="fileUrl" />
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
            下载文件
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
.header-meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  flex-shrink: 0;
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
</style>
