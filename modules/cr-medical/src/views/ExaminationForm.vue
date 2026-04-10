<template>
  <div class="min-h-screen bg-[#0f1923] text-[#e2e8f0] pb-32">
    <!-- Header -->
    <div class="px-4 pt-6 pb-4 flex items-center gap-3">
      <button class="text-[#94a3b8]" @click="$router.back()">← Volver</button>
      <div class="flex-1">
        <h1 class="text-lg font-semibold">Examen médico</h1>
        <p class="text-[#94a3b8] text-sm">{{ draft?.patient.nombre }} {{ draft?.patient.apellidos }}</p>
      </div>
    </div>

    <!-- Progress steps -->
    <div class="flex px-4 gap-1.5 mb-6">
      <div
        v-for="(section, i) in sections"
        :key="i"
        class="flex-1 h-1 rounded-full transition-colors"
        :class="i <= activeSection ? 'bg-[#594FD3]' : 'bg-[#1a1f2e]'"
      />
    </div>

    <div v-if="!draft" class="px-4 text-[#94a3b8]">Cargando borrador…</div>

    <div v-else>
      <!-- Section: Categorías solicitadas -->
      <section v-show="activeSection === 0" class="px-4">
        <h2 class="font-semibold mb-4">Categorías de licencia</h2>
        <p class="text-[#94a3b8] text-sm mb-4">Seleccione las categorías que el paciente solicita:</p>

        <div class="space-y-2">
          <button
            v-for="(label, cat) in LICENSE_CATEGORY_LABELS"
            :key="cat"
            class="w-full bg-[#1a1f2e] rounded-xl px-4 py-3 flex items-center gap-3 text-left"
            :class="selectedCategories.includes(cat) ? 'border border-[#594FD3]' : 'border border-transparent'"
            @click="toggleCategory(cat)"
          >
            <span class="text-[#594FD3]">{{ selectedCategories.includes(cat) ? '☑' : '☐' }}</span>
            <span class="text-sm">{{ label }}</span>
          </button>
        </div>
      </section>

      <!-- Section: Visión -->
      <section v-show="activeSection === 1" class="px-4 space-y-4">
        <h2 class="font-semibold mb-4">🔍 Examen de visión</h2>

        <ExamField label="Agudeza visual ojo derecho (OD)" hint="Ej: 20/20, 20/40">
          <input
            v-model="results.vision.rightEye"
            type="text"
            placeholder="20/20"
            class="w-full bg-[#0f1923] border border-[#2a2f3e] rounded-xl px-4 py-3 text-[#e2e8f0] focus:outline-none focus:border-[#594FD3]"
          />
        </ExamField>

        <ExamField label="Agudeza visual ojo izquierdo (OI)">
          <input
            v-model="results.vision.leftEye"
            type="text"
            placeholder="20/20"
            class="w-full bg-[#0f1923] border border-[#2a2f3e] rounded-xl px-4 py-3 text-[#e2e8f0] focus:outline-none focus:border-[#594FD3]"
          />
        </ExamField>

        <ExamField label="Campo visual">
          <PassFailToggle v-model="results.vision.visualField" />
        </ExamField>

        <ExamField label="Visión de colores" :hint="requiresColorVision ? 'Requerido para categoría seleccionada' : ''">
          <PassFailToggle v-model="results.vision.colorVision" />
        </ExamField>

        <div class="flex items-center gap-3 bg-[#1a1f2e] rounded-xl px-4 py-3">
          <input id="lenses" v-model="results.vision.requiresLenses" type="checkbox" class="accent-[#594FD3]" />
          <label for="lenses" class="text-sm">Requiere uso de lentes</label>
        </div>

        <div class="flex items-center gap-3 bg-[#1a1f2e] rounded-xl px-4 py-3">
          <input id="daytime" v-model="results.vision.daytimeOnly" type="checkbox" class="accent-[#f97316]" />
          <label for="daytime" class="text-sm text-[#f97316]">Solo conducción diurna</label>
        </div>
      </section>

      <!-- Section: Audición -->
      <section v-show="activeSection === 2" class="px-4 space-y-4">
        <h2 class="font-semibold mb-4">👂 Audición</h2>

        <ExamField label="Resultado auditivo">
          <PassFailToggle v-model="results.hearing.result" />
        </ExamField>

        <ExamField label="Pérdida auditiva (dB)" hint="Opcional">
          <input
            v-model.number="results.hearing.dbLoss"
            type="number"
            placeholder="0"
            class="w-full bg-[#0f1923] border border-[#2a2f3e] rounded-xl px-4 py-3 text-[#e2e8f0] focus:outline-none focus:border-[#594FD3]"
          />
        </ExamField>

        <div class="flex items-center gap-3 bg-[#1a1f2e] rounded-xl px-4 py-3">
          <input id="hearing-aid" v-model="results.hearing.requiresHearingAid" type="checkbox" class="accent-[#594FD3]" />
          <label for="hearing-aid" class="text-sm">Requiere audífono</label>
        </div>
      </section>

      <!-- Section: Presión arterial -->
      <section v-show="activeSection === 3" class="px-4 space-y-4">
        <h2 class="font-semibold mb-4">💓 Presión arterial</h2>

        <div class="grid grid-cols-3 gap-3">
          <ExamField label="Sistólica (mmHg)">
            <input
              v-model.number="results.bloodPressure.systolic"
              type="number"
              placeholder="120"
              class="w-full bg-[#0f1923] border border-[#2a2f3e] rounded-xl px-4 py-3 text-[#e2e8f0] focus:outline-none focus:border-[#594FD3]"
            />
          </ExamField>
          <ExamField label="Diastólica (mmHg)">
            <input
              v-model.number="results.bloodPressure.diastolic"
              type="number"
              placeholder="80"
              class="w-full bg-[#0f1923] border border-[#2a2f3e] rounded-xl px-4 py-3 text-[#e2e8f0] focus:outline-none focus:border-[#594FD3]"
            />
          </ExamField>
          <ExamField label="Pulso (bpm)">
            <input
              v-model.number="results.bloodPressure.pulse"
              type="number"
              placeholder="72"
              class="w-full bg-[#0f1923] border border-[#2a2f3e] rounded-xl px-4 py-3 text-[#e2e8f0] focus:outline-none focus:border-[#594FD3]"
            />
          </ExamField>
        </div>

        <div class="bg-[#1a1f2e] rounded-xl p-3 text-sm text-[#94a3b8]">
          <span v-if="bpClassification === 'normal'" class="text-[#4ade80]">✅ Presión normal</span>
          <span v-else-if="bpClassification === 'elevated'" class="text-[#fbbf24]">⚠️ Presión elevada — anote observaciones</span>
          <span v-else-if="bpClassification === 'high'" class="text-[#ef4444]">🚨 Hipertensión — evalúe aptitud</span>
          <span v-else class="text-[#94a3b8]">Ingrese valores para clasificar</span>
        </div>

        <ExamField label="Resultado final">
          <PassFailToggle v-model="results.bloodPressure.result" />
        </ExamField>
      </section>

      <!-- Section: Capacidades motoras -->
      <section v-show="activeSection === 4" class="px-4 space-y-4">
        <h2 class="font-semibold mb-4">🦾 Capacidades motoras</h2>

        <ExamField label="Coordinación mano-ojo">
          <PassFailToggle v-model="results.motor.coordination" />
        </ExamField>

        <ExamField label="Fuerza en extremidades">
          <PassFailToggle v-model="results.motor.strength" />
        </ExamField>

        <ExamField label="Reflejos">
          <PassFailToggle v-model="results.motor.reflexes" />
        </ExamField>

        <ExamField label="Adaptaciones vehiculares" hint="Opcional — si aplica">
          <input
            v-model="adaptationsText"
            type="text"
            placeholder="Ej: Palanca de cambios automática"
            class="w-full bg-[#0f1923] border border-[#2a2f3e] rounded-xl px-4 py-3 text-[#e2e8f0] focus:outline-none focus:border-[#594FD3]"
          />
        </ExamField>
      </section>

      <!-- Section: Psicológico -->
      <section v-show="activeSection === 5" class="px-4 space-y-4">
        <h2 class="font-semibold mb-4">🧠 Evaluación psicológica</h2>

        <ExamField label="Estado mental general">
          <PassFailToggle v-model="results.psychological.mentalStatus" />
        </ExamField>

        <ExamField label="Respuesta al estrés">
          <PassFailToggle v-model="results.psychological.stressResponse" />
        </ExamField>

        <ExamField label="Sustancias (alcohol / drogas)">
          <PassFailToggle v-model="results.psychological.substanceUse" />
        </ExamField>
      </section>

      <!-- Section: Resumen y observaciones -->
      <section v-show="activeSection === 6" class="px-4 space-y-4">
        <h2 class="font-semibold mb-4">📋 Resultado y observaciones</h2>

        <div class="bg-[#1a1f2e] rounded-2xl p-4 space-y-2">
          <ResultRow label="Visión" :result="results.vision.visualField" />
          <ResultRow label="Audición" :result="results.hearing.result" />
          <ResultRow label="Presión arterial" :result="results.bloodPressure.result" />
          <ResultRow label="Motor" :result="results.motor.coordination" />
          <ResultRow label="Psicológico" :result="results.psychological.mentalStatus" />
        </div>

        <ExamField label="Resultado general">
          <div class="flex gap-3">
            <button
              class="flex-1 py-3 rounded-xl font-semibold transition-colors"
              :class="results.overallResult === 'pass' ? 'bg-[#4ade80] text-[#0f1923]' : 'bg-[#1a1f2e] text-[#94a3b8]'"
              @click="results.overallResult = 'pass'"
            >✅ Apto</button>
            <button
              class="flex-1 py-3 rounded-xl font-semibold transition-colors"
              :class="results.overallResult === 'conditional' ? 'bg-[#fbbf24] text-[#0f1923]' : 'bg-[#1a1f2e] text-[#94a3b8]'"
              @click="results.overallResult = 'conditional'"
            >⚠️ Condicional</button>
            <button
              class="flex-1 py-3 rounded-xl font-semibold transition-colors"
              :class="results.overallResult === 'fail' ? 'bg-[#ef4444] text-white' : 'bg-[#1a1f2e] text-[#94a3b8]'"
              @click="results.overallResult = 'fail'"
            >❌ No apto</button>
          </div>
        </ExamField>

        <ExamField label="Observaciones del médico" hint="Opcional">
          <textarea
            v-model="results.observations"
            rows="4"
            placeholder="Notas adicionales, restricciones especiales, recomendaciones…"
            class="w-full bg-[#0f1923] border border-[#2a2f3e] rounded-xl px-4 py-3 text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-[#594FD3] resize-none"
          />
        </ExamField>
      </section>
    </div>

    <!-- Bottom nav -->
    <div class="fixed bottom-0 left-0 right-0 bg-[#0f1923] border-t border-[#1a1f2e] px-4 py-4 flex gap-3">
      <button
        v-if="activeSection > 0"
        class="flex-1 bg-[#1a1f2e] text-[#e2e8f0] rounded-2xl py-4 font-semibold"
        @click="activeSection--"
      >← Anterior</button>

      <button
        v-if="activeSection < sections.length - 1"
        class="flex-1 bg-[#594FD3] text-white rounded-2xl py-4 font-semibold"
        @click="nextSection"
      >Siguiente →</button>

      <button
        v-else
        class="flex-1 bg-[#4ade80] text-[#0f1923] rounded-2xl py-4 font-semibold"
        @click="saveAndPreview"
      >Revisar dictamen →</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useDictamenStore } from '../stores/dictamen.store'
