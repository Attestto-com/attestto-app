<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const show = ref(false)
const platform = ref<'ios' | 'android' | null>(null)
const deferredPrompt = ref<Event | null>(null)

function isStandalone(): boolean {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true
    )
  } catch {
    return false
  }
}

function detectPlatform(): 'ios' | 'android' | null {
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return null
}

function dismiss() {
  show.value = false
  localStorage.setItem('attestto:pwa-install:dismissed', Date.now().toString())
}

async function installAndroid() {
  if (!deferredPrompt.value) return
  const prompt = deferredPrompt.value as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
  await prompt.prompt()
  const result = await prompt.userChoice
  if (result.outcome === 'accepted') {
    show.value = false
  }
  deferredPrompt.value = null
}

onMounted(() => {
  if (isStandalone()) return

  const dismissed = localStorage.getItem('attestto:pwa-install:dismissed')
  if (dismissed) {
    const age = Date.now() - Number(dismissed)
    // Show again after 7 days
    if (age < 7 * 24 * 60 * 60 * 1000) return
  }

  const p = detectPlatform()
  if (!p) return

  platform.value = p
  show.value = true

  // Android: capture beforeinstallprompt
  if (p === 'android') {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      deferredPrompt.value = e
    })
  }
})
</script>

<template>
  <Transition name="slide-up">
    <div v-if="show" class="install-banner">
      <div class="install-content">
        <img src="/icon-192.png" alt="Attestto" class="install-icon">
        <div class="install-text">
          <p class="install-title">{{ t('install.title') }}</p>
          <p class="install-desc">{{ t('install.desc') }}</p>
        </div>
        <button class="install-close" @click="dismiss" aria-label="Close">
          <q-icon name="close" size="18px" />
        </button>
      </div>

      <!-- iOS instructions -->
      <div v-if="platform === 'ios'" class="install-steps">
        <p class="install-step">
          <span class="step-icon">
            <q-icon name="ios_share" size="18px" />
          </span>
          {{ t('install.iosStep1') }}
        </p>
        <p class="install-step">
          <span class="step-icon">
            <q-icon name="add_box" size="18px" />
          </span>
          {{ t('install.iosStep2') }}
        </p>
      </div>

      <!-- Android install button -->
      <button
        v-if="platform === 'android'"
        class="install-btn"
        @click="installAndroid"
      >
        {{ t('install.androidBtn') }}
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.install-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-card);
  border-top: 1px solid var(--border-subtle);
  padding: var(--space-lg);
  padding-bottom: max(var(--space-lg), env(safe-area-inset-bottom, 0px));
  z-index: 9999;
  border-radius: 16px 16px 0 0;
}

.install-content {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.install-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  flex-shrink: 0;
}

.install-text {
  flex: 1;
  min-width: 0;
}

.install-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.install-desc {
  font-size: 13px;
  color: var(--text-muted);
  margin: 4px 0 0;
}

.install-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-xs);
  flex-shrink: 0;
}

.install-steps {
  margin-top: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.install-step {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

.step-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  color: var(--primary);
  flex-shrink: 0;
}

.install-btn {
  display: block;
  width: 100%;
  margin-top: var(--space-md);
  padding: var(--space-md);
  background: var(--primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.install-btn:active {
  opacity: 0.85;
}

.slide-up-enter-active {
  transition: transform 0.3s ease-out, opacity 0.3s ease-out;
}
.slide-up-leave-active {
  transition: transform 0.2s ease-in, opacity 0.2s ease-in;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
