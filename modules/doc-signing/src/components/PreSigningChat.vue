<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import type { ChatMessage } from '../types'

const props = defineProps<{
  messages: ChatMessage[]
  currentQuestion: string | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  answer: [text: string]
}>()

const input = ref('')
const chatContainer = ref<HTMLElement | null>(null)

function send() {
  const text = input.value.trim()
  if (!text || props.disabled) return
  emit('answer', text)
  input.value = ''
}

function quickAnswer(text: string) {
  if (props.disabled) return
  emit('answer', text)
}

watch(() => props.messages.length, async () => {
  await nextTick()
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
})
</script>

<template>
  <div class="chat-container">
    <div ref="chatContainer" class="chat-messages">
      <div
        v-for="msg in messages"
        :key="msg.id"
        :class="['chat-bubble', msg.role === 'assistant' ? 'bubble-assistant' : 'bubble-user']"
      >
        <span v-if="msg.role === 'assistant'" class="material-icons-outlined bubble-icon">psychology</span>
        <div class="bubble-text">{{ msg.text }}</div>
      </div>

      <div v-if="currentQuestion" class="chat-bubble bubble-assistant">
        <span class="material-icons-outlined bubble-icon">psychology</span>
        <div class="bubble-text">{{ currentQuestion }}</div>
      </div>
    </div>

    <div v-if="currentQuestion" class="quick-answers">
      <button class="quick-btn" @click="quickAnswer('Si, correcto')">Si, correcto</button>
      <button class="quick-btn" @click="quickAnswer('No estoy seguro')">No estoy seguro</button>
      <button class="quick-btn" @click="quickAnswer('No, eso no es lo que acorde')">No</button>
    </div>

    <div class="chat-input-row">
      <input
        v-model="input"
        type="text"
        class="chat-input"
        placeholder="Escribe tu respuesta..."
        :disabled="disabled || !currentQuestion"
        @keyup.enter="send"
      />
      <button
        class="send-btn"
        :disabled="!input.trim() || disabled || !currentQuestion"
        @click="send"
      >
        <span class="material-icons-outlined">send</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 300px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
}

.chat-bubble {
  display: flex;
  gap: 8px;
  max-width: 85%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.5;
}

.bubble-assistant {
  align-self: flex-start;
  background: var(--bg-card, #1a1f2e);
  color: var(--text, #e8eaed);
}

.bubble-user {
  align-self: flex-end;
  background: var(--primary, #594FD3);
  color: white;
}

.bubble-icon {
  font-size: 16px;
  color: var(--primary, #594FD3);
  flex-shrink: 0;
  margin-top: 2px;
}

.bubble-text {
  white-space: pre-wrap;
}

.quick-answers {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 8px 0;
}

.quick-btn {
  background: rgba(89, 79, 211, 0.15);
  color: var(--primary, #594FD3);
  border: 1px solid rgba(89, 79, 211, 0.3);
  border-radius: 16px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
}

.quick-btn:active {
  background: rgba(89, 79, 211, 0.3);
}

.chat-input-row {
  display: flex;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.chat-input {
  flex: 1;
  background: var(--bg-card, #1a1f2e);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px 12px;
  color: var(--text, #e8eaed);
  font-size: 13px;
  outline: none;
}

.chat-input:focus {
  border-color: var(--primary, #594FD3);
}

.chat-input:disabled {
  opacity: 0.5;
}

.send-btn {
  background: var(--primary, #594FD3);
  border: none;
  border-radius: 8px;
  padding: 8px;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.send-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.send-btn .material-icons-outlined {
  font-size: 18px;
}
</style>
