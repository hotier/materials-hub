/** 扩展名 → 展示分类 */
export function getCategoryByExt(ext: string): string {
  const map: Record<string, string> = {
    html: '网页', htm: '网页',
    jpg: '图片', jpeg: '图片', png: '图片', gif: '图片', svg: '图片', webp: '图片', bmp: '图片', ico: '图标',
    pdf: '文档', doc: '文档', docx: '文档', xls: '文档', xlsx: '文档', ppt: '文档', pptx: '文档',
    txt: '文本', md: '文本', csv: '文本', xml: '文本', yaml: '文本', yml: '文本', log: '文本',
    json: '数据', sql: '数据',
    css: '代码', js: '代码', ts: '代码',
  };
  return map[ext.toLowerCase()] || '其他';
}