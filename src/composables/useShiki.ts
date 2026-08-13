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
  'csharp',
  'shell',
  'markdown',
  'xml',
  'sql',
  'plaintext',
  'rust',
  'go',
  'php',
  'ruby',
  'swift',
  'kotlin',
  'lua',
  'perl',
  'r',
  'dart',
  'scala',
  'haskell',
  'elixir',
  'groovy',
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
    // 语言未注册或高亮失败时，降级为纯文本渲染
    try {
      return highlighter.codeToHtml(code, { lang: 'plaintext', theme: 'github-light' });
    } catch {
      return code;
    }
  }
}

const langMap: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  vue: 'vue',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'css',
  less: 'css',
  json: 'json',
  jsonc: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  py: 'python',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  shell: 'shell',
  md: 'markdown',
  mdx: 'markdown',
  xml: 'xml',
  svg: 'xml',
  sql: 'sql',
  rust: 'rust',
  rs: 'rust',
  go: 'go',
  php: 'php',
  ruby: 'ruby',
  rb: 'ruby',
  swift: 'swift',
  kt: 'kotlin',
  kts: 'kotlin',
  lua: 'lua',
  pl: 'perl',
  pm: 'perl',
  r: 'r',
  rmd: 'r',
  dart: 'dart',
  scala: 'scala',
  hs: 'haskell',
  haskell: 'haskell',
  ex: 'elixir',
  exs: 'elixir',
  elixir: 'elixir',
  groovy: 'groovy',
  gvy: 'groovy',
  txt: 'plaintext',
  log: 'plaintext',
  csv: 'plaintext',
  plaintext: 'plaintext',
  text: 'plaintext',
  conf: 'plaintext',
  env: 'plaintext',
};

export function mapLang(ext?: string): string {
  if (!ext) return 'plaintext';
  const mapped = langMap[ext.toLowerCase()];
  if (mapped) return mapped;
  // 未在映射表中的扩展名，尝试作为语言名直接使用
  // highlightCode 内部会 fallback 到 plaintext
  return ext.toLowerCase();
}
