<template>
  <q-page padding>
    <q-stepper v-model="step" vertical animated color="primary">

      <!-- Step 1: Select document type -->
      <q-step :name="1" title="Tipo de documento" icon="description" :done="step > 1">
        <div class="text-body2 q-mb-md">Selecciona el documento que deseas escanear:</div>
        <div class="row q-gutter-md">
          <div v-for="dt in documentTypes" :key="dt.value" class="col-12 col-sm-4">
            <q-card
              class="cursor-pointer"
              :class="selectedType === dt.value ? 'bg-primary text-white' : 'bg-card'"
              @click="selectedType = dt.value"
            >
              <q-card-section class="text-center">
                <q-icon :name="dt.icon" size="40px" />
                <div class="text-subtitle2 q-mt-sm">{{ dt.label }}</div>
              </q-card-section>
            </q-card>
          </div>
        </div>
        <q-stepper-navigation>
          <q-btn color="primary" label="Continuar" :disable="!selectedType" @click="step = 2" />
        </q-stepper-navigation>
      </q-step>

      <!-- Step 2: Capture images -->
      <q-step :name="2" title="Capturar imagen" icon="photo_camera" :done="step > 2">
        <div class="text-body2 q-mb-md">
          {{ selectedType === 'pasaporte' ? 'Captura la pagina de datos del pasaporte.' : 'Captura el frente y reverso del documento.' }}
        </div>

        <!-- Front capture -->
        <div class="q-mb-md">
          <div class="text-caption q-mb-xs">{{ selectedType === 'pasaporte' ? 'Pagina de datos' : 'Frente' }}</div>
          <q-btn
            v-if="!frontImage"
            outline color="primary" icon="add_a_photo"
            :label="'Capturar ' + (selectedType === 'pasaporte' ? 'pagina' : 'frente')"
            @click="selectImage('front')"
          />
          <div v-else class="relative-position" style="max-width: 300px">
            <img :src="frontImage" class="rounded-borders full-width" />
            <q-btn round flat icon="close" size="sm" class="absolute-top-right" @click="frontImage = null" />
          </div>
        </div>

        <!-- Back capture (not for passport) -->
        <div v-if="selectedType !== 'pasaporte'" class="q-mb-md">
          <div class="text-caption q-mb-xs">Reverso</div>
          <q-btn
            v-if="!backImage"
            outline color="primary" icon="add_a_photo"
            label="Capturar reverso"
            @click="selectImage('back')"
          />
          <div v-else class="relative-position" style="max-width: 300px">
            <img :src="backImage" class="rounded-borders full-width" />
            <q-btn round flat icon="close" size="sm" class="absolute-top-right" @click="backImage = null" />
          </div>
        </div>

        <input ref="fileInput" type="file" accept="image/*" capture="environment" class="hidden" @change="onFileSelected" />

        <q-stepper-navigation>
          <q-btn color="primary" label="Procesar" :disable="!canProcess" @click="processImages" />
          <q-btn flat label="Atras" @click="step = 1" />
        </q-stepper-navigation>
      </q-step>

      <!-- Step 3: OCR processing -->
      <q-step :name="3" title="Procesando" icon="settings" :done="step > 3">
        <div class="text-center q-pa-lg">
          <q-spinner-gears size="48px" color="primary" />
          <div class="text-body2 q-mt-md">Extrayendo datos del documento...</div>
          <q-linear-progress :value="ocrProgress / 100" class="q-mt-md" color="primary" />
          <div class="text-caption q-mt-sm">{{ ocrProgress }}%</div>
        </div>
      </q-step>

      <!-- Step 4: Review extracted fields -->
      <q-step :name="4" title="Revisar datos" icon="edit" :done="step > 4">
        <div class="text-body2 q-mb-md">
          Revisa los datos extraidos. Puedes corregir cualquier error antes de firmar.
        </div>

        <q-banner v-if="ocrConfidence < 70" class="bg-warning text-dark q-mb-md rounded-borders">
          <template #avatar><q-icon name="warning" /></template>
          Confianza del OCR baja ({{ ocrConfidence }}%). Verifica todos los campos.
        </q-banner>

        <!-- Cedula fields -->
        <template v-if="selectedType === 'cedula'">
          <q-input v-model="fields.cedula" label="Numero de cedula" class="q-mb-sm" />
          <q-input v-model="fields.nombre" label="Nombre" class="q-mb-sm" />
          <q-input v-model="fields.apellido1" label="Primer apellido" class="q-mb-sm" />
          <q-input v-model="fields.apellido2" label="Segundo apellido" class="q-mb-sm" />
          <q-input v-model="fields.fechaNacimiento" label="Fecha de nacimiento" class="q-mb-sm" />
          <q-input v-model="fields.fechaVencimiento" label="Fecha de vencimiento" class="q-mb-sm" />
          <q-input v-model="fields.nacionalidad" label="Nacionalidad" class="q-mb-sm" />
          <q-input v-model="fields.sexo" label="Sexo" class="q-mb-sm" />
        </template>

        <!-- License fields -->
        <template v-if="selectedType === 'licencia'">
          <q-input v-model="fields.cedula" label="Numero de cedula" class="q-mb-sm" />
          <q-input v-model="fields.nombre" label="Nombre completo" class="q-mb-sm" />
          <q-input v-model="fields.fechaNacimiento" label="Fecha de nacimiento" class="q-mb-sm" />
          <q-input v-model="fields.fechaVencimiento" label="Fecha de vencimiento" class="q-mb-sm" />
          <div class="text-subtitle2 q-mt-md q-mb-sm">Categorias</div>
          <q-select
            v-model="licenseCategories"
            multiple
            :options="allCategories"
            label="Categorias de licencia"
            class="q-mb-sm"
            use-chips
          />
          <q-input v-model="fields.bloodType" label="Tipo de sangre (opcional)" class="q-mb-sm" />
        </template>

        <!-- Passport fields -->
        <template v-if="selectedType === 'pasaporte'">
          <q-input v-model="fields.documentNumber" label="Numero de pasaporte" class="q-mb-sm" />
          <q-input v-model="fields.surname" label="Apellidos" class="q-mb-sm" />
          <q-input v-model="fields.givenNames" label="Nombres" class="q-mb-sm" />
          <q-input v-model="fields.nationality" label="Nacionalidad" class="q-mb-sm" />
          <q-input v-model="fields.dateOfBirth" label="Fecha de nacimiento" class="q-mb-sm" />
          <q-input v-model="fields.dateOfExpiry" label="Fecha de vencimiento" class="q-mb-sm" />
          <q-input v-model="fields.sex" label="Sexo" class="q-mb-sm" />
          <q-input v-model="fields.issuingCountry" label="Pais emisor" class="q-mb-sm" />
        </template>

        <q-stepper-navigation>
          <q-btn color="primary" label="Firmar y guardar" @click="signAndStore" />
          <q-btn flat label="Atras" @click="step = 2" />
        </q-stepper-navigation>
      </q-step>

      <!-- Step 5: Success -->
      <q-step :name="5" title="Listo" icon="check_circle">
        <div class="text-center q-pa-lg">
          <q-icon name="verified" size="64px" color="positive" />
          <div class="text-h6 q-mt-md">Credencial creada</div>
          <div class="text-body2 q-mt-sm text-grey-5">
            Tu {{ DOCUMENT_TYPE_LABELS[selectedType!] }} ha sido firmada y guardada en tu vault.
          </div>
        </div>
        <q-stepper-navigation>
          <q-btn color="primary" label="Ver mis credenciales" @click="$router.push('/module/cr-identity/cr-identity/credenciales')" />
          <q-btn flat label="Escanear otro" @click="reset" />
        </q-stepper-navigation>
      </q-step>
    </q-stepper>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { DocumentType } from '../types/identity'
