<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  IconUpload,
  IconArrowLeft,
  IconFile,
  IconFileImage,
  IconFileAudio,
  IconFileVideo,
  IconFilePdf,
  IconDelete,
} from '@arco-design/web-vue/es/icon';
import { Message } from '@arco-design/web-vue';
import { useApi } from '@/composables/useApi';
import type { FileItem, RequestOption } from '@arco-design/web-vue/es/upload/interfaces';

const api = useApi();
const router = useRouter();

const uploadRef = ref<{ submit: (fileItem?: FileItem) => void } | null>(null);
const fileList = ref<FileItem[]>([]);
const uploading = ref(false);
const dragOver = ref(false);

const hasFiles = computed(() => fileList.value.length > 0);

const progressInfo = computed(() => {
  const done = fileList.value.filter((f) => f.status === 'done').length;
  const error = fileList.value.filter((f) => f.status === 'error').length;
  const finished = done + error;
  const total = fileList.value.length;
  const percent = total > 0 ? Math.round((finished / total) * 100) : 0;
  const hasError = error > 0;
  const allDone = total > 0 && finished === total;
  return { done, error, finished, total, percent, hasError, allDone };
});

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'];
  const audioExts = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'wma', 'm4a'];
  const videoExts = ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'];
  const pdfExts = ['pdf'];
  if (imageExts.includes(ext)) return IconFileImage;
  if (audioExts.includes(ext)) return IconFileAudio;
  if (videoExts.includes(ext)) return IconFileVideo;
  if (pdfExts.includes(ext)) return IconFilePdf;
  return IconFile;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function customRequest(options: RequestOption) {
  const { fileItem, onError, onSuccess } = options;
  const formData = new FormData();
  formData.append('file', fileItem.file as File, fileItem.name);
  const basename = fileItem.name.replace(/\.[^.]+$/, '');
  formData.append('name', basename);
  formData.append('desc', '');
  formData.append('tags', '');

  api.upload(formData)
    .then((res) => {
      onSuccess(res);
    })
    .catch((err) => {
      onError(err);
    });
}

async function handleUploadAll() {
  if (!uploadRef.value) return;
  uploading.value = true;
  uploadRef.value.submit();
}

function handleSuccess(item: FileItem) {
  Message.success(`${item.name} 上传成功`);
  checkAllDone();
}

function handleError(item: FileItem) {
  Message.error(`${item.name} 上传失败`);
  checkAllDone();
}

function checkAllDone() {
  if (fileList.value.every((f) => f.status !== 'init' && f.status !== 'uploading')) {
    uploading.value = false;
  }
}

function removeFile(uid: string) {
  fileList.value = fileList.value.filter((f) => f.uid !== uid);
}

function clearList() {
  fileList.value = [];
}

function clearDone() {
  fileList.value = fileList.value.filter((f) => f.status !== 'done' && f.status !== 'error');
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  dragOver.value = true;
}
function onDragLeave(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  dragOver.value = false;
}
function onDrop(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  dragOver.value = false;
  const files = e.dataTransfer?.files;
  if (!files?.length) return;
  const newFiles: FileItem[] = Array.from(files).map((file, i) => ({
    uid: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
    name: file.name,
    file,
    status: 'init',
    percent: 0,
  }));
  fileList.value = [...fileList.value, ...newFiles];
}
</script>

