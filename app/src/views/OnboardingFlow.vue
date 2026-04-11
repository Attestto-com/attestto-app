<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useVaultStore } from '@/stores/vault'

const { t } = useI18n()
const router = useRouter()
const vault = useVaultStore()
const current = ref(0)

const screens = computed(() => [
  {
    icon: 'smartphone',
    title: t('onboarding.yourDeviceTitle'),
    body: t('onboarding.yourDeviceBody'),
  },
  {
    icon: 'verified_user',
    title: t('onboarding.whyDataTitle'),
    body: t('onboarding.whyDataBody'),
  },
  {
    icon: 'compare_arrows',
    title: t('onboarding.vsOldWayTitle'),
    body: t('onboarding.vsOldWayBody'),
  },
  {
    icon: 'shield',
    title: t('onboarding.cyberSecTitle'),
    body: t('onboarding.cyberSecBody'),
  },
  {
    icon: 'rocket_launch',
    title: t('onboarding.readyTitle'),
    body: t('onboarding.readyBody'),
  },
])

const isLast = computed(() => current.value === screens.value.length - 1)
const progress = computed(() => ((current.value + 1) / screens.value.length) * 100)

function next() {
  if (isLast.value) {
    complete()
  } else {
    current.value++
  }
}

function skip() {
  localStorage.setItem('attestto:onboarding:skipped', 'true')
  router.replace({ name: 'home' })
}

async function complete() {
  localStorage.setItem('attestto:onboarding:completed', 'true')

  // Mint BasicDigitalLiteracyCredential
  await vault.addCredential({
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiableCredential', 'BasicDigitalLiteracyCredential'],
    id: `urn:uuid:literacy-${Date.now()}`,
    issuer: { id: 'did:web:app.attestto.id', name: 'Attestto' },
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: vault.did ?? 'did:web:demo.attestto.id',
      completedAt: new Date().toISOString(),
      modules: ['privacy', 'data-consent', 'cybersecurity', 'self-custody'],
    },
  })

  router.replace({ name: 'home' })
}
</script>

<template>
  <div class="onboarding">
    <!-- Progress bar -->
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: progress + '%' }" />
    </div>

    <!-- Skip button -->
    <button class="skip-btn" @click="skip">
      {{ t('onboarding.skip') }}
    </button>

    <!-- Screen content -->
    <div class="screen-content">
      <div class="icon-circle">
        <q-icon :name="screens[current].icon" size="40px" />
      </div>

      <h2 class="screen-title">{{ screens[current].title }}</h2>
      <p class="screen-body">{{ screens[current].body }}</p>
    </div>

    <!-- Dots -->
    <div class="dots">
      <span
        v-for="(_, i) in screens"
        :key="i"
        class="dot"
        :class="{ active: i === current, done: i < current }"
      />
    </div>

    <!-- Action button -->
    <button class="action-btn" @click="next">
      {{ isLast ? t('onboarding.start') : t('onboarding.next') }}
    </button>
  </div>
</template>

<style scoped>
.onboarding {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100dvh;
  background: var(--bg-base);
  padding: var(--space-lg);
  padding-top: env(safe-area-inset-top, 16px);
  padding-bottom: env(safe-area-inset-bottom, 16px);
}

.progress-bar {
  width: 100%;
  height: 3px;
  background: var(--border-subtle);
  border-radius: 2px;
  margin-bottom: var(--space-md);
}

.progress-fill {
  height: 100%;
  background: var(--primary);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.skip-btn {
  align-self: flex-end;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  padding: var(--space-xs) var(--space-sm);
}

.screen-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  max-width: 320px;
  gap: var(--space-lg);
}

.icon-circle {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-full);
  background: var(--bg-card);
  border: 2px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
}

.screen-title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.3px;
  line-height: 1.2;
}

.screen-body {
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-muted);
}

.dots {
  display: flex;
  gap: var(--space-sm);
  margin: var(--space-xl) 0;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--border-subtle);
  transition: all 0.3s ease;
}

.dot.active {
  background: var(--primary);
  width: 24px;
}

.dot.done {
  background: var(--success);
}

.action-btn {
  width: 100%;
  max-width: 320px;
  padding: var(--space-md);
  border: none;
  border-radius: var(--radius-md);
  background: var(--primary);
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.action-btn:active {
  background: var(--primary-hover);
}
</style>
