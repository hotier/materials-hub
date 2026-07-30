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
  IconFolderAdd,
  IconFolder,
} from '@arco-design/web-vue/es/icon';
import { Message } from '@arco-design/web-vue';
import { useApi } from '@/composables/useApi';
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
const folderInputRef = ref<HTMLInputElement | null>(null);
const fileList = ref<FileItem[]>([]);
const fileRelativePaths = ref<Record<string, string>>({});
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

function handleFolderSelect() {
  folderInputRef.value?.click();
}

function onFolderInputChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (!files?.length) return;

  const folderName = files[0].webkitRelativePath?.split('/')[0] || '';

  const newFiles: FileItem[] = Array.from(files).map((file, i) => {
    const uid = `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;
    const relPath = (file as any).webkitRelativePath || file.name;
    fileRelativePaths.value[uid] = relPath;
    return {
      uid,
      name: relPath,
      file,
      status: 'init' as FileItem['status'],
      percent: 0,
      __relativePath: relPath,
    } as FileItem;
  });
  fileList.value = [...fileList.value, ...newFiles];
  if (folderName) {
    Message.info(`已选择文件夹「${folderName}」，共 ${files.length} 个文件`);
  }
  input.value = '';
}

function getDisplayName(item: FileItem): string {
  return fileRelativePaths.value[item.uid] || item.name || '';
}

function customRequest(options: RequestOption) {
  const { fileItem, onError, onSuccess } = options;
  const formData = new FormData();
  formData.append('file', fileItem.file as File, fileItem.name);
  // 文件名取原始文件名（去掉路径前缀）
  const displayName = getDisplayName(fileItem);
  const basename = (displayName || '').replace(/\.[^.]+$/, '').split('/').pop() || '';
  formData.append('name', basename);
  formData.append('desc', '');
  formData.append('tags', '');
  // 传递文件夹路径（优先从 FileItem 自定义属性取，再回退到 Map 和 File 对象）
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
  uploading.value = true;
  uploadRef.value.submit();
}

function handleSuccess(item: FileItem) {
  Message.success(`${getDisplayName(item)} 上传成功`);
  checkAllDone();
}

function handleError(item: FileItem) {
  Message.error(`${getDisplayName(item)} 上传失败`);
  checkAllDone();
}

function checkAllDone() {
  if (fileList.value.every((f) => f.status !== 'init' && f.status !== 'uploading')) {
    uploading.value = false;
  }
}

function removeFile(uid: string) {
  fileList.value = fileList.value.filter((f) => f.uid !== uid);
  delete fileRelativePaths.value[uid];
}

function clearList() {
  fileList.value = [];
  fileRelativePaths.value = {};
}

function clearDone() {
  const removedUids = fileList.value
    .filter((f) => f.status === 'done' || f.status === 'error')
    .map((f) => f.uid);
  fileList.value = fileList.value.filter((f) => f.status !== 'done' && f.status !== 'error');
  for (const uid of removedUids) {
    delete fileRelativePaths.value[uid];
  }
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
                <div class="trigger-actions">
                  <a-button type="outline" size="small" @click.stop="handleFolderSelect">
                    <template #icon><IconFolderAdd /></template>
                    选择文件夹
                  </a-button>
                </div>
              </div>
            </template>
          </a-upload>
          <!-- 隐藏的文件夹选择 input -->
          <input
            ref="folderInputRef"
            type="file"
            webkitdirectory
            multiple
            hidden
            @change="onFolderInputChange"
          />
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
.trigger-actions {
  margin-top: var(--gap-sm);
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
