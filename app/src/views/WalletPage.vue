<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useVaultStore } from '@/stores/vault'
import CredentialCard from '@/components/CredentialCard.vue'
import type { VerifiableCredential } from '@attestto/module-sdk'

const router = useRouter()
const vault = useVaultStore()
const activeTab = ref<'credentials' | 'accounts'>('credentials')

function handleCredentialTap(vc: VerifiableCredential) {
  router.push({ name: 'credential-detail', params: { id: vc.id } })
}

const countryFlags: Record<string, string> = {
  CR: '🇨🇷 Costa Rica',
  US: '🇺🇸 United States',
  BR: '🇧🇷 Brasil',
  MX: '🇲🇽 Mexico',
  PA: '🇵🇦 Panama',
  universal: 'Universal',
}
</script>

<template>
  <q-page class="wallet-page" padding>
    <h2 class="page-title">Wallet</h2>

    <div class="tab-bar">
      <button
        :class="['tab', { active: activeTab === 'credentials' }]"
        @click="activeTab = 'credentials'"
      >
        Credenciales
      </button>
      <button
        :class="['tab', { active: activeTab === 'accounts' }]"
        @click="activeTab = 'accounts'"
      >
        Cuentas
      </button>
    </div>

    <!-- Credentials Tab -->
    <div v-if="activeTab === 'credentials'">
      <template v-if="vault.credentialsByCountry.size">
        <section
          v-for="[country, creds] of vault.credentialsByCountry"
          :key="country"
          class="country-section"
        >
          <h3 class="country-header">{{ countryFlags[country] ?? country }}</h3>
          <div class="card-stack">
            <CredentialCard
              v-for="vc in creds"
              :key="vc.id"
              :credential="vc"
              @tap="handleCredentialTap"
            />
          </div>
        </section>
      </template>

      <div v-else class="empty-state">
        <q-icon name="badge" size="48px" color="grey-6" />
        <p>No hay credenciales aun</p>
        <p class="hint">Las credenciales apareceran aqui cuando las recibas</p>
      </div>
    </div>

    <!-- Accounts Tab -->
    <div v-if="activeTab === 'accounts'" class="onboarding-cta">
      <div class="onboarding-icon">
        <q-icon name="verified_user" size="40px" color="primary" />
      </div>
      <h3 class="onboarding-title">Completa tu identidad</h3>
      <p class="onboarding-desc">
        Verifica tu identidad para desbloquear cuentas, pagos y credenciales verificables.
      </p>
      <div class="onboarding-steps">
        <div class="onboarding-step">
          <span class="step-num">1</span>
          <div>
            <div class="step-title">Verificacion de identidad (KYC)</div>
            <div class="step-hint">Documento + selfie con prueba de vida</div>
          </div>
        </div>
        <div class="onboarding-step">
          <span class="step-num">2</span>
          <div>
            <div class="step-title">Credencial de identidad</div>
            <div class="step-hint">Recibe tu VC firmado por Attestto</div>
          </div>
        </div>
        <div class="onboarding-step">
          <span class="step-num">3</span>
          <div>
            <div class="step-title">Cuentas y pagos</div>
            <div class="step-hint">Attestto Pay — USD, CRC, EUR</div>
          </div>
        </div>
      </div>
      <q-btn
        label="Iniciar verificacion"
        color="primary"
        unelevated
        rounded
        class="onboarding-btn"
        @click="router.push({ name: 'settings' })"
      />
    </div>
  </q-page>
</template>

<style scoped>
.wallet-page {
  padding-bottom: 80px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: var(--space-md);
}

.tab-bar {
  display: flex;
  gap: 0;
  background: var(--bg-card);
  border-radius: var(--radius-sm);
  padding: 3px;
  margin-bottom: var(--space-lg);
}

.tab {
  flex: 1;
  padding: var(--space-sm) var(--space-md);
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.tab.active {
  background: var(--primary);
  color: white;
}

.country-section {
  margin-bottom: var(--space-lg);
}

.country-header {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: var(--space-sm);
}

.card-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xl) 0;
  color: var(--text-muted);
  text-align: center;
}

.hint {
  font-size: 13px;
}

.onboarding-cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-lg) var(--space-md);
  text-align: center;
}

.onboarding-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(89, 79, 211, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-md);
}

.onboarding-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: var(--space-xs);
}

.onboarding-desc {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: var(--space-lg);
  max-width: 280px;
}

.onboarding-steps {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  width: 100%;
  max-width: 300px;
  margin-bottom: var(--space-lg);
  text-align: left;
}

.onboarding-step {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
}

.step-num {
  width: 24px;
  height: 24px;
  min-width: 24px;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
}

.step-title {
  font-size: 14px;
  font-weight: 600;
}

.step-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.onboarding-btn {
  width: 100%;
  max-width: 280px;
}
</style>
