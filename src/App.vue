<script setup lang="ts">
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <transition :name="route.meta.transition || 'fade'">
      <component :is="Component" :key="route.path" />
    </transition>
  </RouterView>
</template>
