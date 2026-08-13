/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

declare module '~icons/*' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<
    { width?: number | string; height?: number | string; class?: string; style?: string },
    Record<string, unknown>,
    unknown
  >;
  export default component;
}
