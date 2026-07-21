<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const router = useRouter()

// Mock data — real Circle Developer Wallets integration lands under ATT-783 follow-up
interface Tx {
  id: string
  kind: 'in' | 'out'
  counterparty: string
  amount: number
  currency: 'CRC'
  ts: number
}

const balanceCrc = ref(0)
const balanceUsdc = ref(0)

const balanceFormatted = computed(() =>
  new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', minimumFractionDigits: 0 }).format(balanceCrc.value)
)

const usdcSubtitle = computed(() =>
  `${balanceUsdc.value.toFixed(2)} USDC · Circle Wallet`
)

const transactions = ref<Tx[]>([])

function formatAmount(amount: number) {
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', minimumFractionDigits: 0 }).format(amount)
}

function relTime(ts: number) {
  const d = Math.floor((Date.now() - ts) / 86400000)
  if (d === 0) return t('pagos.today')
  if (d === 1) return t('pagos.yesterday')
  return t('pagos.daysAgo', { n: d })
}

function handleSend() {}
function handleReceive() {}
function handleScan() {}
</script>

<template>
  <q-page class="pagos-page" padding>
    <header class="pagos-header">
      <div class="title">{{ t('nav.payments') }}</div>
      <q-btn flat round icon="person_outline" color="white" size="sm" @click="router.push({ name: 'settings' })" />
    </header>

    <!-- Balance card -->
    <section class="balance-card">
      <div class="balance-label">{{ t('pagos.balance') }}</div>
      <div class="balance-amount">{{ balanceFormatted }}</div>
      <div class="balance-sub">{{ usdcSubtitle }}</div>
    </section>

    <!-- Action row -->
    <section class="action-row">
      <button class="action-btn primary" @click="handleSend">
        <q-icon name="north_east" size="22px" />
        <span>{{ t('pagos.send') }}</span>
      </button>
      <button class="action-btn" @click="handleReceive">
        <q-icon name="south_west" size="22px" />
        <span>{{ t('pagos.receive') }}</span>
      </button>
      <button class="action-btn" @click="handleScan">
        <q-icon name="qr_code_scanner" size="22px" />
        <span>{{ t('pagos.scan') }}</span>
      </button>
    </section>

    <!-- Recent -->
    <section class="section">
      <h3 class="section-title">{{ t('pagos.recent') }}</h3>
      <div v-if="transactions.length" class="tx-list">
        <div v-for="tx in transactions" :key="tx.id" class="tx-row">
          <q-icon
            :name="tx.kind === 'in' ? 'south_west' : 'north_east'"
            size="20px"
            :style="{ color: tx.kind === 'in' ? 'var(--success)' : 'var(--text-base, white)' }"
          />
          <div class="tx-body">
            <div class="tx-counterparty">{{ tx.counterparty }}</div>
            <div class="tx-time">{{ relTime(tx.ts) }}</div>
          </div>
          <div :class="['tx-amount', tx.kind === 'in' ? 'in' : 'out']">
            {{ tx.kind === 'in' ? '+' : '−' }}{{ formatAmount(tx.amount) }}
          </div>
        </div>
      </div>
      <div v-else class="empty-tx">
        <q-icon name="receipt_long" size="32px" :style="{ color: 'var(--text-muted)' }" />
        <p>{{ t('pagos.noTx') }}</p>
      </div>
    </section>

    <div class="platform-caption">
      Attestto Pay · {{ t('pagos.custodyBy') }}
    </div>
  </q-page>
</template>

<style scoped>
.pagos-page {
  padding-bottom: 80px;
}

.pagos-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
}

.title {
  font-size: 22px;
  font-weight: 700;
}

.balance-card {
  background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 65%, black));
  border-radius: var(--radius-md);
  padding: var(--space-lg);
  margin-bottom: var(--space-lg);
  color: white;
}

.balance-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.8;
}

.balance-amount {
  font-size: 34px;
  font-weight: 700;
  margin-top: 6px;
  letter-spacing: -0.5px;
}

.balance-sub {
  font-size: 12px;
  opacity: 0.75;
  margin-top: 6px;
}

.action-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: var(--space-md) 0;
  background: var(--bg-card);
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-base, white);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.action-btn:active {
  background: var(--bg-elevated);
}

.action-btn.primary {
  background: var(--primary);
  color: white;
}

.action-btn.primary:active {
  background: color-mix(in srgb, var(--primary) 85%, black);
}

.section {
  margin-bottom: var(--space-lg);
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--space-sm);
}

.tx-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.tx-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-card);
  border-radius: var(--radius-sm);
}

.tx-body {
  flex: 1;
  min-width: 0;
}

.tx-counterparty {
  font-size: 14px;
  font-weight: 500;
}

.tx-time {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.tx-amount {
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.tx-amount.in { color: var(--success); }
.tx-amount.out { color: var(--text-base, white); }

.empty-tx {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-lg) var(--space-md);
  background: var(--bg-card);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  font-size: 13px;
}

.empty-tx p {
  margin: 0;
}

.platform-caption {
  text-align: center;
  font-size: 11px;
  color: var(--text-muted);
  margin-top: var(--space-lg);
}
</style>
