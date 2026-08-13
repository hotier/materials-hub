import type { Material, MaterialListResponse, AuthStatusResponse } from '@/types';

const BASE = '/api';

/**
 * 通用 fetch 封装
 * - 自动处理 401 → 跳转登录
 * - 统一 JSON 错误解析
 */
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    // 401/403 → 统一跳转登录页
    if (res.status === 401 || res.status === 403) {
      // 避免死循环：不在登录页时跳转
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
      throw new Error('认证已过期，请重新登录');
    }

    let msg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      msg = err.error || err.msg || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  return res.json() as Promise<T>;
}

/**
 * multipart 请求（不上 Content-Type 头，让浏览器自动设置 boundary）
 */
async function uploadMultipart<T>(url: string, formData: FormData): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
      throw new Error('认证已过期，请重新登录');
    }

    let msg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      msg = err.error || err.msg || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  return res.json() as Promise<T>;
}

/** 当前认证状态缓存 */
let cachedAuth: { authenticated: boolean; requireAuth: boolean } | null = null;

export function useApi() {
  // ===== 列表 =====
  async function list(): Promise<MaterialListResponse> {
    return request<MaterialListResponse>('/list');
  }

  // ===== 预览页获取单个产出元数据（公开，无需认证） =====
  async function getPreviewInfo(id: string): Promise<{ success: boolean; data?: Material; message?: string }> {
    const res = await fetch(`${BASE}/preview?id=${encodeURIComponent(id)}&info=1`);
    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.message || `HTTP ${res.status}` };
    }
    return data;
  }

  // ===== 预览页获取单个产出 =====
  async function getById(id: string): Promise<{ success: boolean; data: Material }> {
    return request(`${'/item?id='}${encodeURIComponent(id)}`);
  }

  // ===== 上传 =====
  async function upload(formData: FormData): Promise<{ success: boolean; item: Material; previewUrl: string; data?: Material }> {
    return uploadMultipart('/upload', formData);
  }

  // ===== 删除 =====
  async function remove(id: string): Promise<{ success: boolean; id: string }> {
    return request(`${'/item?id='}${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // ===== 编辑 =====
  async function update(
    id: string,
    data: { name: string; desc?: string; tags?: string[] },
  ): Promise<{ success: boolean; item: Material }> {
    return request(`${'/item?id='}${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // ===== 认证状态 =====
  async function authStatus(force = false): Promise<AuthStatusResponse> {
    if (!force && cachedAuth) return cachedAuth;

    const res = await fetch(`${BASE}/auth-status`, {
      // session cookie 自动携带（httpOnly）
      credentials: 'same-origin',
    });
    const json: AuthStatusResponse = await res.json();
    cachedAuth = json;
    return json;
  }

  /** 清除本地认证缓存（退出时调用） */
  function clearAuth() {
    cachedAuth = null;
  }

  // ===== 登录 =====
  async function login(pass: string, _remember: boolean): Promise<{ success: boolean }> {
    const res = await request<{ success: boolean }>('/login', {
      method: 'POST',
      body: JSON.stringify({ pass }),
    });
    if (res.success) {
      cachedAuth = { authenticated: true, requireAuth: true };
    }
    return res;
  }

  // ===== 注销 =====
  async function logout(): Promise<void> {
    await fetch(`${BASE}/logout`, {
      method: 'POST',
      credentials: 'same-origin',
    });
    cachedAuth = { authenticated: false, requireAuth: true };
  }

  // ===== URL 工具 =====
  function previewUrl(id: string): string {
    return `${BASE}/preview?id=${encodeURIComponent(id)}`;
  }

  function rawUrl(r2Key: string): string {
    return `${BASE}/raw?key=${encodeURIComponent(r2Key)}`;
  }

  function getPreviewPageUrl(id: string): string {
    return `/preview?id=${encodeURIComponent(id)}`;
  }

  return {
    list, upload, remove, update, getById, getPreviewInfo,
    authStatus, clearAuth, login, logout,
    previewUrl, rawUrl, getPreviewPageUrl,
  };
}
