/**
 * Ollama API Client
 * 
 * Provides interface to communicate with Ollama server.
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b'

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface GenerateRequest {
  model: string
  prompt: string
  stream?: boolean
  options?: Record<string, unknown>
}

interface ChatRequest {
  model: string
  messages: Message[]
  stream?: boolean
  options?: Record<string, unknown>
}

interface GenerateResponse {
  model: string
  response: string
  done: boolean
}

interface ChatResponse {
  model: string
  message: Message
  done: boolean
}

export class OllamaClient {
  private baseUrl: string
  private model: string
  
  constructor(baseUrl?: string, model?: string) {
    this.baseUrl = baseUrl || OLLAMA_URL
    this.model = model || OLLAMA_MODEL
  }
  
  /**
   * Check if Ollama server is available.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      return response.ok
    } catch {
      return false
    }
  }
  
  /**
   * List available models.
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`)
      if (!response.ok) throw new Error('Failed to list models')
      
      const data = await response.json()
      return data.models?.map((m: { name: string }) => m.name) || []
    } catch (error) {
      console.error('Error listing models:', error)
      return []
    }
  }
  
  /**
   * Generate text from a prompt.
   */
  async generate(prompt: string, options?: Record<string, unknown>): Promise<string> {
    const request: GenerateRequest = {
      model: this.model,
      prompt,
      stream: false,
      options
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })
      
      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`)
      }
      
      const data: GenerateResponse = await response.json()
      return data.response
    } catch (error) {
      console.error('Generate error:', error)
      throw error
    }
  }
  
  /**
   * Chat with the model.
   */
  async chat(messages: Message[], options?: Record<string, unknown>): Promise<string> {
    const request: ChatRequest = {
      model: this.model,
      messages,
      stream: false,
      options
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })
      
      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`)
      }
      
      const data: ChatResponse = await response.json()
      return data.message?.content || ''
    } catch (error) {
      console.error('Chat error:', error)
      throw error
    }
  }
  
  /**
   * Pull a model from Ollama library.
   */
  async pullModel(modelName: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName })
      })
      
      return response.ok
    } catch (error) {
      console.error('Pull model error:', error)
      return false
    }
  }
}

// Default client instance
export const ollamaClient = new OllamaClient()

export default ollamaClient