<template>
  <div class="upload-page">
    <!-- 导航栏 -->
    <header class="upload-nav">
      <a-button type="text" @click="router.push('/')">
        <template #icon><IconArrowLeft /></template>
        返回
      </a-button>
      <span class="nav-title">上传物料</span>
    </header>

    <!-- 居中内容区 -->
    <main class="upload-main">
      <div class="upload-container">
        <!-- 拖拽区 + 隐藏的文件选择 -->
        <div
          class="drop-zone"
          :class="{ 'is-drag-over': dragOver }"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @drop="onDrop"
        >
          <a-upload
            ref="uploadRef"
            v-model:file-list="fileList"
            :custom-request="customRequest"
            :auto-upload="false"
            :show-file-list="false"
            multiple
            @success="handleSuccess"
            @error="handleError"
          >
            <template #upload-button>
              <div class="trigger-inner">
                <div class="trigger-icon"><IconUpload :size="48" /></div>
                <p class="trigger-title">拖拽文件到此处上传</p>
                <p class="trigger-hint">或点击此处选择文件，支持批量上传</p>
              </div>
            </template>
          </a-upload>
        </div>

        <!-- 进度条 -->
        <div v-if="hasFiles" class="progress-bar-wrap">
          <a-progress
            :percent="progressInfo.percent / 100"
            :status="progressInfo.hasError ? 'danger' : progressInfo.allDone ? 'success' : undefined"
            :show-text="false"
            :stroke-width="24"
            size="large"
          />
          <span class="progress-label">
            {{ progressInfo.done }}/{{ progressInfo.total }}
          </span>
        </div>

        <!-- 文件列表（始终显示） -->
        <div class="file-section">
          <!-- 空状态 -->
          <div v-if="!hasFiles" class="file-empty">
            暂无文件，请从上方选择或拖拽文件
          </div>
          <ul v-else class="file-list">
            <li
              v-for="item in fileList"
              :key="item.uid"
              class="file-item"
              :class="`status-${item.status}`"
            >
              <component :is="getFileIcon(item.name)" class="file-icon" :size="20" />
              <span class="file-name">{{ item.name }}</span>
              <span class="file-size">{{ item.file ? formatSize(item.file.size) : '' }}</span>
              <a-tag
                v-if="item.status === 'init'"
                size="small"
              >等待</a-tag>
              <a-tag
                v-else-if="item.status === 'uploading'"
                color="arcoblue"
                size="small"
              >上传中</a-tag>
              <a-tag
                v-else-if="item.status === 'done'"
                color="green"
                size="small"
              >完成</a-tag>
              <a-tag
                v-else-if="item.status === 'error'"
                color="red"
                size="small"
              >失败</a-tag>
              <a-button
                type="text"
                size="mini"
                status="danger"
                class="file-remove"
                @click="removeFile(item.uid)"
              >
                <template #icon><IconDelete /></template>
              </a-button>
            </li>
          </ul>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div v-if="hasFiles" class="upload-actions">
        <a-button @click="clearList">清空列表</a-button>
        <a-button @click="clearDone">清空已完成</a-button>
        <a-button
          type="primary"
          :loading="uploading"
          :disabled="!fileList.some(f => f.status === 'init')"
          @click="handleUploadAll"
        >
          <template #icon><IconUpload /></template>
          上传全部
        </a-button>
      </div>
    </main>
  </div>
</template>

<style scoped>
.upload-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--color-bg-page);
}

/* ── 导航栏 ── */
.upload-nav {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
  padding: var(--gap-md) var(--gap-xl);
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border-light);
  flex-shrink: 0;
}
.nav-title {
  flex: 1;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

/* ── 主区域 ── */
.upload-main {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--gap-3xl) var(--gap-lg);
  gap: var(--gap-lg);
}

.upload-container {
  width: 100%;
  max-width: 680px;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

/* ── 拖拽区 ── */
.drop-zone {
  padding: var(--gap-lg);
}

/* 消除 a-upload 默认样式 */
:deep(.arco-upload) {
  width: 100%;
  display: block;
}

:deep(.arco-upload-list) {
  display: none;
}

.trigger-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--gap-sm);
  padding: var(--gap-3xl) var(--gap-lg);
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color var(--duration-normal), background var(--duration-normal);
}
.trigger-inner:hover,
.drop-zone.is-drag-over .trigger-inner {
  border-color: var(--color-primary);
  background: var(--color-primary-subtle);
}
.trigger-icon {
  color: var(--color-primary);
  opacity: 0.45;
  transition: opacity var(--duration-normal);
}
.trigger-inner:hover .trigger-icon { opacity: 0.7; }
.trigger-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}
.trigger-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  margin: 0;
}

/* ── 文件区域 ── */
.file-section {
  border-top: 1px dashed var(--color-border);
}

.file-empty {
  padding: var(--gap-2xl) var(--gap-md);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
}

.file-list {
  list-style: none;
  margin: 0;
  padding: var(--gap-md);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  padding: 10px var(--gap-md);
  background: var(--color-bg-page);
  border-radius: var(--radius-sm);
  transition: background var(--duration-fast);
}
.file-item.status-done {
  background: var(--color-success-subtle);
}
.file-item.status-error {
  background: var(--color-danger-subtle);
}

.file-icon {
  flex-shrink: 0;
  color: var(--color-text-tertiary);
}

.file-name {
  flex: 1;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.file-size {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.file-remove {
  flex-shrink: 0;
  opacity: 0.6;
  transition: opacity var(--duration-fast);
}
.file-remove:hover {
  opacity: 1;
}

/* ── 进度条 ── */
.progress-bar-wrap {
  position: relative;
  margin: 0 var(--gap-lg);
  padding: var(--gap-md) 0;
}

.progress-bar-wrap :deep(.arco-progress-line-outer) {
  border-radius: 12px;
}

.progress-bar-wrap :deep(.arco-progress-line-inner) {
  border-radius: 12px;
}

.progress-label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-white);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  z-index: 1;
}

/* ── 操作按钮 ── */
.upload-actions {
  display: flex;
  justify-content: center;
  gap: var(--gap-sm);
}

/* ── 响应式 ── */
@media (max-width: 768px) {
  .upload-main {
    padding: var(--gap-lg) var(--gap-md);
  }
  .upload-container {
    max-width: 100%;
  }
  .trigger-inner {
    padding: var(--gap-2xl) var(--gap-md);
  }
}
</style>
