import type { FileExt as _FE } from './lib/validation';

/** 文件扩展名（从 validation.ts 统一导出） */
export type FileExt = _FE;

/** 预览类型 */
export type PreviewType = 'html' | 'img' | 'code' | 'text' | 'office' | 'pdf';

/** 产出元数据 */
export interface MaterialItem {
  id: string;
  name: string;
  desc?: string;
  tags: string[];
  R2Key: string;
  ext: FileExt;
  /** 文件字节数；旧数据可能未保存此字段。 */
  size?: number;
  createTime: string;
  /** 用户上传时的文件夹相对路径（如 "项目A/图标"），不含 R2 内部目录前缀 */
  relativePath?: string;
}

/** API 统一错误响应 */
export interface ApiError {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

/** 上传/同步成功响应 */
export interface UploadResult {
  success: true;
  item: MaterialItem;
  previewUrl: string;
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
  filePath?: string;
}

/** 列表响应（含乐观锁版本号，供前端做条件更新） */
export interface ListResponse {
  items: MaterialItem[];
  versions: Record<string, number>;
}

/** Cloudflare 环境绑定 */
export interface Env {
  R2: R2Bucket;
  KV: KVNamespace;
  LOGIN_TOKEN?: string;
  SYNC_TOKEN?: string;
  ASSETS?: { fetch: typeof fetch };
}
