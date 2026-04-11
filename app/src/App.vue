<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import BottomNav from '@/components/BottomNav.vue'
import { bootstrapModules } from '@/composables/useModuleBootstrap'

const route = useRoute()
const showNav = computed(() => route.meta.nav === true)
const showUpdate = ref(false)
let doUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null

function onSwUpdate(e: Event) {
  const detail = (e as CustomEvent).detail
  doUpdate = detail.updateSW
  showUpdate.value = true
}

function applyUpdate() {
  if (doUpdate) doUpdate(true)
}

function dismissUpdate() {
  showUpdate.value = false
}

onMounted(() => {
  bootstrapModules()
  window.addEventListener('sw-update-available', onSwUpdate)
})

onUnmounted(() => {
  window.removeEventListener('sw-update-available', onSwUpdate)
})
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

    <!-- Update banner -->
    <Transition name="slide-down">
      <div v-if="showUpdate" class="update-banner">
        <span class="update-text">Nueva version disponible</span>
        <button class="update-btn" @click="applyUpdate">Actualizar</button>
        <button class="update-dismiss" @click="dismissUpdate" aria-label="Cerrar">
          <q-icon name="close" size="16px" />
        </button>
      </div>
    </Transition>

    <q-footer v-if="showNav" class="bg-transparent">
      <BottomNav />
    </q-footer>
  </q-layout>
</template>

<style>
.app-layout {
  background: var(--bg-base);
  min-height: 100dvh;
  padding-top: max(40px, env(safe-area-inset-top, 40px));
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.update-banner {
  position: fixed;
  top: max(8px, env(safe-area-inset-top, 8px));
  left: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--primary);
  border-radius: var(--radius-md);
  z-index: 9999;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

.update-text {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: white;
}

.update-btn {
  padding: 4px 12px;
  background: white;
  color: var(--primary);
  border: none;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.update-dismiss {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 2px;
}

.slide-down-enter-active {
  transition: transform 0.3s ease-out, opacity 0.3s ease-out;
}
.slide-down-leave-active {
  transition: transform 0.2s ease-in, opacity 0.2s ease-in;
}
.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
