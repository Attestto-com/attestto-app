<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useVaultStore } from '@/stores/vault'
import { seedDemoInbox } from '@/composables/useDemoData'
import { isRegistered } from '@/composables/useCrypto'

const { t } = useI18n()
const vault = useVaultStore()
const router = useRouter()
const unlocking = ref(false)
const error = ref('')

const isFirstTime = computed(() => !isRegistered())

async function handleUnlock() {
  unlocking.value = true
  error.value = ''
  try {
    const ok = await vault.unlock()
    if (ok) {
      seedDemoInbox()
      router.replace({ name: 'home' })
    } else {
      error.value = t('lock.unlockFailed')
    }
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'NotAllowedError') {
      error.value = t('lock.authCancelled')
    } else {
      error.value = t('lock.authError')
    }
  } finally {
    unlocking.value = false
  }
}
</script>

<template>
  <div class="lock-screen">
    <div class="lock-content">
      <div class="logo">Attestto</div>

      <button class="unlock-btn" :disabled="unlocking" @click="handleUnlock">
        <q-icon :name="isFirstTime ? 'person_add' : 'fingerprint'" size="48px" />
        <q-spinner-dots v-if="unlocking" size="20px" color="primary" class="spinner" />
      </button>

      <p class="unlock-hint">
        {{ isFirstTime ? t('lock.createIdentity') : t('lock.unlockHint') }}
      </p>

      <p v-if="error" class="unlock-error">{{ error }}</p>
    </div>
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
}
</style>
