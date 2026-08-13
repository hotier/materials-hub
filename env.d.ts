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

declare module 'lamejs' {
  export class Mp3Encoder {
    constructor(channels: number, sampleRate: number, kbps: number);
    encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array;
    flush(): Int8Array;
  }
  const _default: { Mp3Encoder: typeof Mp3Encoder };
  export default _default;
}
