import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'

// ── Mock idb-keyval ──────────────────────────────────
const mockStore = new Map<string, unknown>()
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(mockStore.get(key))),
  set: vi.fn((key: string, value: unknown) => {
    mockStore.set(key, value)
    return Promise.resolve()
  }),
  del: vi.fn((key: string) => {
    mockStore.delete(key)
    return Promise.resolve()
  }),
}))

// ── Mock useCrypto ───────────────────────────────────
const fakeSeed = new Uint8Array(32).fill(42)
let registered = false
let authenticated = false

const mockRegister = vi.fn(async () => {
  registered = true
  authenticated = true
})
const mockAuthenticate = vi.fn(async () => {
  authenticated = true
})
const mockDestroyIdentity = vi.fn(async () => {
  registered = false
  authenticated = false
  localStorage.removeItem('attestto:webauthn:credentialId')
})
const mockClearSession = vi.fn(() => {
  authenticated = false
})

vi.mock('@/composables/useCrypto', () => ({
  isRegistered: () => registered,
  isAuthenticated: () => authenticated,
  register: (...args: unknown[]) => mockRegister(...args),
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  getDID: () => 'did:web:test.attestto.id',
  getDisplayName: () => 'Test User',
  getPublicKeyBase64url: () => 'dGVzdC1wdWJrZXk',
  getKeySeed: () => fakeSeed,
  getVerificationMethod: () => 'did:web:test.attestto.id#key-1',
  sign: vi.fn(() => new Uint8Array([1, 2, 3])),
  toBase64url: (bytes: Uint8Array) => {
    let binary = ''
    for (const b of bytes) binary += String.fromCharCode(b)
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  },
  clearSession: (...args: unknown[]) => mockClearSession(...args),
  destroyIdentity: (...args: unknown[]) => mockDestroyIdentity(...args),
}))

// ── Mock vue-router ──────────────────────────────────
const mockReplace = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
  }),
}))

// ── Polyfill localStorage ────────────────────────────
if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage.clear) {
  const store: Record<string, string> = {}
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => { store[key] = val },
      removeItem: (key: string) => { delete store[key] },
      clear: () => { for (const k of Object.keys(store)) delete store[k] },
    },
    writable: true,
  })
}

// ── Import component after mocks ─────────────────────
import LockScreen from '@/views/LockScreen.vue'

// ── i18n + Quasar setup ──────────────────────────────
const i18n = createI18n({
  legacy: false,
  locale: 'es',
  messages: {
    es: {
      lock: {
        createIdentity: 'Crear identidad',
        unlockHint: 'Desbloquear con biometrico o PIN',
        unlockFailed: 'No se pudo desbloquear',
        authCancelled: 'Autenticacion cancelada',
        authError: 'Error de autenticacion',
        securityError: 'Se requiere conexion segura (HTTPS)',
        alreadyRegistered: 'La credencial ya esta registrada',
        keyMissing: 'Llave de firma no encontrada',
        resetIdentity: 'Reiniciar identidad',
      },
    },
  },
})

function mountLockScreen() {
  return mount(LockScreen, {
    global: {
      plugins: [createPinia(), i18n],
      stubs: {
        'q-icon': { template: '<i />', props: ['name', 'size'] },
        'q-spinner-dots': { template: '<span />', props: ['size', 'color'] },
      },
    },
  })
}

