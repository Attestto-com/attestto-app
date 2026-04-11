/**
 * @attestto/module-sdk — useModuleContext
 * Modules call this composable to access the injected ModuleContext.
 * The shell provides the context via Vue's provide/inject.
 */

import { inject } from 'vue'
import type { ModuleContext } from '../index'

export const MODULE_CONTEXT_KEY = Symbol('attestto:module-context')

/**
 * Returns the ModuleContext injected by the shell.
 * Must be called inside a Vue component or composable setup().
 * Throws if called outside a module that the shell has mounted.
 */
export function useModuleContext(): ModuleContext {
  const ctx = inject<ModuleContext>(MODULE_CONTEXT_KEY)
  if (!ctx) {
    throw new Error(
      '[attestto/module-sdk] useModuleContext() called outside an Attestto module context. ' +
      'Ensure the shell has mounted this module correctly.'
    )
  }
  return ctx
}

/**
 * Convenience — returns credential and storage methods from context.
 */
export function useVault() {
  const ctx = useModuleContext()
  return {
    getCredentials: ctx.getCredentials,
    storeCredential: ctx.storeCredential,
    requestBiometric: ctx.requestBiometric,
  }
}
