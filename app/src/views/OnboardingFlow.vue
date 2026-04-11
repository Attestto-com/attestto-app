<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useVaultStore } from '@/stores/vault'
import { useLlm } from '@/composables/useLlm'

const { t } = useI18n()
const router = useRouter()
const vault = useVaultStore()
const llm = useLlm()
const current = ref(0)
const llmResponse = ref('')
const llmLoading = ref(false)
const llmVisible = ref(false)

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

const llmAvailable = computed(() => llm.status.value === 'ready')

// Contextual prompts for the LLM — one per screen
const llmPrompts = [
  'Explica en 2 oraciones simples por que es importante que las llaves criptograficas vivan solo en el dispositivo del usuario y no en un servidor.',
  'Explica en 2 oraciones simples por que una app debe pedir consentimiento antes de guardar datos personales y que significa credencial verificable.',
  'Explica en 2 oraciones simples como la identidad digital elimina filas y fotocopias comparado con el proceso tradicional.',
  'Explica en 2 oraciones simples los riesgos de compartir pantalla durante autenticacion y por que nadie legitimo pide tu PIN.',
  'Felicita al usuario en 1 oracion por completar su educacion digital basica.',
]

async function askLlm() {
  if (!llmAvailable.value || llmLoading.value) return
  llmLoading.value = true
  llmResponse.value = ''
  llmVisible.value = true
  try {
    const prompt = llmPrompts[current.value] ?? llmPrompts[0]
    llmResponse.value = await llm.generate(prompt)
  } catch {
    llmResponse.value = t('onboarding.llmError')
  } finally {
    llmLoading.value = false
  }
}

function clearLlm() {
  llmResponse.value = ''
  llmVisible.value = false
}

const isLast = computed(() => current.value === screens.value.length - 1)
const progress = computed(() => ((current.value + 1) / screens.value.length) * 100)

function next() {
  clearLlm()
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

      <!-- LLM contextual help -->
      <button
        v-if="llmAvailable && !llmVisible"
        class="why-btn"
        @click="askLlm"
      >
        <q-icon name="psychology" size="16px" />
        {{ t('onboarding.whyBtn') }}
      </button>

      <div v-if="llmVisible" class="llm-bubble">
        <div v-if="llmLoading" class="llm-loading">
          <q-spinner-dots size="20px" color="primary" />
        </div>
        <p v-else class="llm-text">{{ llmResponse }}</p>
      </div>
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

.why-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-full);
  color: var(--primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.why-btn:active {
  background: var(--bg-elevated);
}

.llm-bubble {
  width: 100%;
  padding: var(--space-md);
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  min-height: 48px;
}

.llm-loading {
  display: flex;
  justify-content: center;
  padding: var(--space-sm);
}

.llm-text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
  margin: 0;
}
</style>
