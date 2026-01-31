'use client'

import ChatInterface from '@/components/ChatInterface'

export default function ChatPage() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Nutrition Chat
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Ask questions about nutrition, diet, and health
        </p>
      </div>

      <ChatInterface />
    </div>
  )
}
