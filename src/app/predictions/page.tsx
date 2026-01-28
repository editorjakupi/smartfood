'use client'

import { useState, useEffect } from 'react'

interface Prediction {
  type: string
  prediction: string
  confidence?: number
  basedOn: string
  details?: any
}

interface PredictionsResponse {
  predictions: Prediction[]
  patterns: string[]
  recommendations: string[]
  modelUsed: string
  note: string
  message?: string
}

export default function PredictionsPage() {
  const [data, setData] = useState<PredictionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [historyCount, setHistoryCount] = useState(0)

  useEffect(() => {
    const loadData = async () => {
      try {
        setError(null)
        const userId = localStorage.getItem('smartfood_user_id')
        if (!userId) {
          setLoading(false)
          return
        }

        // Get history count first
        const historyResponse = await fetch('/api/history', {
          headers: { 'x-user-id': userId }
        })
        if (historyResponse.ok) {
          const historyData = await historyResponse.json()
          setHistoryCount(historyData.history?.length || 0)
        }

        // Get predictions
        const response = await fetch('/api/predictions', {
          headers: { 'x-user-id': userId }
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to load predictions')
        }

        const result = await response.json()
        setData(result)
      } catch (err: any) {
        console.error('Error loading predictions:', err)
        setError(err.message || 'Failed to load predictions')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const refreshPredictions = async () => {
    setLoading(true)
    try {
      const userId = localStorage.getItem('smartfood_user_id')
      if (!userId) return

      const response = await fetch('/api/predictions', {
        headers: { 'x-user-id': userId }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to load predictions')
      }

      const result = await response.json()
      setData(result)
    } catch (err: any) {
      console.error('Error loading predictions:', err)
      setError(err.message || 'Failed to load predictions')
    } finally {
      setLoading(false)
    }
  }

  const isLSTMUsed = data?.modelUsed?.includes('LSTM') || false
  const needsMoreData = historyCount < 14

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            AI Predictions
          </h1>
          <p className="text-gray-600">
            Predictions about your next meal based on your eating patterns
          </p>
        </div>
        <button
          onClick={refreshPredictions}
          disabled={loading}
          className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* LSTM Status Card */}
      <div className={`rounded-lg shadow-lg p-6 border-2 ${
        isLSTMUsed 
          ? 'bg-green-50 border-green-300' 
          : needsMoreData
            ? 'bg-yellow-50 border-yellow-300'
            : 'bg-gray-50 border-gray-300'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
            isLSTMUsed 
              ? 'bg-green-500' 
              : needsMoreData
                ? 'bg-yellow-500'
                : 'bg-gray-400'
          }`}>
            {isLSTMUsed ? (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              LSTM Model Status
            </h2>
            <p className={`font-medium mb-2 ${
              isLSTMUsed ? 'text-green-800' : needsMoreData ? 'text-yellow-800' : 'text-gray-800'
            }`}>
              {isLSTMUsed 
                ? '✓ LSTM Model Active'
                : needsMoreData
                  ? `⚠ Using Simplified Predictions (Need ${14 - historyCount} more meals for full LSTM)`
                  : '⚠ Using Simplified Predictions (LSTM model file not found)'}
            </p>
            <p className="text-sm text-gray-700 mb-3">
              {data?.note || 'Loading model status...'}
            </p>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>Current meals in history:</strong> {historyCount}</p>
              <p><strong>Required for full LSTM:</strong> 14 meals</p>
              <p><strong>Minimum for predictions:</strong> 5 meals</p>
            </div>
            {needsMoreData && historyCount >= 5 && (
              <div className="mt-4 p-3 bg-yellow-100 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Tip:</strong> You have {historyCount} meals. Continue logging meals to unlock full LSTM predictions with 88.3% accuracy!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="loading-spinner"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 font-medium">Error</p>
          <p className="text-red-600 mt-2">{error}</p>
          <button
            onClick={refreshPredictions}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      ) : data?.message ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <p className="text-blue-800 font-medium mb-2">{data.message}</p>
          {data.recommendations && data.recommendations.length > 0 && (
            <ul className="text-blue-700 text-sm mt-3 space-y-1">
              {data.recommendations.map((rec, idx) => (
                <li key={idx}>• {rec}</li>
              ))}
            </ul>
          )}
        </div>
      ) : data?.predictions && data.predictions.length > 0 ? (
        <div className="space-y-6">
          {/* Predictions */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Predictions</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {data.predictions.map((pred, index) => (
                <div key={index} className="bg-white rounded-lg shadow p-6 border border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 capitalize">
                      {pred.type.replace(/_/g, ' ')}
                    </h3>
                    {pred.confidence !== undefined && (
                      <span className="px-2 py-1 text-xs font-medium bg-primary-100 text-primary-800 rounded">
                        {(pred.confidence * 100).toFixed(0)}% confidence
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700 mb-3">{pred.prediction}</p>
                  <p className="text-xs text-gray-500 italic">{pred.basedOn}</p>
                  {pred.details && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-600">
                        <strong>Details:</strong> {JSON.stringify(pred.details, null, 2)}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Patterns */}
          {data.patterns && data.patterns.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Detected Patterns</h2>
              <div className="bg-white rounded-lg shadow p-6">
                <ul className="space-y-2">
                  {data.patterns.map((pattern, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-gray-700">{pattern}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {data.recommendations && data.recommendations.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Recommendations</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <ul className="space-y-2">
                  {data.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-blue-800">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500">
            No predictions available. Start logging meals to get predictions.
          </p>
        </div>
      )}
    </div>
  )
}
