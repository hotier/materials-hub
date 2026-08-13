<script setup lang="ts">
function getTransitionName(value: unknown): string {
  return typeof value === 'string' && value ? value : 'fade';
}
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <transition :name="getTransitionName(route.meta.transition)">
      <keep-alive include="HomeView">
        <component :is="Component" :key="route.path" />
      </keep-alive>
    </transition>
  </RouterView>
</template>
