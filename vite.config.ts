import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { vitePluginForArco } from '@arco-plugins/vite-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ArcoResolver } from 'unplugin-vue-components/resolvers';
import Icons from 'unplugin-icons/vite';
import IconsResolver from 'unplugin-icons/resolver';

export default defineConfig({
  plugins: [
    vue(),
    vitePluginForArco({
      style: 'css',
    }),
    AutoImport({
      resolvers: [ArcoResolver()],
      imports: ['vue', 'vue-router'],
      dts: 'src/auto-imports.d.ts',
    }),
    Icons({
      compiler: 'vue3',
      defaultStyle: 'display: inline-block;',
    }),
    Components({
      resolvers: [
        ArcoResolver({ sideEffect: true }),
        IconsResolver({
          prefix: 'i',
          enabledCollections: ['mdi', 'tabler', 'proicons', 'prime', 'hugeicons', 'solar', 'material-symbols', 'mingcute', 'ph', 'fa6-regular'],
        }),
      ],
      dts: 'src/components.d.ts',
    }),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  optimizeDeps: {
    include: ['lamejs'],
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // arco-design 组件库独立分包
          if (id.includes('node_modules/@arco-design')) {
            return 'vendor-arco';
          }
          // vue 和其他第三方包不拆分，避免循环引用导致运行时 TDZ 错误
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
});
