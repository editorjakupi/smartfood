'use client'

import ChatInterface from '@/components/ChatInterface'

export default function ChatPage() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Nutrition Chat
        </h1>
        <p className="text-gray-600">
          Ask questions about nutrition, diet, and health
        </p>
      </div>

      <ChatInterface />
    </div>
  )
}
