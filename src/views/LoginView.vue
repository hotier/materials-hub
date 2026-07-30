<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IconLock } from '@arco-design/web-vue/es/icon'
import { useApi } from '@/composables/useApi'
import { useToast } from '@/composables/useToast'

const api = useApi()
const router = useRouter()
const route = useRoute()
const { toast } = useToast()

const password = ref('')
const loading = ref(false)
const rememberPwd = ref(false)

onMounted(() => {
  const saved = localStorage.getItem('savedPassword')
  if (saved) {
    password.value = saved
    rememberPwd.value = true
  }
})

async function handleLogin() {
  if (!password.value) {
    toast('请输入访问密码', 'warning')
    return
  }
  loading.value = true
  try {
    const res = await api.login(password.value, rememberPwd.value)
    if (res.success) {
      if (rememberPwd.value) {
        localStorage.setItem('savedPassword', password.value)
      } else {
        localStorage.removeItem('savedPassword')
      }
      toast('验证成功', 'success')
      const redirect = (route.query.redirect as string) || '/'
      router.replace(redirect)
    } else {
      toast('密码错误', 'error')
    }
  } catch (err: any) {
    toast(err?.message || '验证失败', 'error')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <!-- 背景装饰 -->
    <div class="login-bg">
      <div class="bg-blob bg-blob-1"></div>
      <div class="bg-blob bg-blob-2"></div>
    </div>

    <div class="login-wrapper">
      <div class="card">
        <!-- 品牌区 -->
        <div class="brand">
          <svg class="brand-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="14" fill="url(#brandGrad)" />
            <path d="M13 29V19L24 25L35 19V29" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M13 23L24 29L35 23" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
            <defs>
              <linearGradient id="brandGrad" x1="0" y1="0" x2="48" y2="48">
                <stop stop-color="#0071e3" />
                <stop offset="1" stop-color="#5e5ce6" />
              </linearGradient>
            </defs>
          </svg>
          <div class="brand-text">
            <h1 class="brand-name">素材中心</h1>
            <p class="brand-sub">物料资源管理平台</p>
          </div>
        </div>

        <div class="input-group">
          <a-input-password
            v-model="password"
            placeholder="访问密码"
            size="large"
            allow-clear
            :invisible-button="true"
            @press-enter="handleLogin"
          >
            <template #prefix>
              <IconLock />
            </template>
          </a-input-password>
        </div>

        <a-checkbox v-model="rememberPwd" class="remember-box">
          记住密码
        </a-checkbox>

        <a-button
          type="primary"
          size="large"
          :loading="loading"
          long
          class="login-btn"
          @click="handleLogin"
        >
          登录
        </a-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ====== 整体布局 ====== */
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--color-bg-page);
  position: relative;
  overflow: hidden;
}

/* ====== 背景装饰 ====== */
.login-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.bg-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.08;
}
.bg-blob-1 {
  width: 540px;
  height: 540px;
  background: var(--color-primary);
  top: -180px;
  left: -120px;
  animation: blobFloat1 14s ease-in-out infinite;
}
.bg-blob-2 {
  width: 400px;
  height: 400px;
  background: #5e5ce6;
  bottom: -120px;
  right: -80px;
  animation: blobFloat2 16s ease-in-out infinite;
}
@keyframes blobFloat1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(40px, 30px) scale(1.08); }
}
@keyframes blobFloat2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-30px, -20px) scale(1.06); }
}

/* ====== 主容器 ====== */
.login-wrapper {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  animation: fadeIn 0.5s var(--ease-out);
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ====== 品牌区 ====== */
.brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--gap-xl);
  margin-bottom: var(--gap-3xl);
}
.brand-icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}
.brand-text {
  display: flex;
  flex-direction: column;
}
.brand-name {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: -0.5px;
  line-height: 1.4;
}
.brand-sub {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin: 0;
  line-height: 1.4;
}

/* ====== 卡片 ====== */
.card {
  width: 400px;
  background: var(--color-bg-surface);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-lg);
  padding: var(--gap-3xl);
}

/* ====== 输入 ====== */
.input-group {
  margin-bottom: var(--gap-md);
}
.input-group :deep(.arco-input-wrapper) {
  height: 44px;
}

.remember-box {
  margin-bottom: var(--gap-md);
}

.login-btn {
  width: 100%;
  height: 44px;
  font-weight: var(--font-weight-semibold);
}

/* ====== 响应式 ====== */
@media (max-width: 500px) {
  .card {
    width: calc(100vw - 48px);
    padding: var(--gap-2xl) var(--gap-xl);
  }
  .brand-icon {
    width: 40px;
    height: 40px;
  }
  .brand-name {
    font-size: var(--font-size-xl);
  }
}
</style>
