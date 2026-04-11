<script setup lang="ts">
import { reactive } from 'vue'
import type { AgreementDraft, AgreementType } from '../types'
import { AGREEMENT_TYPE_LABELS } from '../types'

const props = defineProps<{ draft: AgreementDraft }>()
const emit = defineEmits<{ save: [edited: AgreementDraft]; cancel: [] }>()

const edited = reactive<AgreementDraft>(JSON.parse(JSON.stringify(props.draft)))
const types = Object.entries(AGREEMENT_TYPE_LABELS) as [AgreementType, string][]

function addParty() { edited.parties.push({ role: '', name: '' }) }
function removeParty(i: number) { edited.parties.splice(i, 1) }
function addTerm() { edited.terms.push({ description: '', value: '' }) }
function removeTerm(i: number) { edited.terms.splice(i, 1) }
function addObligation() { edited.obligations.push('') }
function removeObligation(i: number) { edited.obligations.splice(i, 1) }
function addAmount() { edited.amounts.push({ description: '', amount: 0, currency: 'USD' }) }
function removeAmount(i: number) { edited.amounts.splice(i, 1) }
function addDate() { edited.dates.push({ description: '', date: '' }) }
function removeDate(i: number) { edited.dates.splice(i, 1) }

function save() { emit('save', JSON.parse(JSON.stringify(edited))) }
</script>

<template>
  <div class="editor">
    <div class="field-group">
      <label class="field-label">Tipo de acuerdo</label>
      <select v-model="edited.type" class="field-select">
        <option v-for="[val, lbl] in types" :key="val" :value="val">{{ lbl }}</option>
      </select>
    </div>

    <div class="field-group">
      <label class="field-label">Resumen</label>
      <textarea v-model="edited.summary" class="field-textarea" rows="3" />
    </div>

    <!-- Parties -->
    <div class="field-group">
      <div class="field-header"><label class="field-label">Partes</label><button class="add-btn" @click="addParty">+ Agregar</button></div>
      <div v-for="(p, i) in edited.parties" :key="i" class="inline-row">
        <input v-model="p.role" class="field-input small" placeholder="Rol" />
        <input v-model="p.name" class="field-input" placeholder="Nombre" />
        <button class="remove-btn" @click="removeParty(i)">x</button>
      </div>
    </div>

    <!-- Terms -->
    <div class="field-group">
      <div class="field-header"><label class="field-label">Terminos</label><button class="add-btn" @click="addTerm">+ Agregar</button></div>
      <div v-for="(t, i) in edited.terms" :key="i" class="inline-row">
        <input v-model="t.description" class="field-input" placeholder="Descripcion" />
        <input v-model="t.value" class="field-input" placeholder="Valor" />
        <button class="remove-btn" @click="removeTerm(i)">x</button>
      </div>
    </div>

    <!-- Obligations -->
    <div class="field-group">
      <div class="field-header"><label class="field-label">Obligaciones</label><button class="add-btn" @click="addObligation">+ Agregar</button></div>
      <div v-for="(_, i) in edited.obligations" :key="i" class="inline-row">
        <input v-model="edited.obligations[i]" class="field-input" placeholder="Obligacion" />
        <button class="remove-btn" @click="removeObligation(i)">x</button>
      </div>
    </div>

    <!-- Amounts -->
    <div class="field-group">
      <div class="field-header"><label class="field-label">Montos</label><button class="add-btn" @click="addAmount">+ Agregar</button></div>
      <div v-for="(a, i) in edited.amounts" :key="i" class="inline-row">
        <input v-model="a.description" class="field-input" placeholder="Descripcion" />
        <input v-model.number="a.amount" class="field-input small" type="number" placeholder="Monto" />
        <input v-model="a.currency" class="field-input tiny" placeholder="USD" />
        <button class="remove-btn" @click="removeAmount(i)">x</button>
      </div>
    </div>

    <!-- Dates -->
    <div class="field-group">
      <div class="field-header"><label class="field-label">Fechas</label><button class="add-btn" @click="addDate">+ Agregar</button></div>
      <div v-for="(d, i) in edited.dates" :key="i" class="inline-row">
        <input v-model="d.description" class="field-input" placeholder="Descripcion" />
        <input v-model="d.date" class="field-input" placeholder="Fecha" />
        <button class="remove-btn" @click="removeDate(i)">x</button>
      </div>
    </div>

    <div class="editor-actions">
      <button class="btn-secondary" @click="emit('cancel')">Cancelar</button>
      <button class="btn-primary" @click="save">Guardar cambios</button>
    </div>
  </div>
</template>

<style scoped>
.editor { display: flex; flex-direction: column; gap: 16px; }
.field-group { display: flex; flex-direction: column; gap: 6px; }
.field-header { display: flex; justify-content: space-between; align-items: center; }
.field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted, #8b95a5); }
.field-input, .field-select, .field-textarea { background: var(--bg-deep, #080e14); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 6px 10px; color: var(--text, #e8eaed); font-size: 13px; font-family: inherit; outline: none; }
.field-input:focus, .field-select:focus, .field-textarea:focus { border-color: var(--primary, #594FD3); }
.field-input { flex: 1; }
.field-input.small { max-width: 100px; }
.field-input.tiny { max-width: 60px; }
.field-textarea { resize: vertical; }
.inline-row { display: flex; gap: 6px; align-items: center; }
.add-btn { background: none; border: 1px solid rgba(89,79,211,0.3); color: var(--primary, #594FD3); border-radius: 6px; padding: 2px 8px; font-size: 11px; cursor: pointer; }
.remove-btn { background: none; border: none; color: var(--text-dim, #5a6577); cursor: pointer; font-size: 14px; padding: 2px 6px; }
.remove-btn:hover { color: #ef4444; }
.editor-actions { display: flex; gap: 8px; justify-content: flex-end; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.06); }
.btn-secondary { background: var(--bg-card, #1a1f2e); color: var(--text, #e8eaed); border: none; border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn-primary { background: var(--primary, #594FD3); color: white; border: none; border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; }
</style>