import ExamField from '../components/ExamField.vue'
import PassFailToggle from '../components/PassFailToggle.vue'
import ResultRow from '../components/ResultRow.vue'
import { LICENSE_CATEGORY_LABELS, COLOR_VISION_REQUIRED } from '../types/dictamen'
import type { CRLicenseCategory, ExamResults } from '../types/dictamen'
import type { ModuleContext } from '@attestto/module-sdk'

const router = useRouter()
const route = useRoute()
const store = useDictamenStore()

const draftId = route.query.draft as string
const draft = computed(() => store.drafts.find((d) => d.draftId === draftId) ?? null)

const sections = ['Categorías', 'Visión', 'Audición', 'Presión', 'Motor', 'Psicológico', 'Resumen']
const activeSection = ref(0)

const selectedCategories = ref<CRLicenseCategory[]>(draft.value?.requestedCategories ?? ['B1'])

const results = reactive<ExamResults>({
  vision: { rightEye: '', leftEye: '', visualField: 'pass', colorVision: 'pass', requiresLenses: false, daytimeOnly: false },
  hearing: { result: 'pass', requiresHearingAid: false },
  bloodPressure: { systolic: 0, diastolic: 0, pulse: 0, result: 'pass' },
  motor: { coordination: 'pass', strength: 'pass', reflexes: 'pass', adaptations: [] },
  psychological: { mentalStatus: 'pass', stressResponse: 'pass', substanceUse: 'pass' },
  overallResult: 'pass',
  observations: '',
})

