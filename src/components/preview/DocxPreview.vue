<template>
  <div class="preview-wrap preview-wrap--fill">
    <VueOfficeDocx :src="src" @rendered="emit('rendered')" @error="onError" />
  </div>
</template>

<script setup lang="ts">
import VueOfficeDocx from '@vue-office/docx'
import '@vue-office/docx/lib/index.css'

defineProps<{ src: string }>()
const emit = defineEmits<{ rendered: []; error: [msg: string] }>()

function onError() {
  emit('error', 'Word 文档加载失败')
}
</script>

<style scoped>
.preview-wrap { display: flex; flex-direction: column; }
.preview-wrap--fill { flex: 1; min-height: 0; overflow: auto; }
.preview-wrap :deep(.docx-wrapper) { background: #fff; }
</style>
