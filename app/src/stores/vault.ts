import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { VerifiableCredential } from '@attestto/module-sdk'
import * as crypto from '@/composables/useCrypto'

function seedDemoCredentials(): VerifiableCredential[] {
  return [
    {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'CedulaIdentidadCR'],
      id: 'urn:uuid:cedula-demo-001',
      issuer: { id: 'did:sns:tse.sol', name: 'TSE Costa Rica' },
      issuanceDate: '2024-06-15T00:00:00Z',
      expirationDate: '2034-06-15T00:00:00Z',
      credentialSubject: {
        id: 'did:sns:eduardo.sol',
        nombre: 'Eduardo',
        apellidos: 'Chongkan',
        cedula: '•••••••0501',
        nacionalidad: 'costarricense',
      },
      jurisdiction: 'CR',
      revocationStatus: 'valid',
    },
    {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'DictamenMedicoCR'],
      id: 'urn:uuid:dictamen-demo-001',
      issuer: { id: 'did:sns:dr-rodriguez.sol', name: 'Dr. Rodriguez' },
      issuanceDate: '2026-03-01T00:00:00Z',
      expirationDate: '2026-10-15T00:00:00Z',
      credentialSubject: {
        id: 'did:sns:eduardo.sol',
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
        id: 'did:sns:eduardo.sol',
        documentNumber: '•••••8921',
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

    unlocked.value = true
    did.value = crypto.getDID()
    displayName.value = crypto.getDisplayName()
    publicKey.value = crypto.getPublicKeyBase64url()

    // Load credentials from storage or seed demo data
    const stored = localStorage.getItem('attestto:vault:credentials')
    if (stored) {
      credentials.value = JSON.parse(stored)
    } else {
      credentials.value = seedDemoCredentials()
      persistCredentials()
    }
    return true
  }

  function persistCredentials() {
    localStorage.setItem('attestto:vault:credentials', JSON.stringify(credentials.value))
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

  function addCredential(vc: VerifiableCredential) {
    credentials.value.push(vc)
    persistCredentials()
  }

  function removeCredential(id: string) {
    credentials.value = credentials.value.filter((vc) => vc.id !== id)
    persistCredentials()
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
