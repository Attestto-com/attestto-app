<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useVaultStore } from '@/stores/vault'
import { seedDemoInbox } from '@/composables/useDemoData'

const vault = useVaultStore()
const router = useRouter()
const unlocking = ref(false)
const error = ref('')

async function handleUnlock() {
  unlocking.value = true
  error.value = ''
  try {
    const ok = await vault.unlock()
    if (ok) {
      seedDemoInbox()
      router.replace({ name: 'home' })
    } else {
      error.value = 'No se pudo desbloquear'
    }
  } catch {
    error.value = 'Error de autenticacion'
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
        <q-icon name="fingerprint" size="48px" />
      </button>

      <p class="unlock-hint">
        Desbloquear con biometrico o PIN
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

.unlock-hint {
  font-size: 14px;
  color: var(--text-muted);
}

.unlock-error {
  font-size: 13px;
  color: var(--critical);
}
</style>
