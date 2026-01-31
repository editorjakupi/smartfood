'use client'

import { useState, useEffect, useCallback } from 'react'
import FoodClassifier from '@/components/FoodClassifier'
import NutritionDisplay from '@/components/NutritionDisplay'
import TodaySummary from '@/components/TodaySummary'
import BarcodeScanner from '@/components/BarcodeScanner'

const STORAGE_KEY = 'smartfood_home_image'

interface ClassificationResult {
  class: string
  confidence: number
  nutrition: Record<string, number> | null
  nutritionSource?: string
  /** When result is from barcode lookup. */
  barcode?: string
}

interface BarcodeProduct {
  product_name: string
  barcode?: string
  nutrition_per_100g: { calories: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null }
}

function loadStored(): { preview: string | null; result: ClassificationResult | null } {
  if (typeof window === 'undefined') return { preview: null, result: null }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { preview: null, result: null }
    const data = JSON.parse(raw)
    return { preview: data.preview ?? null, result: data.result ?? null }
  } catch {
    return { preview: null, result: null }
  }
}

function saveStored(preview: string | null, result: ClassificationResult | null) {
  if (typeof window === 'undefined') return
  try {
    if (!preview && !result) {
      sessionStorage.removeItem(STORAGE_KEY)
      return
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ preview, result }))
  } catch (_) {}
}

export default function Home() {
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageResult, setImageResult] = useState<ClassificationResult | null>(null)
  const [barcodeResult, setBarcodeResult] = useState<ClassificationResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const { preview, result } = loadStored()
    if (preview) setImagePreview(preview)
    if (result && !(result as any).error) setImageResult(result)
  }, [])

  const handleClassification = useCallback(async (imageData: string) => {
    setLoading(true)
    setImageResult(null)
    setImagePreview(imageData)
    saveStored(imageData, null)
    try {
      const response = await fetch('/api/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }
      const data = await response.json()
      if (data.error) throw new Error(data.error || 'Classification failed')
      setBarcodeResult(null) // new image result replaces displayed result
      setImageResult(data)
      saveStored(imageData, data) // persist so result stays when navigating away
    } catch (error: any) {
      console.error('Classification error:', error)
      const msg = error.message || 'Failed to classify image. Check your connection and try again.'
      setImageResult({
        class: 'error',
        confidence: 0,
        nutrition: null,
        error: msg
      } as any)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleBarcodeProduct = useCallback((barcodeData: BarcodeProduct) => {
    const nut = barcodeData.nutrition_per_100g
    setBarcodeResult({
      class: (barcodeData.product_name || 'Unknown').replace(/\s+/g, '_'),
      confidence: 1,
      nutrition: {
        calories: nut.calories ?? 0,
        protein: nut.protein ?? 0,
        carbs: nut.carbs ?? 0,
        fat: nut.fat ?? 0,
        fiber: nut.fiber ?? 0
      },
      nutritionSource: 'barcode',
      barcode: barcodeData.barcode
    })
  }, [])

  const handleImagePreviewChange = useCallback((dataUrl: string | null) => {
    setImagePreview(dataUrl)
    if (!dataUrl) {
      setImageResult(null)
      saveStored(null, null)
    }
  }, [])

  useEffect(() => {
    if (!imagePreview && !imageResult) {
      saveStored(null, null)
      return
    }
    const resultToStore = imageResult && !(imageResult as any).error ? imageResult : null
    saveStored(imagePreview, resultToStore)
  }, [imagePreview, imageResult])

  const handleImageClear = useCallback(() => {
    setImagePreview(null)
    setImageResult(null)
    saveStored(null, null)
  }, [])

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          SmartFood
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Upload a food image for classification, nutrition info and personalized dietary recommendations.
        </p>
      </div>

      <TodaySummary />

      {/* Upload and Barcode cards side by side, same height (aligned at bottom) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div className="lg:col-span-2 flex h-full min-h-0">
          <div className="w-full h-full min-h-0">
            <FoodClassifier
              onClassify={handleClassification}
              loading={loading}
              initialPreview={imagePreview}
              onPreviewChange={handleImagePreviewChange}
              onClear={handleImageClear}
            />
          </div>
        </div>
        <div className="flex h-full min-h-0">
          <div className="w-full h-full min-h-0">
            <BarcodeScanner
              onProduct={handleBarcodeProduct}
              barcodeResultActive={!!(barcodeResult?.nutrition)}
              onClearBarcode={() => setBarcodeResult(null)}
            />
          </div>
        </div>
      </div>

      {/* Single result: full width below both sections. Barcode overrides image when both exist. */}
      {(() => {
        const displayResult = barcodeResult ?? imageResult
        if (!displayResult && !loading && !imagePreview) {
          return (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-gray-500 dark:text-gray-400">
              Upload an image or enter a barcode to see nutrition information.
            </div>
          )
        }
        if (displayResult && (displayResult as any).error) {
          return (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
              <p className="text-red-800 dark:text-red-200 font-medium">Error</p>
              <p className="text-red-600 dark:text-red-300 mt-2">{(displayResult as any).error}</p>
              <button
                type="button"
                onClick={() => { setImageResult(null); setBarcodeResult(null); setLoading(false); }}
                className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 min-h-[44px]"
              >
                Try again
              </button>
            </div>
          )
        }
        if (displayResult && displayResult.class !== 'error' && displayResult.nutrition) {
          return (
            <NutritionDisplay
              foodClass={displayResult.class}
              confidence={displayResult.confidence}
              nutrition={displayResult.nutrition}
              nutritionSource={displayResult.nutritionSource}
              fromBarcode={displayResult.barcode}
              manualSaveOnly
            />
          )
        }
        return null
      })()}
    </div>
  )
}
