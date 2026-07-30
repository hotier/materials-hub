/**
 * 结构化错误类 — 统一错误处理
 */

/** API 业务异常（会转为 JSON 响应） */
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** 参数校验异常 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(400, message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/** 未授权异常 */
export class UnauthorizedError extends AppError {
  constructor(message = '未授权访问') {
    super(401, message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

/** 资源不存在异常 */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource}不存在`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/** 并发冲突异常 */
export class ConflictError extends AppError {
  constructor(message = '数据已被修改，请刷新后重试') {
    super(409, message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

/** 速率限制异常 */
export class RateLimitError extends AppError {
  constructor() {
    super(429, '请求过于频繁，请稍后重试', 'RATE_LIMITED');
    this.name = 'RateLimitError';
  }
}
