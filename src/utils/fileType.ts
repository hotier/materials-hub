/* ======== Iconify 图标导入 ======== */
import ITablerFile from '~icons/tabler/file';
import IProiconsPdf from '~icons/proicons/pdf';
import IHugeiconsDoc01 from '~icons/hugeicons/doc-01';
import IPrimeFileExcel from '~icons/prime/file-excel';
import IMingcutePptLine from '~icons/mingcute/ppt-line';
import IProiconsPhoto from '~icons/proicons/photo';
import IMaterialSymbolsAudioFileOutline from '~icons/material-symbols/audio-file-outline';
import IPhVideo from '~icons/ph/video';
import IHugeiconsZip02 from '~icons/hugeicons/zip-02';
import IMaterialSymbolsMarkdownOutline from '~icons/material-symbols/markdown-outline';
import ISolarCodeBold from '~icons/solar/code-bold';

export type FileTypeIconComponent = typeof ITablerFile;

const extIconMap: Record<string, FileTypeIconComponent> = {
  pdf: IProiconsPdf,
  doc: IHugeiconsDoc01,
  docx: IHugeiconsDoc01,
  xls: IPrimeFileExcel,
  xlsx: IPrimeFileExcel,
  csv: IPrimeFileExcel,
  ppt: IMingcutePptLine,
  pptx: IMingcutePptLine,
  jpg: IProiconsPhoto,
  jpeg: IProiconsPhoto,
  png: IProiconsPhoto,
  gif: IProiconsPhoto,
  bmp: IProiconsPhoto,
  svg: IProiconsPhoto,
  webp: IProiconsPhoto,
  ico: IProiconsPhoto,
  mp3: IMaterialSymbolsAudioFileOutline,
  wav: IMaterialSymbolsAudioFileOutline,
  ogg: IMaterialSymbolsAudioFileOutline,
  aac: IMaterialSymbolsAudioFileOutline,
  flac: IMaterialSymbolsAudioFileOutline,
  wma: IMaterialSymbolsAudioFileOutline,
  m4a: IMaterialSymbolsAudioFileOutline,
  mp4: IPhVideo,
  avi: IPhVideo,
  mkv: IPhVideo,
  mov: IPhVideo,
  wmv: IPhVideo,
  flv: IPhVideo,
  webm: IPhVideo,
  zip: IHugeiconsZip02,
  rar: IHugeiconsZip02,
  '7z': IHugeiconsZip02,
  tar: IHugeiconsZip02,
  gz: IHugeiconsZip02,
  md: IMaterialSymbolsMarkdownOutline,
  mdx: IMaterialSymbolsMarkdownOutline,
  js: ISolarCodeBold,
  ts: ISolarCodeBold,
  vue: ISolarCodeBold,
  jsx: ISolarCodeBold,
  tsx: ISolarCodeBold,
  py: ISolarCodeBold,
  java: ISolarCodeBold,
  c: ISolarCodeBold,
  cpp: ISolarCodeBold,
  css: ISolarCodeBold,
  scss: ISolarCodeBold,
  less: ISolarCodeBold,
  json: ISolarCodeBold,
  html: ISolarCodeBold,
  xml: ISolarCodeBold,
  yaml: ISolarCodeBold,
  yml: ISolarCodeBold,
  sh: ISolarCodeBold,
  bash: ISolarCodeBold,
};

export function getExtIcon(ext: string): FileTypeIconComponent {
  return extIconMap[ext.toLowerCase()] || ITablerFile;
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