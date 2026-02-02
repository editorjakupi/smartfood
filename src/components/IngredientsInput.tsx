'use client'

import { useState } from 'react'

interface NutritionTotal {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

export interface IngredientsResult {
  total: NutritionTotal
  breakdown: Array<{ name: string; amountG: number; nutrition: NutritionTotal; source?: string }>
  source: string
}

interface IngredientsInputProps {
  /** When nutrition is fetched, pass result to parent so it can show it below all sections. */
  onResult?: (data: IngredientsResult) => void
  /** When user clears the ingredients result in this card. */
  onClearResult?: () => void
}

export default function IngredientsInput({ onResult, onClearResult }: IngredientsInputProps) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<IngredientsResult | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setResult(null)
    if (!text.trim()) {
      setError('Enter ingredients first.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to get nutrition')
        return
      }
      setResult(data)
      onResult?.(data)
    } catch (err: any) {
      setError(err.message || 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setText('')
    setError(null)
    setResult(null)
    onClearResult?.()
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 w-full min-w-0">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1 sm:mb-2">
        Add by ingredients
      </h2>
      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">
        Type ingredients (Swedish or English). Same sources as image and barcode. Result is shown below.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          value={text}
          onChange={e => { setText(e.target.value); setError(null); setResult(null); }}
          placeholder="e.g. 2 eggs, 100 g oats, 1 banana"
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 min-h-[100px] resize-y text-base touch-manipulation"
          rows={3}
          disabled={loading}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={loading || !text.trim()}
            className="flex-1 min-w-[120px] px-4 py-2.5 rounded-lg font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation"
          >
            {loading ? 'Getting nutrition...' : 'Get nutrition'}
          </button>
          {(result || error) && (
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2.5 rounded-lg font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 min-h-[44px] touch-manipulation"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {result && !error && (
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          See nutrition and recommendations below.
        </p>
      )}
    </div>
  )
}