const adaptationsText = ref('')

const requiresColorVision = computed(() =>
  selectedCategories.value.some((c) => COLOR_VISION_REQUIRED.includes(c))
)

const bpClassification = computed(() => {
  const { systolic: s, diastolic: d } = results.bloodPressure
  if (!s || !d) return null
  if (s < 130 && d < 85) return 'normal'
  if (s < 140 || d < 90) return 'elevated'
  return 'high'
})

function toggleCategory(cat: CRLicenseCategory) {
  const idx = selectedCategories.value.indexOf(cat)
  if (idx >= 0) selectedCategories.value.splice(idx, 1)
  else selectedCategories.value.push(cat)
}

function nextSection() {
  if (adaptationsText.value) {
    results.motor.adaptations = adaptationsText.value.split(',').map((s) => s.trim()).filter(Boolean)
  }
  store.updateDraftCategories(draftId, selectedCategories.value)
  store.updateDraftExamResults(draftId, { ...results })
  activeSection.value++
}

function saveAndPreview() {
  if (adaptationsText.value) {
    results.motor.adaptations = adaptationsText.value.split(',').map((s) => s.trim()).filter(Boolean)
  }
  store.updateDraftExamResults(draftId, { ...results })
  store.approveDraft(draftId, selectedCategories.value, [])
  router.push(`/cr-medical/vista-previa/${draftId}`)
}
</script>
