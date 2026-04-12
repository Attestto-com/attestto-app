<template>
  <q-page padding>
    <q-btn flat icon="arrow_back" label="Volver" @click="$router.back()" class="q-mb-md" />

    <div class="text-h5 q-mb-md">Nueva Credencial de Identidad</div>

    <q-stepper v-model="step" vertical animated>
      <!-- Step 1: Citizen Data -->
      <q-step :name="1" title="Datos del ciudadano" icon="person" :done="step > 1">
        <div class="q-gutter-md">
          <q-input v-model="citizen.did" label="DID del ciudadano" hint="did:sns:nombre.attestto.sol" outlined dense />

          <q-select v-model="citizen.nationalId.type" :options="idTypeOptions" label="Tipo de documento" outlined dense emit-value map-options />
          <q-input v-model="citizen.nationalId.number" label="Numero de documento" outlined dense :rules="[cedulaRule]" />
          <q-input v-model="citizen.nationalId.country" label="Pais de emision" outlined dense maxlength="2" hint="ISO 3166-1 (ej: CR)" />

          <q-input v-model="citizen.fullName" label="Nombre completo" outlined dense />
          <q-input v-model="citizen.dateOfBirth" label="Fecha de nacimiento" type="date" outlined dense />
          <q-input v-model="citizen.nationality" label="Nacionalidad" outlined dense maxlength="2" hint="ISO 3166-1 (ej: CR)" />

          <q-select v-model="citizen.maritalStatus" :options="maritalOptions" label="Estado civil (opcional)" outlined dense emit-value map-options clearable />

          <q-input v-model="citizen.photoHash" label="Hash de foto (SHA-256)" outlined dense hint="sha256:... — generado al capturar foto" />
        </div>

        <q-stepper-navigation>
          <q-btn color="primary" label="Siguiente" @click="step = 2" :disable="!step1Valid" />
        </q-stepper-navigation>
      </q-step>

      <!-- Step 2: Evidence -->
      <q-step :name="2" title="Verificacion de evidencia" icon="fact_check" :done="step > 2">
        <div class="q-gutter-md">
          <q-select v-model="evidence.method" :options="methodOptions" label="Metodo de verificacion" outlined dense emit-value map-options />

          <div class="text-subtitle2 q-mt-md">Documentos verificados</div>
          <q-option-group
            v-model="evidence.documentsChecked"
            :options="documentOptions"
            type="checkbox"
          />

          <q-toggle v-model="evidence.biometricMatch" label="Coincidencia biometrica confirmada" />
        </div>

        <q-stepper-navigation>
          <q-btn color="primary" label="Siguiente" @click="step = 3" :disable="evidence.documentsChecked.length === 0" />
          <q-btn flat label="Atras" @click="step = 1" class="q-ml-sm" />
        </q-stepper-navigation>
      </q-step>

      <!-- Step 3: Organization Roles (optional) -->
      <q-step :name="3" title="Roles empresariales (opcional)" icon="business" :done="step > 3">
        <div v-for="(role, idx) in orgRoles" :key="idx" class="q-mb-md q-pa-md" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;">
          <div class="row q-gutter-sm">
            <q-input v-model="role.organization.legalName" label="Nombre de empresa" outlined dense class="col" />
            <q-input v-model="role.organization.taxId" label="Cedula juridica" outlined dense class="col-4" />
          </div>
          <div class="row q-gutter-sm q-mt-sm">
            <q-select v-model="role.role" :options="roleOptions" label="Rol" outlined dense emit-value map-options class="col" />
            <q-input v-model.number="role.ownershipPercentage" label="% propiedad" type="number" outlined dense class="col-3" />
          </div>
          <div class="row q-gutter-sm q-mt-sm">
            <q-input v-model="role.position" label="Cargo (ej: Presidente)" outlined dense class="col" />
            <q-select v-if="role.role === 'legal_representative' || role.role === 'apoderado'" v-model="role.poderType" :options="poderOptions" label="Tipo de poder" outlined dense emit-value map-options class="col" />
          </div>
          <q-btn flat dense icon="delete" color="negative" @click="orgRoles.splice(idx, 1)" class="q-mt-sm" />
        </div>

        <q-btn flat icon="add" label="Agregar rol" @click="addOrgRole" />

        <q-stepper-navigation>
          <q-btn color="primary" label="Revisar" @click="step = 4" />
          <q-btn flat label="Atras" @click="step = 2" class="q-ml-sm" />
        </q-stepper-navigation>
      </q-step>

      <!-- Step 4: Review -->
      <q-step :name="4" title="Revision y firma" icon="verified">
        <citizen-data-card :citizen="citizen" />

        <div class="q-mt-md">
          <evidence-checklist :evidence="[buildEvidence()]" />
        </div>

        <div v-if="orgRoles.length > 0" class="q-mt-md">
          <div class="text-subtitle2 q-mb-sm">Roles empresariales</div>
          <org-role-card v-for="(role, idx) in orgRoles" :key="idx" :role="role" />
        </div>

        <notarial-badge :notary="notary" class="q-mt-md" />

        <q-stepper-navigation>
          <q-btn color="primary" label="Guardar borrador" @click="saveDraft" />
          <q-btn flat label="Atras" @click="step = 3" class="q-ml-sm" />
        </q-stepper-navigation>
      </q-step>
    </q-stepper>
  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import type { CitizenData, OrganizationRole, VerificationMethod, DocumentChecked, MaritalStatus, NationalIdType, OrgRoleType, PoderType } from '../types/identity'
