/**
 * Chat-related type definitions.
 */

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

export interface ChatState {
  messages: Message[]
  isLoading: boolean
  error: string | null
}

export interface ChatContext {
  foodClass?: string
  nutrition?: {
    calories: number
    protein: number
    carbs: number
    fat: number
  }
  history?: Array<{
    date: string
    foodClass: string
  }>
}

// ChatMessage for API requests (simpler than Message)
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export function createMessage(
  role: 'user' | 'assistant' | 'system',
  content: string
): Message {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: new Date()
  }
}

export function createConversation(title: string = 'New Conversation'): Conversation {
  return {
    id: crypto.randomUUID(),
    title,
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date()
  }
}
