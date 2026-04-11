import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { VerifiableCredential } from '@attestto/module-sdk'
import * as crypto from '@/composables/useCrypto'
import {
  saveEncryptedVault,
  loadEncryptedVault,
  migrateFromLocalStorage,
} from '@/composables/useEncryptedVault'

function seedDemoCredentials(): VerifiableCredential[] {
  return [
    {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'CedulaIdentidadCR'],
      id: 'urn:uuid:cedula-demo-001',
      issuer: { id: 'did:web:tse.attestto.id', name: 'TSE Costa Rica' },
      issuanceDate: '2024-06-15T00:00:00Z',
      expirationDate: '2034-06-15T00:00:00Z',
      credentialSubject: {
        id: 'did:web:demo.attestto.id',
        nombre: 'Maria',
        apellidos: 'Ejemplo',
        cedula: '•••••••0000',
        nacionalidad: 'costarricense',
      },
      jurisdiction: 'CR',
      revocationStatus: 'valid',
    },
    {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'DictamenMedicoCR'],
      id: 'urn:uuid:dictamen-demo-001',
      issuer: { id: 'did:web:medicos.attestto.id', name: 'Dra. Ana Lopez' },
      issuanceDate: '2026-03-01T00:00:00Z',
      expirationDate: '2026-10-15T00:00:00Z',
      credentialSubject: {
        id: 'did:web:demo.attestto.id',
        resultado: 'apto',
        categorias: ['B1'],
      },
      jurisdiction: 'CR',
      revocationStatus: 'valid',
    },
    {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'PassportUS'],
      id: 'urn:uuid:passport-demo-001',
      issuer: { id: 'did:web:state.gov', name: 'US Department of State' },
      issuanceDate: '2021-08-22T00:00:00Z',
      expirationDate: '2031-08-22T00:00:00Z',
      credentialSubject: {
        id: 'did:web:demo.attestto.id',
        documentNumber: '•••••0000',
      },
      jurisdiction: 'US',
      revocationStatus: 'valid',
    },
  ]
}

export const useVaultStore = defineStore('vault', () => {
  const unlocked = ref(false)
  const did = ref<string | null>(null)
  const displayName = ref<string | null>(null)
  const publicKey = ref<string | null>(null)
  const credentials = ref<VerifiableCredential[]>([])

  const credentialTypes = computed(() =>
    credentials.value.flatMap((vc) => vc.type),
  )

  const credentialsByCountry = computed(() => {
    const grouped = new Map<string, VerifiableCredential[]>()
    for (const vc of credentials.value) {
      const country = vc.jurisdiction ?? 'universal'
      const list = grouped.get(country) ?? []
      list.push(vc)
      grouped.set(country, list)
    }
    return grouped
  })

  async function unlock(): Promise<boolean> {
    if (crypto.isRegistered()) {
      await crypto.authenticate()
    } else {
      await crypto.register('Attestto User')
    }

    did.value = crypto.getDID()
    displayName.value = crypto.getDisplayName()
    publicKey.value = crypto.getPublicKeyBase64url()

    const seed = crypto.getKeySeed()

    // Migrate from localStorage to encrypted vault (one-time upgrade)
    await migrateFromLocalStorage(seed)

    // Load credentials from encrypted vault or seed demo data
    const stored = await loadEncryptedVault<VerifiableCredential[]>(seed)
    if (stored) {
      credentials.value = stored
    } else {
      credentials.value = seedDemoCredentials()
      await persistCredentials()
    }

    // Set unlocked AFTER credentials are loaded so module bootstrap
    // watchers see credentials when the gate check runs
    unlocked.value = true
    return true
  }

  async function persistCredentials() {
    const seed = crypto.getKeySeed()
    await saveEncryptedVault(credentials.value, seed)
  }

  function lock() {
    unlocked.value = false
    crypto.clearSession()
  }

  async function sign(payload: string): Promise<{ signature: string; verificationMethod: string }> {
    if (!crypto.isAuthenticated()) throw new Error('Vault locked')
    const data = new TextEncoder().encode(payload)
    const sig = crypto.sign(data)
    return {
      signature: crypto.toBase64url(sig),
      verificationMethod: crypto.getVerificationMethod(),
    }
  }

  async function addCredential(vc: VerifiableCredential) {
    credentials.value.push(vc)
    await persistCredentials()
  }

  async function removeCredential(id: string) {
    credentials.value = credentials.value.filter((vc) => vc.id !== id)
    await persistCredentials()
  }

  return {
    unlocked,
    did,
    displayName,
    publicKey,
    credentials,
    credentialTypes,
    credentialsByCountry,
    unlock,
    lock,
    sign,
    addCredential,
    removeCredential,
  }
})
