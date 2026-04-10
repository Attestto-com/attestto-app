import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { VerifiableCredential } from '@attestto/module-sdk'

export const useVaultStore = defineStore('vault', () => {
  const unlocked = ref(false)
  const did = ref<string | null>(null)
  const displayName = ref<string | null>(null)
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

  async function unlock(pin?: string): Promise<boolean> {
    // TODO: real passkey/biometric/PIN verification
    unlocked.value = true
    did.value = 'did:sns:eduardo.sol'
    displayName.value = 'Eduardo Chongkan'

    // TODO: load credentials from encrypted IndexedDB
    credentials.value = []
    return true
  }

  function lock() {
    unlocked.value = false
  }

  function addCredential(vc: VerifiableCredential) {
    credentials.value.push(vc)
  }

  function removeCredential(id: string) {
    credentials.value = credentials.value.filter((vc) => vc.id !== id)
  }

  return {
    unlocked,
    did,
    displayName,
    credentials,
    credentialTypes,
    credentialsByCountry,
    unlock,
    lock,
    addCredential,
    removeCredential,
  }
})
