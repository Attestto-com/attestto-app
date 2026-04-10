<script setup lang="ts">
import { ref, computed } from 'vue'

interface RequestedField {
  name: string
  required: boolean
  selected: boolean
}

const props = defineProps<{
  visible: boolean
  requester?: string
}>()

const emit = defineEmits<{
  share: [fields: string[]]
  reject: []
}>()

const fields = ref<RequestedField[]>([
  { name: 'Licencia de conducir', required: true, selected: true },
  { name: 'Nombre completo', required: true, selected: true },
  { name: 'Direccion', required: false, selected: false },
])

const sharing = ref(false)

const selectedFields = computed(() =>
  fields.value.filter((f) => f.selected).map((f) => f.name),
)

async function handleShare() {
  sharing.value = true
  // TODO: build VP with selective disclosure, sign with DID
  emit('share', selectedFields.value)
  sharing.value = false
}
</script>

<template>
  <q-dialog :model-value="visible" position="bottom" @hide="emit('reject')">
    <q-card class="present-sheet">
      <q-card-section class="present-header">
        <q-icon name="badge" size="28px" color="primary" />
        <span class="present-title">Presentar credencial</span>
      </q-card-section>

      <q-card-section>
        <div class="requester-label">Solicitado por:</div>
        <div class="requester-name">{{ requester ?? 'Verificador' }}</div>

        <div class="fields-label">Solicita:</div>
        <div class="fields-list">
          <label
            v-for="field in fields"
            :key="field.name"
            class="field-row"
          >
            <q-checkbox
              v-model="field.selected"
              :disable="field.required"
              color="primary"
              dense
            />
            <span>{{ field.name }}</span>
            <span v-if="!field.required" class="optional-tag">(opcional)</span>
          </label>
        </div>

        <div class="disclosure-hint">
          Selective disclosure: solo comparte lo marcado
        </div>
      </q-card-section>

      <q-card-actions vertical>
        <q-btn
          class="share-btn"
          unelevated
          color="primary"
          icon="lock"
          label="Compartir"
          :loading="sharing"
          @click="handleShare"
        />
        <q-btn
          flat
          label="Rechazar"
          color="grey"
          @click="emit('reject')"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.present-sheet {
  background: var(--bg-card);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  min-width: 100%;
}

.present-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.present-title {
  font-size: 18px;
  font-weight: 700;
}

.requester-label {
  font-size: 13px;
  color: var(--text-muted);
}

.requester-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: var(--space-md);
}

.fields-label {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: var(--space-sm);
}

.fields-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  margin-bottom: var(--space-md);
}

.field-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 14px;
  cursor: pointer;
}

.optional-tag {
  font-size: 11px;
  color: var(--text-muted);
}

.disclosure-hint {
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
  text-align: center;
  padding: var(--space-sm);
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
}

.share-btn {
  width: 100%;
}
</style>
