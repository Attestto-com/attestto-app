<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePresentationRequest } from '@/composables/usePresentationRequest'

const route = useRoute()
const router = useRouter()
const { step, request, matchResult, error, verifierName, canPresent, handleRequest, present, reset } =
  usePresentationRequest()

onMounted(() => {
  const raw = route.query.raw as string
  if (raw) handleRequest(raw)
})

function credentialLabel(id: string): string {
  const matched = matchResult.value?.matches.get(id)
  if (!matched?.length) return id
  const vc = matched[0]
  const types = vc.type.filter((t: string) => t !== 'VerifiableCredential')
  return types[0] ?? id
}
</script>

<template>
  <q-page class="present-page" padding>
    <q-btn flat round icon="arrow_back" color="white" @click="router.back()" class="back-btn" />

    <h2 class="page-title">Compartir credenciales</h2>

    <!-- Parsing -->
    <div v-if="step === 'parsing'" class="status-card">
      <q-spinner-dots size="32px" color="primary" />
      <p>Procesando solicitud...</p>
    </div>

    <!-- Select credentials to share -->
    <div v-else-if="step === 'selecting' && request" class="request-card">
      <div class="verifier-section">
        <q-icon name="shield" size="24px" color="primary" />
        <div>
          <div class="verifier-label">Verificador</div>
          <div class="verifier-name">{{ verifierName ?? request.client_id }}</div>
        </div>
      </div>

      <!-- Requested credentials -->
      <div v-if="request.dcql_query" class="cred-list">
        <div class="section-label">Credenciales solicitadas</div>

        <div
          v-for="cq in request.dcql_query.credentials"
          :key="cq.id"
          class="cred-row"
        >
          <q-icon
            :name="matchResult?.matches.has(cq.id) ? 'check_circle' : 'cancel'"
            :color="matchResult?.matches.has(cq.id) ? 'positive' : 'negative'"
            size="20px"
          />
          <div class="cred-info">
            <div class="cred-type">{{ credentialLabel(cq.id) }}</div>
            <div v-if="cq.claims" class="cred-claims">
              {{ cq.claims.map(c => c.path[c.path.length - 1]).join(', ') }}
            </div>
          </div>
          <div
            v-if="request.dcql_query.credential_sets"
            class="cred-badge"
          >
            {{
              request.dcql_query.credential_sets.find(cs =>
                cs.options.some(opt => opt.includes(cq.id))
              )?.required !== false
                ? 'Requerido'
                : 'Opcional'
            }}
          </div>
        </div>
      </div>

      <!-- Not satisfiable -->
      <div v-if="!canPresent" class="warning-box">
        <q-icon name="warning" size="20px" color="warning" />
        <span>Tu billetera no contiene todas las credenciales requeridas</span>
      </div>

      <div class="action-row">
        <q-btn flat label="Cancelar" color="grey" @click="router.back()" />
        <q-btn
          unelevated
          label="Compartir"
          color="primary"
          :disable="!canPresent"
          @click="present()"
        />
      </div>
    </div>

    <!-- Presenting -->
    <div v-else-if="step === 'presenting'" class="status-card">
      <q-spinner-dots size="32px" color="primary" />
      <p>Enviando presentacion...</p>
    </div>

    <!-- Success -->
    <div v-else-if="step === 'success'" class="status-card success">
      <q-icon name="check_circle" size="48px" color="positive" />
      <p>Credenciales compartidas</p>
      <q-btn unelevated label="Volver" color="primary" @click="router.push({ name: 'home' })" />
    </div>

    <!-- Error -->
    <div v-else-if="step === 'error'" class="status-card error">
      <q-icon name="error_outline" size="48px" color="negative" />
      <p>{{ error }}</p>
      <q-btn flat label="Reintentar" color="primary" @click="reset()" />
    </div>

    <!-- Idle -->
    <div v-else class="status-card">
      <q-icon name="qr_code_scanner" size="48px" color="grey-6" />
      <p>Escanea un codigo QR de un verificador</p>
    </div>
  </q-page>
</template>

<style scoped>
.present-page { padding-bottom: 80px; }
.back-btn { margin-bottom: var(--space-md); }
.page-title { font-size: 22px; font-weight: 700; margin-bottom: var(--space-lg); }
.status-card {
  display: flex; flex-direction: column; align-items: center;
  gap: var(--space-md); padding: var(--space-xl); text-align: center; color: var(--text-muted);
}
.status-card.success { color: var(--success); }
.status-card.error { color: var(--critical); }
.request-card {
  background: var(--bg-card); border-radius: var(--radius-lg);
  padding: var(--space-lg); display: flex; flex-direction: column; gap: var(--space-lg);
}
.verifier-section { display: flex; gap: var(--space-md); align-items: flex-start; }
.verifier-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; }
.verifier-name { font-size: 14px; }
.section-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; margin-bottom: var(--space-sm); }
.cred-row {
  display: flex; align-items: center; gap: var(--space-sm);
  padding: var(--space-sm); background: var(--bg-elevated, #252b3b);
  border-radius: var(--radius-sm); margin-bottom: var(--space-xs);
}
.cred-info { flex: 1; }
.cred-type { font-size: 14px; font-weight: 600; }
.cred-claims { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.cred-badge {
  font-size: 11px; padding: 2px 8px; border-radius: var(--radius-sm);
  background: var(--bg-card); color: var(--text-muted);
}
.warning-box {
  display: flex; align-items: center; gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md); background: rgba(255, 152, 0, 0.1);
  border: 1px solid rgba(255, 152, 0, 0.3); border-radius: var(--radius-sm);
  font-size: 13px; color: #ffb74d;
}
.action-row { display: flex; justify-content: flex-end; gap: var(--space-sm); }
</style>
