'use client'

import { useState, useCallback } from 'react'

type BarcodeResult = {
  product_name: string
  brands: string | null
  barcode: string
  nutrition_per_100g: {
    calories: number | null
    protein: number | null
    carbs: number | null
    fat: number | null
    fiber: number | null
  }
}

export default function BarcodeScanner({
  onProduct,
  barcodeResultActive,
  onClearBarcode
}: {
  onProduct?: (result: BarcodeResult) => void
  /** When true, show a Clear button inside the card (same style as Upload section). */
  barcodeResultActive?: boolean
  onClearBarcode?: () => void
}) {
  const [manualCode, setManualCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lookupBarcode = useCallback(async (code: string) => {
    if (!code.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/barcode?code=${encodeURIComponent(code.trim())}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Product not found')
        return
      }
      onProduct?.(data)
      setManualCode('')
    } catch {
      setError('Lookup failed')
    } finally {
      setLoading(false)
    }
  }, [onProduct])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    lookupBarcode(manualCode)
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 space-y-4 w-full min-w-0">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
        Or look up barcode
      </h2>
      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
        Look up nutrition by EAN/UPC (Open Food Facts).
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          inputMode="numeric"
          placeholder="EAN/UPC (e.g. 3017620422003)"
          value={manualCode}
          onChange={e => setManualCode(e.target.value.replace(/\D/g, '').slice(0, 14))}
          className="flex-1 min-h-[44px] px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-base touch-manipulation"
        />
        <button
          type="submit"
          disabled={loading || manualCode.length < 8}
          className="min-h-[44px] touch-manipulation px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? 'Looking up…' : 'Look up'}
        </button>
      </form>
      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
      )}
      {barcodeResultActive && onClearBarcode && (
        <div className="mt-4 flex gap-3">
          <span className="flex-1" aria-hidden="true" />
          <button
            type="button"
            onClick={onClearBarcode}
            className="py-2 px-4 rounded-lg font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  )
}
