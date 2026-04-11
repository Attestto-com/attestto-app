<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useVaultStore } from '@/stores/vault'
import { isRegistered } from '@/composables/useCrypto'
import PwaInstallBanner from '@/components/PwaInstallBanner.vue'

const { t } = useI18n()
const vault = useVaultStore()
const router = useRouter()
const unlocking = ref(false)
const error = ref('')
const showRecovery = ref(false)

const isFirstTime = computed(() => !isRegistered())

async function handleUnlock() {
  unlocking.value = true
  error.value = ''
  showRecovery.value = false
  try {
    const ok = await vault.unlock()
    if (ok) {
      const onboarded = localStorage.getItem('attestto:onboarding:completed')
        || localStorage.getItem('attestto:onboarding:skipped')
      router.replace({ name: onboarded ? 'home' : 'onboarding' })
    } else {
      error.value = t('lock.unlockFailed')
    }
  } catch (e: unknown) {
    if (e instanceof DOMException) {
      if (e.name === 'NotAllowedError') {
        error.value = t('lock.authCancelled')
      } else if (e.name === 'SecurityError') {
        error.value = t('lock.securityError')
      } else if (e.name === 'InvalidStateError') {
        error.value = t('lock.alreadyRegistered')
      } else {
        error.value = t('lock.authError')
      }
    } else if (e instanceof Error && e.message === 'KEY_MISSING') {
      error.value = t('lock.keyMissing')
      showRecovery.value = true
    } else {
      error.value = t('lock.authError')
    }
  } finally {
    unlocking.value = false
  }
}

async function handleRecovery() {
  const { destroyIdentity } = await import('@/composables/useCrypto')
  await destroyIdentity()
  showRecovery.value = false
  error.value = ''
}
</script>

<template>
  <div class="lock-screen">
    <div class="lock-content">
      <img src="/icon-192.png" alt="Attestto" class="logo-icon">
      <div class="logo">Attestto</div>

      <button class="unlock-btn" :disabled="unlocking" @click="handleUnlock">
        <q-icon :name="isFirstTime ? 'person_add' : 'fingerprint'" size="48px" />
        <q-spinner-dots v-if="unlocking" size="20px" color="primary" class="spinner" />
      </button>

      <p class="unlock-hint">
        {{ isFirstTime ? t('lock.createIdentity') : t('lock.unlockHint') }}
      </p>

      <p v-if="error" class="unlock-error">{{ error }}</p>

      <button v-if="showRecovery" class="recovery-btn" @click="handleRecovery">
        {{ t('lock.resetIdentity') }}
      </button>
    </div>

    <PwaInstallBanner />
  </div>
</template>

<style scoped>
.lock-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  background: var(--bg-base);
}

.lock-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xl);
}

.logo-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
}

.logo {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.unlock-btn {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: var(--radius-full);
  border: 2px solid var(--border-subtle);
  background: var(--bg-card);
  color: var(--primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.unlock-btn:active {
  transform: scale(0.95);
  background: var(--bg-elevated);
}

.unlock-btn:disabled {
  opacity: 0.5;
}

.spinner {
  position: absolute;
  bottom: -24px;
}

.unlock-hint {
  font-size: 14px;
  color: var(--text-muted);
}

.unlock-error {
  font-size: 13px;
  color: var(--critical);
  text-align: center;
  max-width: 280px;
}

.recovery-btn {
  padding: var(--space-sm) var(--space-lg);
  background: transparent;
  border: 1px solid var(--critical);
  border-radius: var(--radius-md);
  color: var(--critical);
  font-size: 13px;
  cursor: pointer;
}
</style>
