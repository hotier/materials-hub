<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import {
  IconUpload,
  IconArrowLeft,
  IconDelete,
  IconFolderAdd,
  IconFolder,
} from '@arco-design/web-vue/es/icon';
import { Message } from '@arco-design/web-vue';
import { useApi } from '@/composables/useApi';
import { getExtIcon } from '@/utils/fileType';
import type { FileItem, RequestOption } from '@arco-design/web-vue/es/upload/interfaces';
import type { TreeNodeData } from '@arco-design/web-vue/es/tree/interface';

interface FileTreeData extends TreeNodeData {
  uid?: string;
  fileItem?: FileItem;
  type?: 'file' | 'folder';
}

const api = useApi();
const router = useRouter();

const uploadRef = ref<{ submit: (fileItem?: FileItem) => void } | null>(null);
const fileList = ref<FileItem[]>([]);
const fileRelativePaths = ref<Record<string, string>>({});
const uploading = ref(false);
const dragOver = ref(false);
let pendingCount = 0;
let completedCount = 0;
let successCount = 0;
let errorCount = 0;

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

const hasFolderStructure = computed(() => {
  return Object.values(fileRelativePaths.value).some((p) => p.includes('/'));
});

const treeData = computed<FileTreeData[]>(() => {
  const fileMap = new Map<string, FileItem>();
  for (const item of fileList.value) {
    fileMap.set(item.uid, item);
  }

  const root: FileTreeData[] = [];

  // 把有相对路径的文件构建成树
  for (const [uid, path] of Object.entries(fileRelativePaths.value)) {
    if (!fileMap.has(uid)) continue;
    const parts = path.split('/');
    let current: FileTreeData[] = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;
      const key = parts.slice(0, i + 1).join('/');

      if (isLast) {
        current.push({
          key: uid,
          title: name,
          isLeaf: true,
          uid,
          fileItem: fileMap.get(uid),
          type: 'file',
        } as FileTreeData);
      } else {
        let folder = current.find(
          (n) => n.type === 'folder' && n.key === key,
        ) as FileTreeData | undefined;
        if (!folder) {
          folder = {
            key,
            title: name,
            isLeaf: false,
            children: [],
            type: 'folder',
          } as FileTreeData;
          current.push(folder);
        }
        current = folder.children! as FileTreeData[];
      }
    }
  }

  // 没有相对路径的扁平文件放在根层级
  for (const item of fileList.value) {
    if (fileRelativePaths.value[item.uid]) continue;
    root.push({
      key: item.uid,
      title: item.name || '',
      isLeaf: true,
      uid: item.uid,
      fileItem: item,
      type: 'file',
    } as FileTreeData);
  }

  return root;
});

function statusColor(status?: string): string {
  const map: Record<string, string> = {
    init: 'gray',
    uploading: 'arcoblue',
    done: 'green',
    error: 'red',
  };
  return map[status || ''] || 'gray';
}