import { DOCUMENT_TYPE_LABELS, LICENSE_CATEGORY_CODES } from '../types/identity'

const step = ref(1)
const selectedType = ref<DocumentType | null>(null)
const frontImage = ref<string | null>(null)
const backImage = ref<string | null>(null)
const ocrProgress = ref(0)
const ocrConfidence = ref(100)
const fields = ref<Record<string, string>>({})
const licenseCategories = ref<string[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
let pendingSide: 'front' | 'back' = 'front'

const documentTypes = [
  { value: 'cedula' as DocumentType, label: 'Cedula', icon: 'badge' },
  { value: 'licencia' as DocumentType, label: 'Licencia', icon: 'directions_car' },
  { value: 'pasaporte' as DocumentType, label: 'Pasaporte', icon: 'flight' },
]

const allCategories = LICENSE_CATEGORY_CODES.map(c => c)

const canProcess = computed(() => {
  if (!selectedType.value) return false
  if (selectedType.value === 'pasaporte') return !!frontImage.value
  return !!frontImage.value && !!backImage.value
})

function selectImage(side: 'front' | 'back') {
  pendingSide = side
  fileInput.value?.click()
}

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    const dataUrl = reader.result as string
    if (pendingSide === 'front') {
      frontImage.value = dataUrl
    } else {
      backImage.value = dataUrl
    }
  }
  reader.readAsDataURL(file)
  input.value = ''
}

