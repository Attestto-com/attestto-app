import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { InboxItem } from '@attestto/module-sdk'

export const useInboxStore = defineStore('inbox', () => {
  const items = ref<InboxItem[]>([])

  const pending = computed(() =>
    items.value
      .filter((i) => i.type === 'action' || i.type === 'warning')
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)),
  )

  const recent = computed(() =>
    items.value
      .filter((i) => i.type === 'info')
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10),
  )

  function push(item: InboxItem) {
    const idx = items.value.findIndex((i) => i.id === item.id)
    if (idx >= 0) items.value[idx] = item
    else items.value.push(item)
  }

  function dismiss(id: string) {
    items.value = items.value.filter((i) => i.id !== id)
  }

  function clear() {
    items.value = []
  }

  return { items, pending, recent, push, dismiss, clear }
})
