import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { VerifiableCredential } from '@attestto/module-sdk'
import * as crypto from '@/composables/useCrypto'
import {
  saveEncryptedVault,
  loadEncryptedVault,
  migrateFromLocalStorage,
} from '@/composables/useEncryptedVault'

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

    // Load credentials from encrypted vault (empty wallet on first use)
    const stored = await loadEncryptedVault<VerifiableCredential[]>(seed)
    credentials.value = stored ?? []

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
