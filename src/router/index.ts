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
      meta: { requiresAuth: false }, // 公开访问
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
 * 清理所有残留的 Arco Design popup DOM（tooltip / dropdown / popover 等）
 * 这些 popup 通过 portal 渲染到 body 上，组件卸载或路由切换时可能残留
 */
function clearAllArcoPopups() {
  document
    .querySelectorAll('.arco-tooltip-popup, .arco-trigger-popup, .arco-dropdown-popup, .arco-popover-popup, .arco-select-popup')
    .forEach((el) => {
      if (
        el.querySelector('.arco-tooltip-content') ||
        el.querySelector('.arco-dropdown-menu') ||
        el.querySelector('.arco-popover-content') ||
        el.classList.contains('arco-tooltip-popup')
      ) {
        el.remove();
      }
    });
}

/** 页面切换期间隐藏所有 Arco popup，防止残留 tooltip 跨页面可见 */
const POPUP_HIDE_CLASS = 'arco-popup-hidden';

function mutePopupsDuringTransition() {
  document.body.classList.add(POPUP_HIDE_CLASS);
  clearAllArcoPopups();
}

function unmutePopupsAfterTransition() {
  document.body.classList.remove(POPUP_HIDE_CLASS);
  clearAllArcoPopups();
}

/**
 * 全局导航守卫 — 统一鉴权
 *
 * 策略：
 * - 需要认证的页面 → 未登录跳 /login
 * - /login 页面 → 已登录跳 /
 * - 未配置 LOGIN_TOKEN → 所有人都是已登录状态
 */
router.beforeEach(async (to, _from, next) => {
  // 立即清理 + 加 body class 隐藏所有 popup，双重防护
  mutePopupsDuringTransition();

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

router.afterEach(() => {
  // 路由完成后延迟解除 popup 隐藏，给页面渲染留出时间
  setTimeout(() => {
    unmutePopupsAfterTransition();
  }, 300);
});

export default router;
