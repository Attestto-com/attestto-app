import { watch } from 'vue'
import { useVaultStore } from '@/stores/vault'
import { useModulesStore } from '@/stores/modules'
import type { AttesttoModule } from '@attestto/module-sdk'

/**
 * Loads bundled modules when the vault unlocks.
 * In production, modules would be fetched from a registry.
 * For now, bundled modules are imported statically.
 */
export async function bootstrapModules() {
  const vault = useVaultStore()
  const modules = useModulesStore()

  // Load bundled module manifests into the available list
  const bundled = await loadBundledModules()

  for (const mod of bundled) {
    modules.available.push(mod.manifest)
  }

  // Auto-install modules whose credential gates are satisfied
  watch(
    () => vault.unlocked,
    async (isUnlocked) => {
      if (!isUnlocked) return

      for (const mod of bundled) {
        if (modules.installed.has(mod.manifest.id)) continue
        try {
          await modules.installModule(mod)
        } catch {
          // Gate not satisfied — skip silently
        }
      }
    },
    { immediate: true },
  )
}

async function loadBundledModules(): Promise<AttesttoModule[]> {
  const mods: AttesttoModule[] = []

  try {
    const crDriving = await import('app-module-cr-driving')
    mods.push(crDriving.default)
  } catch {
    // Module not available
  }

  try {
    const crMedical = await import('app-module-cr-medical')
    mods.push(crMedical.default)
  } catch {
    // Module not available
  }

  return mods
}
