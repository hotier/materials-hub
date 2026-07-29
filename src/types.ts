/** 文件扩展名（小写），如 html jpg png txt json */
export type FileExt = string;

/** 预览类型：html=iframe | img=图片 | code=代码/文本 */
export type PreviewType = 'html' | 'img' | 'code' | 'text';

/** 产出元数据 */
export interface MaterialItem {
  id: string;
  name: string;
  desc?: string;
  tags: string[];
  R2Key: string;
  ext: FileExt;
  createTime: string;
}

/** API 统一错误响应 */
export interface ApiError {
  error: string;
  message?: string;
}

/** 上传成功响应 */
export interface UploadResult {
  success: true;
  item: MaterialItem;
}

/** 删除成功响应 */
export interface DeleteResult {
  success: true;
  id: string;
}

/** 同步请求体（单文件） */
export interface SyncPayload {
  name: string;
  desc?: string;
  tags?: string[];
  /** 本地文件绝对路径，sync 端点不支持此方式 */
  filePath?: string;
}

/** 批量同步请求体 */
export interface SyncBatchPayload {
  files: SyncPayload[];
}

/** Cloudflare 环境绑定 */
export interface Env {
  R2: R2Bucket;
  KV: KVNamespace;
  LOGIN_TOKEN?: string;
  SYNC_TOKEN?: string;
  ASSETS?: { fetch: typeof fetch };
}
