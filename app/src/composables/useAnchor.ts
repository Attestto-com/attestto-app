export interface AnchorResult {
  txSignature: string
  slot: number
  network: 'devnet' | 'mainnet-beta'
}

const ANCHOR_URL = import.meta.env.VITE_ANCHOR_URL ?? ''

export async function anchorHash(hash: string, did: string): Promise<AnchorResult> {
  if (!ANCHOR_URL) {
    throw new Error('Servicio de anclaje no disponible — configure VITE_ANCHOR_URL')
  }

  const res = await fetch(`${ANCHOR_URL}/api/anchor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hash, did }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error')
    throw new Error(`Anchor failed (${res.status}): ${text}`)
  }

  return res.json()
}

export function getExplorerUrl(txSignature: string, network: 'devnet' | 'mainnet-beta' = 'devnet'): string {
  const cluster = network === 'devnet' ? '?cluster=devnet' : ''
  return `https://explorer.solana.com/tx/${txSignature}${cluster}`
}
