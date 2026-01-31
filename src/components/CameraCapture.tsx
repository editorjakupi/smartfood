'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface CameraCaptureProps {
  onCapture: (imageData: string) => void
  loading: boolean
}

export default function CameraCapture({ onCapture, loading }: CameraCaptureProps) {
  const [streaming, setStreaming] = useState(false)
  const [captured, setCaptured] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setStreaming(false)
  }, [])

  const startCamera = useCallback(async () => {
    try {
      setError(null)
      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }

      // Detect if mobile device
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          ...(isMobile ? { facingMode: 'environment' } : {}), // Only use facingMode on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })

      // Video element is always rendered now, so videoRef.current should always be available
      if (!videoRef.current) {
        stream.getTracks().forEach(track => track.stop())
        setError('Video element not available. Please refresh the page.')
        return
      }

      videoRef.current.srcObject = stream
      streamRef.current = stream
      
      // Set streaming immediately when stream is assigned
      // This ensures UI updates even if play() is delayed
      setStreaming(true)

      // Wait for metadata then play
      const video = videoRef.current
      video.onloadedmetadata = () => {
        video.play()
          .then(() => {
            console.log('Video playing successfully')
            setStreaming(true)
          })
          .catch(err => {
            console.error('Video play error:', err)
            setError('Could not play video stream. Please try again.')
            stopCamera()
          })
      }

      // Also try to play immediately if video is already ready
      if (video.readyState >= 2) {
        video.play()
          .then(() => {
            console.log('Video playing (already ready)')
            setStreaming(true)
          })
          .catch(err => {
            console.error('Immediate play error:', err)
            // Don't stop camera here, wait for metadata
          })
      }

      // Fallback: if metadata doesn't fire within 2 seconds, try playing anyway
      setTimeout(() => {
        if (video && video.srcObject && !video.paused) {
          // Video is already playing, ensure streaming state is set
          setStreaming(true)
        } else if (video && video.srcObject && video.readyState >= 1) {
          video.play()
            .then(() => {
              console.log('Video playing (fallback)')
              setStreaming(true)
            })
            .catch(err => {
              console.error('Fallback play error:', err)
              setError('Video stream not available. Please check camera permissions.')
              stopCamera()
            })
        } else if (video && video.srcObject) {
          // Stream is assigned but video not ready, wait a bit more
          console.log('Video stream assigned but not ready, waiting...')
        }
      }, 2000)
    } catch (err: any) {
      console.error('Camera error:', err)
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access and try again.')
      } else if (err.name === 'NotFoundError') {
        setError('No camera found. Please connect a camera and try again.')
      } else if (err.name === 'NotReadableError') {
        setError('Camera is in use by another application. Please close other apps and try again.')
      } else {
        setError('Could not start camera. Please check permissions and ensure camera is available.')
      }
      stopCamera()
    }
  }, [stopCamera])

  const captureImage = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')

      if (context) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0)

        const imageData = canvas.toDataURL('image/jpeg', 0.8)
        setCaptured(imageData)
        stopCamera()
      }
    }
  }, [stopCamera])

  const retake = useCallback(() => {
    setCaptured(null)
    startCamera()
  }, [startCamera])

  const handleClassify = useCallback(() => {
    if (captured) {
      onCapture(captured)
    }
  }, [captured, onCapture])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Camera
      </h2>

      <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center text-white text-center p-4 z-10">
            <div>
              <p className="mb-4">{error}</p>
              <button
                onClick={startCamera}
                className="px-4 py-2 bg-primary-600 rounded-lg hover:bg-primary-700"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : captured ? (
          <img
            src={captured}
            alt="Captured"
            className="w-full h-full object-contain"
          />
        ) : (
          <>
            {/* Always render video element so ref is available */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ 
                display: streaming ? 'block' : 'none', 
                visibility: streaming ? 'visible' : 'hidden', 
                zIndex: 1 
              }}
              onCanPlay={() => {
                console.log('Video can play')
                if (videoRef.current) {
                  videoRef.current.play().catch(err => console.error('Play error:', err))
                }
                setStreaming(true)
              }}
              onLoadedMetadata={() => {
                console.log('Video metadata loaded')
                if (videoRef.current) {
                  videoRef.current.play().catch(err => console.error('Play error:', err))
                }
              }}
              onPlay={() => {
                console.log('Video is playing')
                setStreaming(true)
              }}
              onError={(e) => {
                console.error('Video error:', e)
                setError('Video playback error. Please try again.')
                stopCamera()
              }}
            />
            {!streaming && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <button
                  onClick={startCamera}
                  className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Start Camera
                </button>
              </div>
            )}
          </>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="mt-4 flex gap-3">
        {streaming && (
          <>
            <button
              onClick={captureImage}
              className="flex-1 py-2 px-4 rounded-lg font-medium text-white bg-primary-600 hover:bg-primary-700"
            >
              Capture
            </button>
            <button
              onClick={stopCamera}
              className="py-2 px-4 rounded-lg font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          </>
        )}

        {captured && (
          <>
            <button
              onClick={handleClassify}
              disabled={loading}
              className={`
                flex-1 py-2 px-4 rounded-lg font-medium text-white
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
              onClick={retake}
              disabled={loading}
              className="py-2 px-4 rounded-lg font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Retake
            </button>
          </>
        )}
      </div>
    </div>
  )
}
