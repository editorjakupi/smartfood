'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getUserId } from '@/lib/userId'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface HistoryEntry {
  date: string
  foodClass: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  confidence?: number
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  // Load chat messages from localStorage on mount
  useEffect(() => {
    try {
      const userId = getUserId()
      if (userId) {
        const savedMessages = localStorage.getItem(`smartfood_chat_${userId}`)
        if (savedMessages) {
          const parsed = JSON.parse(savedMessages)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed)
          }
        }
      }
    } catch (error) {
      console.error('Failed to load chat messages:', error)
    }
  }, [])

  // Save chat messages to localStorage whenever they change
  useEffect(() => {
    try {
      const userId = getUserId()
      if (userId && messages.length > 0) {
        localStorage.setItem(`smartfood_chat_${userId}`, JSON.stringify(messages))
      }
    } catch (error) {
      console.error('Failed to save chat messages:', error)
    }
  }, [messages])

  // Function to load/refresh history
  const loadHistory = async (): Promise<HistoryEntry[]> => {
    try {
      const userId = getUserId()
      if (userId) {
        const response = await fetch('/api/history', {
          headers: { 'x-user-id': userId }
        })
        
        if (response.ok) {
          const data = await response.json()
          const historyData = data.history || []
          setHistory(historyData)
          return historyData
        }
      }
    } catch (error) {
      console.error('Failed to load history:', error)
    }
    return []
  }

  // Load eating history when component mounts
  useEffect(() => {
    loadHistory()
  }, [])

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault()

    if (!input.trim() || loading) return

    const userMessage: Message = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      // Refresh history before sending message to ensure we have the latest data
      const currentHistory = await loadHistory()
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          history: currentHistory // Include eating history as context
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.response || `HTTP ${response.status}`)
      }

      const data = await response.json()

      if (data.error || !data.response) {
        throw new Error(data.response || data.error || 'Chat service error')
      }

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.response || 'No response received.' }
      ])
    } catch (error: any) {
      console.error('Chat error:', error)
      const errorMessage = error.message || 'An error occurred. Please check your Groq API key configuration.'
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `**Error:** ${errorMessage}` }
      ])
    } finally {
      setLoading(false)
    }
  }

  const clearChat = () => {
    if (confirm('Are you sure you want to clear all chat messages? This cannot be undone.')) {
      setMessages([])
      // Also clear from localStorage
      try {
        const userId = getUserId()
        if (userId) {
          localStorage.removeItem(`smartfood_chat_${userId}`)
        }
      } catch (error) {
        console.error('Failed to clear chat messages from storage:', error)
      }
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col h-[600px]">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4 border-b border-primary-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg">Nutrition Assistant</h2>
              <p className="text-white/80 text-sm">Ask questions about nutrition and health</p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="px-3 py-1.5 text-sm text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Clear chat"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <div className="mb-6">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-700 mb-2">Start a conversation</p>
              <p className="text-sm text-gray-500">Ask a question about nutrition, diet, or health</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
              {[
                'How many calories are in a pizza?',
                'What are good protein sources?',
                'Give tips for a balanced diet'
              ].map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => setInput(suggestion)}
                  className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-primary-50 hover:border-primary-300 hover:text-primary-700 text-gray-700 transition-colors shadow-sm"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {/* Avatar */}
              {message.role === 'assistant' && (
                <div className="flex-shrink-0 w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center mt-1">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
              )}

              {/* Message bubble */}
              <div
                className={`
                  max-w-[75%] rounded-2xl px-4 py-3 shadow-sm
                  ${message.role === 'user'
                    ? 'bg-primary-600 text-white rounded-br-sm'
                    : 'bg-white text-gray-900 border border-gray-200 rounded-bl-sm'}
                `}
              >
                {message.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // Headings
                        h1: ({node, ...props}) => <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0 text-gray-900" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-base font-bold mb-2 mt-3 first:mt-0 text-gray-900" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-sm font-bold mb-1.5 mt-2 first:mt-0 text-gray-900" {...props} />,
                        // Paragraphs
                        p: ({node, ...props}) => <p className="mb-2 last:mb-0 text-gray-800 leading-relaxed" {...props} />,
                        // Lists
                        ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2 space-y-1 text-gray-800" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2 space-y-1 text-gray-800" {...props} />,
                        li: ({node, ...props}) => <li className="ml-2 text-gray-800" {...props} />,
                        // Strong/Bold
                        strong: ({node, ...props}) => <strong className="font-semibold text-gray-900" {...props} />,
                        // Emphasis/Italic
                        em: ({node, ...props}) => <em className="italic text-gray-800" {...props} />,
                        // Code blocks
                        code: ({node, inline, ...props}: any) => 
                          inline ? (
                            <code className="bg-gray-100 text-primary-700 px-1.5 py-0.5 rounded text-sm font-mono" {...props} />
                          ) : (
                            <code className="block bg-gray-100 text-gray-800 p-3 rounded-lg text-sm font-mono overflow-x-auto mb-2" {...props} />
                          ),
                        pre: ({node, ...props}) => <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto mb-2" {...props} />,
                        // Links
                        a: ({node, ...props}) => <a className="text-primary-600 hover:text-primary-700 underline" target="_blank" rel="noopener noreferrer" {...props} />,
                        // Blockquotes
                        blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-primary-300 pl-3 italic text-gray-700 my-2" {...props} />,
                        // Horizontal rule
                        hr: ({node, ...props}) => <hr className="my-3 border-gray-300" {...props} />,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-white leading-relaxed whitespace-pre-wrap">{message.content}</p>
                )}
              </div>

              {/* User avatar */}
              {message.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center mt-1">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
            </div>
          ))
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center mt-1">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t bg-white p-4">
        <form onSubmit={sendMessage} className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about nutrition, diet, or health..."
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage(e)
                }
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className={`
                absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors
                ${loading || !input.trim()
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-primary-600 hover:bg-primary-50 hover:text-primary-700'}
              `}
              title="Send message (Enter)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
