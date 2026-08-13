/* ======== Tabler Icons 导入 ======== */
import {
  IconFile,
  IconFileTypePdf,
  IconFileTypeDoc,
  IconFileTypeDocx,
  IconFileExcel,
  IconFileTypeXls,
  IconFileTypeCsv,
  IconFileTypePpt,
  IconFileTypeJpg,
  IconFileTypePng,
  IconFileTypeBmp,
  IconFileTypeSvg,
  IconFileTypeJs,
  IconFileTypeTs,
  IconFileTypeJsx,
  IconFileTypeTsx,
  IconFileTypeVue,
  IconFileTypeHtml,
  IconFileTypeXml,
  IconFileTypeCss,
  IconFileTypeZip,
  IconFileMusic,
  IconMovie,
  IconArchive,
  IconMarkdown,
  IconPhoto,
  IconCode,
} from '@tabler/icons-vue';

export type FileTypeIconComponent = typeof IconFile;

const extIconMap: Record<string, FileTypeIconComponent> = {
  pdf: IconFileTypePdf,
  doc: IconFileTypeDoc,
  docx: IconFileTypeDocx,
  xls: IconFileTypeXls,
  xlsx: IconFileExcel,
  csv: IconFileTypeCsv,
  ppt: IconFileTypePpt,
  pptx: IconFileTypePpt,
  jpg: IconFileTypeJpg,
  jpeg: IconFileTypeJpg,
  png: IconFileTypePng,
  gif: IconPhoto,
  bmp: IconFileTypeBmp,
  svg: IconFileTypeSvg,
  webp: IconPhoto,
  ico: IconPhoto,
  mp3: IconFileMusic,
  wav: IconFileMusic,
  ogg: IconFileMusic,
  aac: IconFileMusic,
  flac: IconFileMusic,
  wma: IconFileMusic,
  m4a: IconFileMusic,
  mp4: IconMovie,
  avi: IconMovie,
  mkv: IconMovie,
  mov: IconMovie,
  wmv: IconMovie,
  flv: IconMovie,
  webm: IconMovie,
  zip: IconFileTypeZip,
  rar: IconArchive,
  '7z': IconArchive,
  tar: IconArchive,
  gz: IconArchive,
  md: IconMarkdown,
  mdx: IconMarkdown,
  js: IconFileTypeJs,
  ts: IconFileTypeTs,
  vue: IconFileTypeVue,
  jsx: IconFileTypeJsx,
  tsx: IconFileTypeTsx,
  py: IconCode,
  java: IconCode,
  c: IconCode,
  cpp: IconCode,
  css: IconFileTypeCss,
  scss: IconFileTypeCss,
  less: IconFileTypeCss,
  json: IconCode,
  html: IconFileTypeHtml,
  xml: IconFileTypeXml,
  yaml: IconCode,
  yml: IconCode,
  sh: IconCode,
  bash: IconCode,
};

export function getExtIcon(ext: string): FileTypeIconComponent {
  return extIconMap[ext.toLowerCase()] || IconFile;
}

export function getExtColor(ext: string): string {
  const e = ext.toLowerCase();
  if (['pdf'].includes(e)) return '#FFECE8';
  if (['doc', 'docx'].includes(e)) return '#E8F3FF';
  if (['xls', 'xlsx', 'csv'].includes(e)) return '#E8FFEA';
  if (['ppt', 'pptx'].includes(e)) return '#FFF3E8';
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'].includes(e)) return '#F3E8FF';
  if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'wma', 'm4a'].includes(e)) return '#E8FBFF';
  if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'].includes(e)) return '#FFE8FB';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) return '#FFECE0';
  if (['md', 'mdx'].includes(e)) return '#E8F3FF';
  if (['html', 'xml'].includes(e)) return '#FFF3E8';
  if (['js', 'ts', 'vue', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'css', 'scss', 'less', 'json', 'yaml', 'yml', 'sh', 'bash'].includes(e)) return '#E6FFFB';
  return '#E8F3FF';
}
