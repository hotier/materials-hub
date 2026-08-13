<template>
  <div class="preview-wrap preview-wrap--fill">
    <a-spin v-if="loading" :loading="true" class="preview-loading" tip="加载中..." />
    <VueOfficeDocx v-else :src="src" @rendered="onRendered" @error="onError" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import VueOfficeDocx from '@vue-office/docx'
import '@vue-office/docx/lib/index.css'

const props = defineProps<{ src: string }>()
const emit = defineEmits<{ rendered: []; error: [msg: string] }>()

const loading = ref(true)

function onRendered() {
  loading.value = false
  emit('rendered')
}

function onError() {
  loading.value = false
  emit('error', 'Word 文档加载失败')
}

watch(() => props.src, () => {
  loading.value = true
})
</script>

<style scoped>
.preview-wrap { display: flex; flex-direction: column; }
.preview-wrap--fill { flex: 1; min-height: 0; overflow: auto; }
.preview-wrap :deep(.docx-wrapper) { background: #fff; }

.preview-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: var(--gap-sm);
}
.preview-loading :deep(.arco-spin-children) {
  margin-left: 0;
}
</style>