<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import BottomNav from '@/components/BottomNav.vue'

const route = useRoute()
const showNav = computed(() => route.meta.nav === true)
</script>

<template>
  <q-layout view="hHh lpR fFf" class="app-layout">
    <q-page-container>
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </q-page-container>

    <q-footer v-if="showNav" class="bg-transparent">
      <BottomNav />
    </q-footer>
  </q-layout>
</template>

<style>
.app-layout {
  background: var(--bg-base);
  min-height: 100dvh;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
