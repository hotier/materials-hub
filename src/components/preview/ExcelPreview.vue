<template>
  <div class="preview-wrap preview-wrap--fill">
    <a-spin v-if="loading" :loading="true" class="preview-loading" tip="加载中..." />
    <div v-else-if="error" class="excel-error">{{ error }}</div>
    <template v-else>
      <div class="excel-table-wrap">
        <table class="excel-table">
          <thead>
            <tr>
              <th class="row-header">#</th>
              <th
                v-for="col in columns"
                :key="col"
                class="col-header"
              >{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, ri) in rows" :key="ri">
              <td class="row-header">{{ ri + 1 }}</td>
              <td
                v-for="(col, ci) in columns"
                :key="ci"
                :class="cellClass(ri, ci)"
              >{{ cellText(ri, ci) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="sheets.length > 1" class="sheet-tabs">
        <button
          v-for="(name, i) in sheets"
          :key="name"
          :class="['sheet-tab', { active: activeSheet === i }]"
          @click="switchSheet(i)"
        >{{ name }}</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import * as XLSX from 'xlsx'

const props = defineProps<{ url: string }>()
const emit = defineEmits<{ rendered: []; error: [msg: string] }>()

const loading = ref(true)
const error = ref('')

interface WorkbookCache {
  book: XLSX.WorkBook
  sheets: string[]
}
const wb = ref<WorkbookCache | null>(null)
const sheets = ref<string[]>([])
const activeSheet = ref(0)
const columns = ref<string[]>([])
const rows = ref<string[][]>([])

function columnLetter(index: number): string {
  let s = ''
  let n = index
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  }
  return s
}

function showSheet(wbData: WorkbookCache, idx: number) {
  const { book } = wbData
  const name = wbData.sheets[idx]
  const sheet = book.Sheets[name]

  const csv = XLSX.utils.sheet_to_csv(sheet, { RS: '\n', FS: ',' })
  const lines = csv.trim().split('\n')
  const data = lines.map((line: string) => line.split(','))

  const maxCols = Math.max(...data.map((r: string[]) => r.length), 1)
  columns.value = Array.from({ length: maxCols }, (_, i) => columnLetter(i))
  rows.value = data
  activeSheet.value = idx
}

function cellText(ri: number, ci: number): string {
  if (ri < rows.value.length && ci < rows.value[ri].length) {
    return rows.value[ri][ci] ?? ''
  }
  return ''
}

function cellClass(_ri: number, _ci: number): string {
  // 后续可扩展样式支持
  return ''
}

function switchSheet(idx: number) {
  if (!wb.value) return
  showSheet(wb.value, idx)
}

async function load() {
  loading.value = true
  error.value = ''

  try {
    const res = await fetch(props.url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = await res.arrayBuffer()
    const book = XLSX.read(new Uint8Array(buf), { type: 'array' })
    const sheetNames = book.SheetNames

    if (!sheetNames.length) throw new Error('文件中没有工作表')

    wb.value = { book, sheets: sheetNames }
    sheets.value = sheetNames
    showSheet(wb.value, 0)

    emit('rendered')
  } catch (e: any) {
    error.value = e?.message || 'Excel 加载失败'
    emit('error', error.value)
  } finally {
    loading.value = false
  }
}

watch(() => props.url, () => { load() }, { immediate: true })
</script>

<style scoped>
.preview-wrap { display: flex; flex-direction: column; }
.preview-wrap--fill { flex: 1; min-height: 0; }

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

.excel-error {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 40px;
  text-align: center;
  color: #e74c3c;
}

.excel-table-wrap {
  flex: 1;
  overflow: auto;
  background: #fff;
}

.excel-table {
  border-collapse: collapse;
  table-layout: auto;
  white-space: nowrap;
  font-size: 13px;
}

.row-header,
.col-header {
  position: sticky;
  background: #f5f5f5;
  color: #666;
  font-weight: 600;
  text-align: center;
  border: 1px solid #e0e0e0;
  padding: 4px 12px;
  min-width: 40px;
  z-index: 1;
}

.row-header {
  position: sticky;
  left: 0;
  z-index: 2;
  min-width: 48px;
}
.col-header {
  top: 0;
}
thead .row-header {
  z-index: 3;
}

.excel-table td {
  padding: 4px 12px;
  border: 1px solid #e0e0e0;
  color: #333;
  min-width: 80px;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.excel-table tr:hover td {
  background: #f5f8ff;
}

.sheet-tabs {
  display: flex;
  gap: 0;
  padding: 0 4px;
  background: #f5f5f5;
  border-top: 1px solid #e0e0e0;
  flex-shrink: 0;
  overflow-x: auto;
}

.sheet-tab {
  padding: 6px 16px;
  border: none;
  background: #ebebeb;
  color: #888;
  font-size: 12px;
  cursor: pointer;
  border-right: 1px solid #e0e0e0;
  outline: none;
  transition: background .15s;
}
.sheet-tab:hover {
  background: #e0e0e0;
  color: #555;
}
.sheet-tab.active {
  background: #fff;
  color: #333;
  border-bottom: 2px solid #4a9eff;
}
</style>
