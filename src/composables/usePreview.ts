import { useApi } from './useApi'
import type { Material } from '../types'

export type PreviewCategory =
  | 'docx' | 'excel' | 'pdf' | 'pptx'
  | 'md' | 'code' | 'image' | 'video' | 'audio'
  | 'html' | 'unknown'

const EXT_MAP: Record<string, PreviewCategory> = {
  // Office
  doc: 'docx', docx: 'docx',
  xls: 'excel', xlsx: 'excel', xlsm: 'excel',
  pdf: 'pdf',
  ppt: 'pptx', pptx: 'pptx',
  // Markdown
  md: 'md', mdx: 'md',
  // Code / Text
  txt: 'code', log: 'code', csv: 'code', tsv: 'code',
  json: 'code', xml: 'code', yaml: 'code', yml: 'code', toml: 'code',
  js: 'code', jsx: 'code', ts: 'code', tsx: 'code', mjs: 'code', cjs: 'code',
  vue: 'code', svelte: 'code',
  py: 'code', rb: 'code', go: 'code', rs: 'code', rlib: 'code',
  java: 'code', kt: 'code', scala: 'code',
  c: 'code', cpp: 'code', h: 'code', hpp: 'code',
  css: 'code', scss: 'code', less: 'code', styl: 'code',
  sql: 'code', sh: 'code', bash: 'code', zsh: 'code', ps1: 'code',
  dockerfile: 'code', makefile: 'code',
  ini: 'code', cfg: 'code', conf: 'code', env: 'code',
  // Media（仅浏览器原生可解析的容器；avi/mkv/mov/wmv/flv 走下载提示页）
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image',
  webp: 'image', svg: 'image', bmp: 'image', ico: 'image', avif: 'image',
  mp4: 'video', webm: 'video',
  mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', aac: 'audio', m4a: 'audio',
  // Web
  html: 'html', htm: 'html',
}

/** 需要文本内容渲染的类型 */
const NEEDS_FETCH: PreviewCategory[] = ['md', 'code', 'html']

export function usePreview() {
  const api = useApi()

  /**
   * 从 Material 推导扩展名
   * 优先用 item.ext，其次用 item.R2Key 路径分析，兜底用 name
   */
  function getExtFromItem(item: Material): string {
    if (item.ext) return item.ext.toLowerCase()

    // 从 R2Key 取扩展名
    const key = item.R2Key || item.path || ''
    const dot = key.lastIndexOf('.')
    if (dot >= 0) return key.substring(dot + 1).toLowerCase()

    // 从 name 取
    const name = item.name || item.filename || ''
    const nameDot = name.lastIndexOf('.')
    if (nameDot >= 0) return name.substring(nameDot + 1).toLowerCase()

    return ''
  }

  function getCategory(item: Material | null): PreviewCategory {
    if (!item) return 'unknown'
    const ext = getExtFromItem(item)
    return EXT_MAP[ext] || 'unknown'
  }

  function getSrc(item: Material): string {
    return api.previewUrl(item.id)
  }

  function needsFetch(cat: PreviewCategory): boolean {
    return NEEDS_FETCH.includes(cat)
  }

  function isOfficeType(cat: PreviewCategory): boolean {
    return cat === 'docx' || cat === 'excel' || cat === 'pdf' || cat === 'pptx'
  }

  function isInlineable(cat: PreviewCategory): boolean {
    return cat === 'image' || cat === 'video' || cat === 'audio' || cat === 'html'
  }

  return {
    api,
    getCategory,
    getSrc,
    needsFetch,
    isOfficeType,
    isInlineable,
  }
}
