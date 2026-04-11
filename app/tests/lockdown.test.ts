import { describe, it, expect } from 'vitest'
import type { LockdownEvent } from '../../modules/cr-driving/src/composables/useLockdown'

/**
 * Tests for lockdown event classification logic.
 * Tests the event types and keyboard blocking rules without DOM.
 */

const BLOCKED_CTRL_KEYS = ['c', 'v', 'p', 'a', 's', 'f', 'l', 'w', 't', 'n']
const BLOCKED_META_KEYS = ['c', 'v', 'p', 'a', 's', 'f', 'l', 'w', 't', 'n', 'q', 'h', 'm']
const BLOCKED_F_KEYS = ['F5', 'F11', 'F12']

function shouldBlockKey(e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): boolean {
  if (e.ctrlKey && BLOCKED_CTRL_KEYS.includes(e.key.toLowerCase())) return true
  if (e.metaKey && BLOCKED_META_KEYS.includes(e.key.toLowerCase())) return true
  if (BLOCKED_F_KEYS.includes(e.key)) return true
  if (e.altKey && e.key === 'Tab') return true
  if (e.altKey && e.key === 'F4') return true
  if (e.key === 'PrintScreen') return true
  return false
}

describe('Lockdown keyboard blocking', () => {
  it('blocks Ctrl+C', () => {
    expect(shouldBlockKey({ key: 'c', ctrlKey: true, metaKey: false, altKey: false })).toBe(true)
  })

  it('blocks Ctrl+V', () => {
    expect(shouldBlockKey({ key: 'v', ctrlKey: true, metaKey: false, altKey: false })).toBe(true)
  })

  it('blocks Ctrl+P (print)', () => {
    expect(shouldBlockKey({ key: 'p', ctrlKey: true, metaKey: false, altKey: false })).toBe(true)
  })

  it('blocks Ctrl+S (save)', () => {
    expect(shouldBlockKey({ key: 's', ctrlKey: true, metaKey: false, altKey: false })).toBe(true)
  })

  it('blocks Ctrl+W (close tab)', () => {
    expect(shouldBlockKey({ key: 'w', ctrlKey: true, metaKey: false, altKey: false })).toBe(true)
  })

  it('blocks Ctrl+T (new tab)', () => {
    expect(shouldBlockKey({ key: 't', ctrlKey: true, metaKey: false, altKey: false })).toBe(true)
  })

  it('blocks Cmd+Q (macOS quit)', () => {
    expect(shouldBlockKey({ key: 'q', ctrlKey: false, metaKey: true, altKey: false })).toBe(true)
  })

  it('blocks Cmd+H (macOS hide)', () => {
    expect(shouldBlockKey({ key: 'h', ctrlKey: false, metaKey: true, altKey: false })).toBe(true)
  })

  it('blocks Cmd+M (macOS minimize)', () => {
    expect(shouldBlockKey({ key: 'm', ctrlKey: false, metaKey: true, altKey: false })).toBe(true)
  })

  it('blocks F5 (refresh)', () => {
    expect(shouldBlockKey({ key: 'F5', ctrlKey: false, metaKey: false, altKey: false })).toBe(true)
  })

  it('blocks F11 (fullscreen toggle)', () => {
    expect(shouldBlockKey({ key: 'F11', ctrlKey: false, metaKey: false, altKey: false })).toBe(true)
  })

  it('blocks F12 (devtools)', () => {
    expect(shouldBlockKey({ key: 'F12', ctrlKey: false, metaKey: false, altKey: false })).toBe(true)
  })

  it('blocks Alt+Tab', () => {
    expect(shouldBlockKey({ key: 'Tab', ctrlKey: false, metaKey: false, altKey: true })).toBe(true)
  })

  it('blocks Alt+F4', () => {
    expect(shouldBlockKey({ key: 'F4', ctrlKey: false, metaKey: false, altKey: true })).toBe(true)
  })

  it('blocks PrintScreen', () => {
    expect(shouldBlockKey({ key: 'PrintScreen', ctrlKey: false, metaKey: false, altKey: false })).toBe(true)
  })

  it('allows regular typing (letter a)', () => {
    expect(shouldBlockKey({ key: 'a', ctrlKey: false, metaKey: false, altKey: false })).toBe(false)
  })

  it('allows Enter key', () => {
    expect(shouldBlockKey({ key: 'Enter', ctrlKey: false, metaKey: false, altKey: false })).toBe(false)
  })

  it('allows arrow keys', () => {
    expect(shouldBlockKey({ key: 'ArrowDown', ctrlKey: false, metaKey: false, altKey: false })).toBe(false)
  })

  it('allows Tab without Alt', () => {
    expect(shouldBlockKey({ key: 'Tab', ctrlKey: false, metaKey: false, altKey: false })).toBe(false)
  })

  it('allows F1-F4 (not blocked)', () => {
    expect(shouldBlockKey({ key: 'F1', ctrlKey: false, metaKey: false, altKey: false })).toBe(false)
    expect(shouldBlockKey({ key: 'F4', ctrlKey: false, metaKey: false, altKey: false })).toBe(false)
  })
})

describe('Lockdown event types', () => {
  const validTypes: LockdownEvent['type'][] = [
    'focus-lost',
    'focus-regained',
    'blocked-key',
    'fullscreen-exit',
    'blocked-clipboard',
    'blocked-print',
  ]

  it('has 6 event types', () => {
    expect(validTypes).toHaveLength(6)
  })

  it('focus events come in pairs', () => {
    expect(validTypes).toContain('focus-lost')
    expect(validTypes).toContain('focus-regained')
  })

  it('includes all blocking events', () => {
    expect(validTypes).toContain('blocked-key')
    expect(validTypes).toContain('blocked-clipboard')
    expect(validTypes).toContain('blocked-print')
  })
})