import { NATIONAL_ID_LABELS, MARITAL_STATUS_LABELS, VERIFICATION_METHOD_LABELS, DOCUMENT_CHECKED_LABELS, ORG_ROLE_LABELS, PODER_TYPE_LABELS } from '../types/identity'
import { useIdentityStore } from '../stores/identity.store'
import CitizenDataCard from '../components/CitizenDataCard.vue'
import EvidenceChecklist from '../components/EvidenceChecklist.vue'
import OrgRoleCard from '../components/OrgRoleCard.vue'
import NotarialBadge from '../components/NotarialBadge.vue'

const router = useRouter()
const store = useIdentityStore()
const step = ref(1)

const citizen = reactive<CitizenData>({
  did: '',
  nationalId: { type: 'cedula', number: '', country: 'CR' },
  fullName: '',
  dateOfBirth: '',
  nationality: 'CR',
  maritalStatus: undefined,
  photoHash: '',
})

const evidence = reactive({
  method: 'in-person' as VerificationMethod,
  documentsChecked: [] as DocumentChecked[],
  biometricMatch: false,
})

const notary = reactive({
  did: '',
  name: '',
  carneNumber: '',
  colegioId: '',
  protocolNumber: '',
  jurisdiction: 'CR',
})

const orgRoles = reactive<OrganizationRole[]>([])

// Load notary data from vault (in a real app, from the ColegioAbogadosCRVC)
// For now, user fills in the form header on first use

const idTypeOptions = Object.entries(NATIONAL_ID_LABELS).map(([value, label]) => ({ value, label }))
const maritalOptions = Object.entries(MARITAL_STATUS_LABELS).map(([value, label]) => ({ value, label }))
const methodOptions = Object.entries(VERIFICATION_METHOD_LABELS).map(([value, label]) => ({ value, label }))
const documentOptions = Object.entries(DOCUMENT_CHECKED_LABELS).map(([value, label]) => ({ value, label }))
const roleOptions = Object.entries(ORG_ROLE_LABELS).map(([value, label]) => ({ value, label }))
const poderOptions = Object.entries(PODER_TYPE_LABELS).map(([value, label]) => ({ value, label }))

const step1Valid = computed(() =>
  citizen.did && citizen.nationalId.number && citizen.fullName && citizen.dateOfBirth && citizen.photoHash,
)

function cedulaRule(val: string): boolean | string {
  if (!val) return 'Requerido'
  if (citizen.nationalId.type === 'cedula' && !/^\d{1}-\d{4}-\d{4}$/.test(val)) {
    return 'Formato: 1-0000-0000'
  }
  return true
}

function addOrgRole(): void {
  orgRoles.push({
    organization: { legalName: '', taxId: '', jurisdiction: 'CR' },
    role: 'director',
    ownershipPercentage: undefined,
    position: '',
  })
}

function buildEvidence() {
  return {
    type: 'NotarialVerification' as const,
    method: evidence.method,
    documentsChecked: evidence.documentsChecked,
    biometricMatch: evidence.biometricMatch,
    verifiedAt: new Date().toISOString(),
  }
}

function saveDraft(): void {
  const draftId = crypto.randomUUID()
  store.addDraft({
    draftId,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    citizen: { ...citizen },
    notary: { ...notary },
    evidence: [buildEvidence()],
    organizationRoles: [...orgRoles],
  })
  router.push(`/module/cr-identity/cr-identity/revision/${draftId}`)
}
</script>
