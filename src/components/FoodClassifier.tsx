'use client'

import { useState, useRef, useEffect, ChangeEvent } from 'react'

interface FoodClassifierProps {
  onClassify: (imageData: string) => void
  loading: boolean
  /** Controlled or initial preview (e.g. restored from sessionStorage). */
  initialPreview?: string | null
  /** When user selects a file or clears, notify parent so it can persist. */
  onPreviewChange?: (dataUrl: string | null) => void
  /** When user clicks Clear, parent should clear persisted image + result. */
  onClear?: () => void
}

export default function FoodClassifier({ onClassify, loading, initialPreview = null, onPreviewChange, onClear }: FoodClassifierProps) {
  const [preview, setPreviewState] = useState<string | null>(initialPreview ?? null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const setPreview = (value: string | null) => {
    setPreviewState(value)
    onPreviewChange?.(value)
  }

  useEffect(() => {
    if (initialPreview !== undefined && initialPreview !== preview) {
      setPreviewState(initialPreview ?? null)
    }
  }, [initialPreview])

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Only image files are supported')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setPreview(result)
    }
    reader.readAsDataURL(file)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleClassify = () => {
    if (preview) {
      onClassify(preview)
    }
  }

  const handleClear = () => {
    setPreviewState(null)
    onPreviewChange?.(null)
    onClear?.()
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Upload Image
      </h2>

      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8
          transition-colors duration-200
          ${dragActive ? 'border-primary-500 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-300 dark:border-gray-600'}
          ${preview ? 'border-solid' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt="Preview"
              className="max-h-64 mx-auto rounded-lg"
            />
            <button
              onClick={handleClear}
              className="absolute top-2 right-2 bg-white dark:bg-gray-700 rounded-full p-1 shadow hover:bg-gray-100 dark:hover:bg-gray-600"
              aria-label="Remove image"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="mt-4">
              <label className="cursor-pointer">
                <span className="text-primary-600 hover:text-primary-500 font-medium">
                  Choose an image
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleChange}
                />
              </label>
              <span className="text-gray-500"> or drag and drop here</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              PNG, JPG, GIF up to 10MB
            </p>
          </div>
        )}
      </div>

      {preview && (
        <div className="mt-4 flex gap-3">
          <button
            onClick={handleClassify}
            disabled={loading}
            className={`
              flex-1 py-2 px-4 rounded-lg font-medium text-white
              transition-colors duration-200
              ${loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-primary-600 hover:bg-primary-700'}
            `}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <span className="loading-spinner mr-2"></span>
                Classifying...
              </span>
            ) : (
              'Classify'
            )}
          </button>
          <button
            onClick={handleClear}
            disabled={loading}
            className="py-2 px-4 rounded-lg font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  )
}
