/** 物料产出（匹配后端 MaterialItem） */
export interface Material {
  id: string;
  name: string;
  desc?: string;
  /** @deprecated 使用 ext，保留兼容 */
  type?: string;
  /** @deprecated 使用 R2Key，保留兼容 */
  path?: string;
  /** @deprecated 使用 name，保留兼容 */
  filename?: string;
  size?: number;
  /** @deprecated 使用 createTime */
  uploadedAt?: string;
  createTime?: string;
  tags?: string[];
  /** @deprecated 保留兼容 */
  category?: string;
  R2Key: string;
  ext: string;
}

/** 列表响应 */
export interface MaterialListResponse {
  success: boolean;
  data: Material[];
  count: number;
  cateMap: Record<string, number>;
  /** 乐观锁版本号 */
  versions?: Record<string, number>;
}

/** 上传响应 */
export interface UploadResult {
  success: boolean;
  data: Material;
  msg?: string;
  previewUrl?: string;
}

/** 认证状态响应 */
export interface AuthStatusResponse {
  requireAuth: boolean;
  authenticated: boolean;
}

/** API 错误 */
export interface ApiError {
  success: false;
  msg: string;
  error?: string;
  code?: string;
}
