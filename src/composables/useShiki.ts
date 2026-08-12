import { createHighlighter, type Highlighter } from 'shiki';

let highlighter: Highlighter | null = null;
let initPromise: Promise<Highlighter> | null = null;

const langs = [
  'javascript',
  'typescript',
  'vue',
  'html',
  'css',
  'json',
  'yaml',
  'python',
  'java',
  'c',
  'cpp',
  'shell',
  'markdown',
  'xml',
  'sql',
  'plaintext',
];

export async function getHighlighter(): Promise<Highlighter> {
  if (highlighter) return highlighter;
  if (initPromise) return initPromise;
  initPromise = createHighlighter({
    themes: ['github-light'],
    langs,
  }).then((h) => {
    highlighter = h;
    return h;
  });
  return initPromise;
}

export function highlightCode(code: string, lang: string): string {
  if (!highlighter) return '';
  try {
    return highlighter.codeToHtml(code, { lang, theme: 'github-light' });
  } catch {
    return code;
  }
}

const langMap: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  vue: 'vue',
  html: 'html',
  css: 'css',
  scss: 'css',
  less: 'css',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  py: 'python',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  sh: 'shell',
  bash: 'shell',
  shell: 'shell',
  md: 'markdown',
  mdx: 'markdown',
  xml: 'xml',
  sql: 'sql',
  txt: 'plaintext',
  log: 'plaintext',
  csv: 'plaintext',
  plaintext: 'plaintext',
};

export function mapLang(ext?: string): string {
  if (!ext) return 'plaintext';
  return langMap[ext.toLowerCase()] || ext.toLowerCase();
}