function statusLabel(status?: string): string {
  const map: Record<string, string> = {
    init: '等待',
    uploading: '上传中',
    done: '完成',
    error: '失败',
  };
  return map[status || ''] || status || '';
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return getExtIcon(ext);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDisplayName(item: FileItem): string {
  return fileRelativePaths.value[item.uid] || item.name || '';
}

function customRequest(options: RequestOption) {
  const { fileItem, onError, onSuccess } = options;
  const formData = new FormData();
  formData.append('file', fileItem.file as File, fileItem.name);
  const displayName = getDisplayName(fileItem);
  const basename = (displayName || '').replace(/\.[^.]+$/, '').split('/').pop() || '';
  formData.append('name', basename);
  formData.append('desc', '');
  formData.append('tags', '');
  const rawPath = (fileItem as any).__relativePath ||
    fileRelativePaths.value[fileItem.uid] ||
    (fileItem.file as any)?.webkitRelativePath || '';
  const relativePath = rawPath.split('/').slice(0, -1).join('/');
  formData.append('relativePath', relativePath);

  api.upload(formData)
    .then((res) => {
      onSuccess(res);
    })
    .catch((err) => {
      onError(err);
    });
  return {
    abort() {},
  };
}

async function handleUploadAll() {
  if (!uploadRef.value) return;
  const toUpload = fileList.value.filter((f) => f.status === 'init');
  if (toUpload.length === 0) return;
  pendingCount = toUpload.length;
  completedCount = 0;
  successCount = 0;
  errorCount = 0;
  uploading.value = true;
  uploadRef.value.submit();
}

function handleError(fileItem: FileItem, _error?: unknown) {
  completedCount++;
  errorCount++;
  if (completedCount >= pendingCount) {
    uploading.value = false;
    showUploadSummary();
  }
}

function handleSuccess(fileItem: FileItem) {
  completedCount++;
  successCount++;
  if (completedCount >= pendingCount) {
    uploading.value = false;
    showUploadSummary();
  }
}

function showUploadSummary() {
  if (errorCount === 0) {
    Message.success(`已成功上传 ${successCount} 个文件`);
  } else if (successCount === 0) {
    Message.error(`${errorCount} 个文件上传失败`);
  } else {
    Message.warning(`成功 ${successCount} 个，失败 ${errorCount} 个`);
  }
  successCount = 0;
  errorCount = 0;
}

function removeFile(uid: string) {
  fileList.value = fileList.value.filter((f) => f.uid !== uid);
  delete fileRelativePaths.value[uid];
}

function clearList() {
  fileList.value = [];
  fileRelativePaths.value = {};
  pendingCount = 0;
  completedCount = 0;
  uploading.value = false;
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
async function onDrop(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  dragOver.value = false;

  const items = e.dataTransfer?.items;
  if (!items?.length) return;

  const collected: { file: File; path: string }[] = [];

  async function traverseEntry(entry: FileSystemEntry, parentPath = '') {
    if (entry.isFile) {
      return new Promise<void>((resolve) => {
        (entry as FileSystemFileEntry).file((file) => {
          collected.push({ file, path: parentPath + file.name });
          resolve();
        });
      });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const dirPath = parentPath + entry.name + '/';
      return new Promise<void>((resolve) => {
        reader.readEntries(async (entries) => {
          for (const child of entries) {
            await traverseEntry(child, dirPath);
          }
          resolve();
        });
      });
    }
  }

  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.();
    if (entry) {
      await traverseEntry(entry);
    }
  }

  if (collected.length === 0) return;

  const newFiles: FileItem[] = collected.map(({ file, path }, i) => {
    const uid = `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;
    fileRelativePaths.value[uid] = path;
    return {
      uid,
      name: path,
      file,
      status: 'init' as FileItem['status'],
      percent: 0,
      __relativePath: path,
    } as FileItem;
  });
  fileList.value = [...fileList.value, ...newFiles];
}

/**
 * Ctrl+V 粘贴文件（图片、文本等）
 */
function onPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items;
  if (!items?.length) return;

  const files: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }

  if (files.length === 0) return;
  e.preventDefault();

  const newItems: FileItem[] = files.map((file, i) => {
    const uid = `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;
    const name = file.name || `pasted-${Date.now()}.${file.type.split('/')[1] || 'png'}`;
    return {
      uid,
      name,
      file,
      status: 'init' as FileItem['status'],
      percent: 0,
    } as FileItem;
  });

  fileList.value = [...fileList.value, ...newItems];
  if (newItems.length === 1) {
    Message.info(`已添加 1 个文件：${newItems[0].name}`);
  } else {
    Message.info(`已添加 ${newItems.length} 个文件`);
  }
}

onMounted(() => {
  window.addEventListener('paste', onPaste);
});

onBeforeUnmount(() => {
  window.removeEventListener('paste', onPaste);
});
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
          @dragover.capture="onDragOver"
          @dragleave.capture="onDragLeave"
          @drop.capture="onDrop"
        >
          <!-- 主上传：支持多文件选择 -->
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
                <p class="trigger-title">拖拽文件或文件夹到此处上传</p>
                <p class="trigger-hint">点击选择文件，拖拽上传文件夹，或 Ctrl+V 粘贴</p>
                <!-- 次上传：支持文件夹选择 -->
                <a-upload
                  v-model:file-list="fileList"
                  :custom-request="customRequest"
                  :auto-upload="false"
                  :show-file-list="false"
                  directory
                  multiple
                  @success="handleSuccess"
                  @error="handleError"
                >
                  <template #upload-button>
                  <a-button type="primary" variant="outline" class="btn-primary-outline">
                      <template #icon><IconFolderAdd /></template>
                      选择文件夹
                    </a-button>
                  </template>
                </a-upload>
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

        <!-- 文件列表 -->
        <div class="file-section">
          <!-- 空状态 -->
          <div v-if="!hasFiles" class="file-empty">
            暂无文件，请从上方选择或拖拽文件
          </div>

          <!-- 目录树视图（有文件夹结构时） -->
          <div v-else-if="hasFolderStructure" class="file-tree-wrap">
            <a-tree
              :data="treeData"
              :default-expand-all="true"
              :show-line="true"
              :selectable="false"
              :checkable="false"
              block-node
            >
              <template #title="nodeData">
                <div class="tree-node-row">
                  <component
                    v-if="nodeData.type === 'file'"
                    :is="getFileIcon(nodeData.title || '')"
                    class="tree-file-icon"
                    :size="16"
                  />
                  <IconFolder v-else class="tree-folder-icon" :size="16" />
                  <span class="tree-node-name">{{ nodeData.title }}</span>
                  <span v-if="nodeData.fileItem?.file" class="tree-file-size">
                    {{ formatSize(nodeData.fileItem.file.size) }}
                  </span>
                  <a-tag
                    v-if="nodeData.type === 'file'"
                    size="small"
                    :color="statusColor(nodeData.fileItem?.status)"
                  >
                    {{ statusLabel(nodeData.fileItem?.status) }}
                  </a-tag>
                </div>
              </template>
              <template #extra="nodeData">
                <a-button
                  v-if="nodeData.type === 'file'"
                  type="text"
                  size="mini"
                  status="danger"
                  @click.stop="removeFile(nodeData.uid)"
                >
                  <template #icon><IconDelete /></template>
                </a-button>
              </template>
            </a-tree>
          </div>

          <!-- 扁平列表视图（无文件夹结构时） -->
          <ul v-else class="file-list">
            <li
              v-for="item in fileList"
              :key="item.uid"
              class="file-item"
              :class="`status-${item.status}`"
            >
              <component :is="getFileIcon(getDisplayName(item))" class="file-icon" :size="20" />
              <span class="file-name" :title="getDisplayName(item)">{{ getDisplayName(item) }}</span>
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
        <a-button
          type="primary"
          variant="outline"
          class="btn-primary-outline"
          :loading="uploading"
          :disabled="!fileList.some(f => f.status === 'init')"
          @click="handleUploadAll"
        >
          <template #icon><IconUpload /></template>
          上传全部
        </a-button>
        <a-button status="danger" variant="outline" class="btn-danger-outline" @click="clearList">
          <template #icon><IconDelete /></template>
          清空列表
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

/* 内层文件夹按钮的 upload 不撑满，保持内容宽度 */
.trigger-inner :deep(.arco-upload) {
  width: auto;
  display: inline-block;
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

/* ── 目录树 ── */
.file-tree-wrap {
  padding: var(--gap-sm) var(--gap-md);
}

.file-tree-wrap :deep(.arco-tree) {
  background: transparent;
}

.file-tree-wrap :deep(.arco-tree-node) {
  padding-right: var(--gap-sm);
}

.tree-node-row {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  flex: 1;
  min-width: 0;
}

.tree-file-icon {
  flex-shrink: 0;
  color: var(--color-text-tertiary);
}

.tree-folder-icon {
  flex-shrink: 0;
  color: var(--color-warning-text);
}

.tree-node-name {
  flex: 0 1 auto;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.tree-file-size {
  flex-shrink: 0;
  font-size: var(--font-size-xs);
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
  justify-content: space-between;
  gap: var(--gap-sm);
}

/* 蓝色轮廓按钮：覆盖 Arco 默认灰色 */
.btn-primary-outline {
  color: var(--color-primary) !important;
  border-color: var(--color-primary) !important;
  background: transparent !important;
}
.btn-primary-outline:hover {
  color: #fff !important;
  background: var(--color-primary) !important;
  border-color: var(--color-primary) !important;
}

/* 红色轮廓按钮 */
.btn-danger-outline {
  color: rgb(var(--danger-6)) !important;
  border-color: rgb(var(--danger-6)) !important;
  background: transparent !important;
}
.btn-danger-outline:hover {
  color: #fff !important;
  background: rgb(var(--danger-6)) !important;
  border-color: rgb(var(--danger-6)) !important;
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
