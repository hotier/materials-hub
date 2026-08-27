<template>
  <a-tooltip
    :content="content"
    position="top"
    :mouse-enter-delay="400"
    :popup-container="popupContainer ?? defaultPopupContainer"
    :arrow="true"
    :disabled="!isOverflow"
  >
    <span ref="innerRef" :class="textClass"><slot /></span>
  </a-tooltip>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount, watch } from 'vue';

const props = defineProps<{
  content: string;
  textClass?: string;
  popupContainer?: HTMLElement | string;
}>();

const defaultPopupContainer = document.body;
const innerRef = ref<HTMLElement | null>(null);
const isOverflow = ref(false);
let ro: ResizeObserver | null = null;

/** 文字是否溢出容器（scrollWidth > clientWidth 才显示浮选） */
function checkOverflow() {
  const el = innerRef.value;
  if (!el) return;
  isOverflow.value = el.scrollWidth > el.clientWidth + 1;
}

onMounted(() => {
  // 等表格布局完成后再测量
  nextTick(() => {
    checkOverflow();
    if (innerRef.value) {
      ro = new ResizeObserver(checkOverflow);
      ro.observe(innerRef.value);
    }
  });
});

watch(
  () => props.content,
  () => nextTick(checkOverflow),
);

onBeforeUnmount(() => ro?.disconnect());
</script>