describe('LockScreen', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockStore.clear()
    localStorage.clear()
    registered = false
    authenticated = false
    mockReplace.mockClear()
    mockRegister.mockClear()
    mockAuthenticate.mockClear()
    mockDestroyIdentity.mockClear()
    mockClearSession.mockClear()
  })

  describe('initial render', () => {
    it('shows create identity hint for first-time user', () => {
      const wrapper = mountLockScreen()
      expect(wrapper.find('.unlock-hint').text()).toBe('Crear identidad')
    })

    it('shows unlock hint for returning user', () => {
      registered = true
      const wrapper = mountLockScreen()
      expect(wrapper.find('.unlock-hint').text()).toBe('Desbloquear con biometrico o PIN')
    })

    it('renders icon inside unlock button for first-time user', () => {
      const wrapper = mountLockScreen()
      const btn = wrapper.find('.unlock-btn')
      expect(btn.find('i').exists()).toBe(true)
    })

    it('does not show error or recovery on initial render', () => {
      const wrapper = mountLockScreen()
      expect(wrapper.find('.unlock-error').exists()).toBe(false)
      expect(wrapper.find('.recovery-btn').exists()).toBe(false)
    })
  })

  describe('registration flow (first-time user)', () => {
    it('calls vault.unlock which triggers register', async () => {
      const wrapper = mountLockScreen()
      await wrapper.find('.unlock-btn').trigger('click')
      await vi.waitFor(() => expect(mockRegister).toHaveBeenCalled())
    })

    it('navigates to home on successful registration', async () => {
      const wrapper = mountLockScreen()
      await wrapper.find('.unlock-btn').trigger('click')
      await vi.waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ name: 'home' }))
    })

    it('disables button while unlocking', async () => {
      // Make register hang to observe loading state
      let resolveRegister: () => void
      mockRegister.mockImplementationOnce(() => new Promise<void>((r) => { resolveRegister = r }))

      const wrapper = mountLockScreen()
      const btn = wrapper.find('.unlock-btn')
      await btn.trigger('click')
      await wrapper.vm.$nextTick()

      expect(btn.attributes('disabled')).toBeDefined()

      // Resolve to clean up
      resolveRegister!()
      await vi.waitFor(() => expect(btn.attributes('disabled')).toBeUndefined())
    })
  })

  describe('authentication flow (returning user)', () => {
    it('calls vault.unlock which triggers authenticate', async () => {
      registered = true
      const wrapper = mountLockScreen()
      await wrapper.find('.unlock-btn').trigger('click')
      await vi.waitFor(() => expect(mockAuthenticate).toHaveBeenCalled())
    })

    it('navigates to home on successful auth', async () => {
      registered = true
      const wrapper = mountLockScreen()
      await wrapper.find('.unlock-btn').trigger('click')
      await vi.waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ name: 'home' }))
    })
  })

  describe('error: NotAllowedError (user cancelled)', () => {
    it('shows cancelled message', async () => {
      mockAuthenticate.mockRejectedValueOnce(
        Object.assign(new DOMException('', 'NotAllowedError'), {}),
      )
      registered = true

      const wrapper = mountLockScreen()
      await wrapper.find('.unlock-btn').trigger('click')
      await vi.waitFor(() => {
        expect(wrapper.find('.unlock-error').text()).toBe('Autenticacion cancelada')
      })
    })

    it('re-enables button after error', async () => {
      mockAuthenticate.mockRejectedValueOnce(new DOMException('', 'NotAllowedError'))
      registered = true

      const wrapper = mountLockScreen()
      await wrapper.find('.unlock-btn').trigger('click')
      await vi.waitFor(() => {
        expect(wrapper.find('.unlock-btn').attributes('disabled')).toBeUndefined()
      })
    })
  })

  describe('error: SecurityError (HTTP context)', () => {
    it('shows HTTPS required message', async () => {
      mockRegister.mockRejectedValueOnce(new DOMException('', 'SecurityError'))

      const wrapper = mountLockScreen()
      await wrapper.find('.unlock-btn').trigger('click')
      await vi.waitFor(() => {
        expect(wrapper.find('.unlock-error').text()).toBe('Se requiere conexion segura (HTTPS)')
      })
    })
  })

  describe('error: InvalidStateError (duplicate credential)', () => {
    it('shows already registered message', async () => {
      mockRegister.mockRejectedValueOnce(new DOMException('', 'InvalidStateError'))

      const wrapper = mountLockScreen()
      await wrapper.find('.unlock-btn').trigger('click')
      await vi.waitFor(() => {
        expect(wrapper.find('.unlock-error').text()).toBe('La credencial ya esta registrada')
      })
    })
  })

  describe('error: KEY_MISSING (IndexedDB cleared)', () => {
    it('shows key missing error and recovery button', async () => {
      mockAuthenticate.mockRejectedValueOnce(new Error('KEY_MISSING'))
      registered = true

      const wrapper = mountLockScreen()
      await wrapper.find('.unlock-btn').trigger('click')
      await vi.waitFor(() => {
        expect(wrapper.find('.unlock-error').text()).toBe('Llave de firma no encontrada')
        expect(wrapper.find('.recovery-btn').exists()).toBe(true)
      })
    })

    it('recovery button calls destroyIdentity and clears error', async () => {
      mockAuthenticate.mockRejectedValueOnce(new Error('KEY_MISSING'))
      registered = true

      const wrapper = mountLockScreen()
      await wrapper.find('.unlock-btn').trigger('click')
      await vi.waitFor(() => expect(wrapper.find('.recovery-btn').exists()).toBe(true))

      await wrapper.find('.recovery-btn').trigger('click')
      await vi.waitFor(() => {
        expect(mockDestroyIdentity).toHaveBeenCalled()
        expect(wrapper.find('.recovery-btn').exists()).toBe(false)
        expect(wrapper.find('.unlock-error').exists()).toBe(false)
      })
    })
  })

  describe('error: unknown DOMException', () => {
    it('shows generic auth error', async () => {
      mockAuthenticate.mockRejectedValueOnce(new DOMException('', 'AbortError'))
      registered = true

      const wrapper = mountLockScreen()
      await wrapper.find('.unlock-btn').trigger('click')
      await vi.waitFor(() => {
        expect(wrapper.find('.unlock-error').text()).toBe('Error de autenticacion')
      })
    })
  })

  describe('error: non-DOMException', () => {
    it('shows generic auth error for unknown errors', async () => {
      mockAuthenticate.mockRejectedValueOnce(new TypeError('something broke'))
      registered = true

      const wrapper = mountLockScreen()
      await wrapper.find('.unlock-btn').trigger('click')
      await vi.waitFor(() => {
        expect(wrapper.find('.unlock-error').text()).toBe('Error de autenticacion')
      })
    })
  })

  describe('UI state transitions', () => {
    it('clears previous error on new unlock attempt', async () => {
      mockAuthenticate.mockRejectedValueOnce(new DOMException('', 'NotAllowedError'))
      registered = true

      const wrapper = mountLockScreen()

      // First attempt — error
      await wrapper.find('.unlock-btn').trigger('click')
      await vi.waitFor(() => expect(wrapper.find('.unlock-error').exists()).toBe(true))

      // Second attempt — succeeds (mockAuthenticate no longer rejects)
      await wrapper.find('.unlock-btn').trigger('click')
      await vi.waitFor(() => {
        expect(wrapper.find('.unlock-error').exists()).toBe(false)
        expect(mockReplace).toHaveBeenCalledWith({ name: 'home' })
      })
    })
  })
})
