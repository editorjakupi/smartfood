'use client'

import { useState, useCallback } from 'react'
import type { ChatMessage, ChatContext } from '@/types/chat'

interface UseChatResult {
  messages: ChatMessage[]
  loading: boolean
  error: string | null
  sendMessage: (content: string, context?: ChatContext) => Promise<void>
  clearMessages: () => void
}

export function useChat(): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(async (content: string, context?: ChatContext) => {
    if (!content.trim()) return
    
    setLoading(true)
    setError(null)
    
    // Add user message
    const userMessage: ChatMessage = { role: 'user', content: content.trim() }
    setMessages(prev => [...prev, userMessage])
    
    try {
      // Build context string
      let contextStr = ''
      if (context) {
        const parts = []
        if (context.foodClass) {
          parts.push(`Food: ${context.foodClass}`)
        }
        if (context.nutrition) {
          parts.push(`Nutrition: ${JSON.stringify(context.nutrition)}`)
        }
        if (parts.length > 0) {
          contextStr = parts.join('. ')
        }
      }
      
      // Send to API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          context: contextStr
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.response || `HTTP ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.response || data.error || 'Chat service error')
      }
      
      // Add assistant message
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response || 'No response received.'
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
      console.error('Chat error:', err)
      
      // Add error message with more context
      const errorMessage = message.includes('Groq') || message.includes('API key')
        ? 'Groq API error. Please check your API key configuration.'
        : message.includes('timeout')
        ? 'Request timed out. Please try again.'
        : 'An error occurred. Please try again.'
      
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Error: ${errorMessage}` }
      ])
    } finally {
      setLoading(false)
    }
  }, [messages])

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return {
    messages,
    loading,
    error,
    sendMessage,
    clearMessages
  }
}

export default useChat
