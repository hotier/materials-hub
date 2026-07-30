import { createRouter, createWebHistory } from 'vue-router';
import { useApi } from '@/composables/useApi';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/upload',
      name: 'upload',
      component: () => import('../views/UploadView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/preview',
      name: 'preview',
      component: () => import('../views/PreviewView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { guest: true }, // 仅未登录用户可访问
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
});

/**
 * 全局导航守卫 — 统一鉴权
 *
 * 策略：
 * - 需要认证的页面 → 未登录跳 /login
 * - /login 页面 → 已登录跳 /
 * - 未配置 LOGIN_TOKEN → 所有人都是已登录状态
 */
router.beforeEach(async (to, _from, next) => {
  const api = useApi();

  try {
    const status = await api.authStatus();

    // 需要认证但未认证 → 跳登录
    if (to.meta.requiresAuth && !status.authenticated) {
      next('/login');
      return;
    }

    // 已认证但访问登录页 → 跳首页
    if (to.meta.guest && status.authenticated) {
      next('/');
      return;
    }

    next();
  } catch {
    // 网络异常等：需要认证的页面放行（让页面内 API 自己报错）
    next();
  }
});

export default router;
