import { Message } from '@arco-design/web-vue';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export function useToast() {
  function toast(message: string, type: ToastType = 'info', duration = 3000) {
    Message[type]({
      content: message,
      duration,
      closable: true,
    });
  }

  return { toast };
}