async function processImages() {
  step.value = 3
  ocrProgress.value = 0

  // Import OCR dynamically to avoid loading tesseract.js until needed
  try {
    if (selectedType.value === 'pasaporte') {
      const { extractPassportMRZ } = await import('../composables/usePassportMrz')
      const result = await extractPassportMRZ(frontImage.value!, (p) => { ocrProgress.value = p })
      ocrConfidence.value = result.confidence
      fields.value = {
        documentNumber: result.documentNumber,
        surname: result.surname,
        givenNames: result.givenNames,
        nationality: result.nationality,
        dateOfBirth: result.dateOfBirth,
        dateOfExpiry: result.dateOfExpiry,
        sex: result.sex,
        issuingCountry: result.issuingCountry,
      }
    } else {
      const { extractCedulaMRZ, extractFromFront } = await import('../composables/useMrzOcr')
      let result = await extractCedulaMRZ(backImage.value!, (p) => { ocrProgress.value = p })
      if (!result.success && frontImage.value) {
        result = await extractFromFront(frontImage.value, (p) => { ocrProgress.value = p }, backImage.value)
      }
      ocrConfidence.value = result.confidence
      fields.value = {
        cedula: result.cedula,
        nombre: result.nombre,
        apellido1: result.apellido1,
        apellido2: result.apellido2,
        fechaNacimiento: result.fechaNacimiento,
        fechaVencimiento: result.fechaVencimiento,
        nacionalidad: result.nacionalidad,
        sexo: result.sexo,
      }

      // For license: also try to extract categories from front
      if (selectedType.value === 'licencia' && frontImage.value) {
        try {
          const { extractLicenseCategories } = await import('../composables/useLicenseMrz')
          const cats = await extractLicenseCategories(frontImage.value)
          licenseCategories.value = cats.map(c => c.code)
        } catch {
          // Manual input fallback
        }
      }
    }

    step.value = 4
  } catch (err) {
    console.error('[cr-identity] OCR failed:', err)
    // Fall through to step 4 with empty fields for manual input
    step.value = 4
  }
}

async function signAndStore() {
  try {
    const { signAndStoreVC, buildCedulaVC, buildDrivingLicenseVC, buildPassportVC } = await import('../composables/useCredentialBuilder')

    const evidence = {
      type: 'SelfAttestation' as const,
      method: 'document-scan' as const,
      ocrConfidence: ocrConfidence.value,
      scannedAt: new Date().toISOString(),
    }

    let vc

    if (selectedType.value === 'cedula') {
      vc = buildCedulaVC({
        cedula: fields.value.cedula || '',
        fullName: `${fields.value.nombre || ''} ${fields.value.apellido1 || ''} ${fields.value.apellido2 || ''}`.trim(),
        apellido1: fields.value.apellido1 || '',
        apellido2: fields.value.apellido2 || '',
        nombre: fields.value.nombre || '',
        dateOfBirth: fields.value.fechaNacimiento || '',
        dateOfExpiry: fields.value.fechaVencimiento || '',
        nationality: fields.value.nacionalidad || 'CRI',
        sex: fields.value.sexo || '',
      }, evidence)
    } else if (selectedType.value === 'licencia') {
      vc = buildDrivingLicenseVC({
        cedula: fields.value.cedula || '',
        fullName: `${fields.value.nombre || ''} ${fields.value.apellido1 || ''} ${fields.value.apellido2 || ''}`.trim(),
        dateOfBirth: fields.value.fechaNacimiento || '',
        dateOfExpiry: fields.value.fechaVencimiento || '',
        categories: licenseCategories.value.map(c => ({ code: c, from: '', to: '' })),
        points: 0,
        status: 'active',
        restrictions: [],
        bloodType: fields.value.bloodType,
      }, evidence)
    } else {
      vc = buildPassportVC({
        documentNumber: fields.value.documentNumber || '',
        surname: fields.value.surname || '',
        givenNames: fields.value.givenNames || '',
        nationality: fields.value.nationality || '',
        dateOfBirth: fields.value.dateOfBirth || '',
        sex: fields.value.sex || '',
        dateOfExpiry: fields.value.dateOfExpiry || '',
        issuingCountry: fields.value.issuingCountry || '',
      }, evidence)
    }

    await signAndStoreVC(vc)
    step.value = 5
  } catch (err) {
    console.error('[cr-identity] Sign failed:', err)
  }
}

function reset() {
  step.value = 1
  selectedType.value = null
  frontImage.value = null
  backImage.value = null
  ocrProgress.value = 0
  ocrConfidence.value = 100
  fields.value = {}
  licenseCategories.value = []
}
</script>
