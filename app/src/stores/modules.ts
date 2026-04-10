import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  type AttesttoModule,
  type ModuleManifest,
  type ModuleContext,
  checkCredentialGate,
} from '@attestto/module-sdk'
import { useVaultStore } from './vault'
import { useInboxStore } from './inbox'
import { router } from '@/router'

export const useModulesStore = defineStore('modules', () => {
  const installed = ref<Map<string, AttesttoModule>>(new Map())
  const available = ref<ModuleManifest[]>([])

  const installedList = computed(() =>
    Array.from(installed.value.values()).map((m) => m.manifest),
  )

  const availableForUser = computed(() => {
    const vault = useVaultStore()
    return available.value.map((manifest) => ({
      manifest,
      gate: checkCredentialGate(manifest, vault.credentialTypes),
    }))
  })

  function createContext(moduleId: string): ModuleContext {
    const vault = useVaultStore()
    const inbox = useInboxStore()

    return {
      getCredentials: async (types) =>
        vault.credentials.filter((vc) =>
          vc.type.some((t) => types.includes(t)),
        ),
      storeCredential: async (vc) => vault.addCredential(vc),
      pushInboxItem: (item) => inbox.push({ ...item, moduleId }),
      requestBiometric: async (reason) => {
        // TODO: real biometric prompt
        return confirm(reason)
      },
      navigate: (path) => router.push(path),
      storage: {
        get: async <T = unknown>(key: string) => {
          const raw = localStorage.getItem(`mod:${moduleId}:${key}`)
          return raw ? (JSON.parse(raw) as T) : null
        },
        set: async (key, value) => {
          localStorage.setItem(`mod:${moduleId}:${key}`, JSON.stringify(value))
        },
        remove: async (key) => {
          localStorage.removeItem(`mod:${moduleId}:${key}`)
        },
      },
    }
  }

  async function installModule(mod: AttesttoModule) {
    const vault = useVaultStore()
    const gate = checkCredentialGate(mod.manifest, vault.credentialTypes)
    if (!gate.allowed) {
      throw new Error(`Missing credentials: ${gate.missing.join(', ')}`)
    }

    const ctx = createContext(mod.manifest.id)
    await mod.install(ctx)

    // Register module routes
    for (const route of mod.manifest.routes) {
      router.addRoute({
        path: `/module/${mod.manifest.id}${route.path}`,
        name: `module-${mod.manifest.id}-${route.name}`,
        component: route.component,
        meta: { requiresAuth: true, moduleId: mod.manifest.id },
      })
    }

    installed.value.set(mod.manifest.id, mod)
  }

  function uninstallModule(moduleId: string) {
    const mod = installed.value.get(moduleId)
    if (mod?.uninstall) mod.uninstall()
    installed.value.delete(moduleId)
  }

  return {
    installed,
    available,
    installedList,
    availableForUser,
    installModule,
    uninstallModule,
  }
})
