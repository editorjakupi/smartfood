'use client'

import { useState, useEffect } from 'react'

const ONBOARDING_KEY = 'smartfood_onboarding_done'

export default function OnboardingModal() {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    try {
      const done = localStorage.getItem(ONBOARDING_KEY)
      if (!done) setShow(true)
    } catch {
      setShow(true)
    }
  }, [])

  const handleDone = () => {
    try {
      localStorage.setItem(ONBOARDING_KEY, '1')
    } catch {}
    setShow(false)
  }

  if (!show) return null

  const steps = [
    { title: 'Upload an image', text: 'Take a photo or choose an image of your food. The app will classify the dish and show nutrition info.' },
    { title: 'See nutrition and portion', text: 'Adjust portion size (small/normal/large) and meal type. Save to your food log.' },
    { title: 'Track your goals', text: 'Set calorie and protein goals in Settings. See your daily summary and streak on the home page.' }
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6 sm:p-8">
        <h2 id="onboarding-title" className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          Welcome to SmartFood
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Log food with AI, track nutrition and reach your goals.
        </p>
        <div className="space-y-4 mb-8">
          {steps.map((s, i) => (
            <div
              key={i}
              className={`flex gap-3 p-3 rounded-lg transition-colors ${step === i ? 'bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-700' : 'bg-gray-50 dark:bg-gray-700'}`}
            >
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-semibold">
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{s.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-4 py-3 rounded-xl text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 font-medium transition-colors"
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            onClick={step < steps.length - 1 ? () => setStep(step + 1) : handleDone}
            className="flex-1 px-4 py-3 rounded-xl text-white bg-primary-600 hover:bg-primary-700 font-medium transition-colors"
          >
            {step < steps.length - 1 ? 'Next' : 'Get started'}
          </button>
        </div>
        {step < steps.length - 1 ? (
          <button
            type="button"
            onClick={handleDone}
            className="w-full mt-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            Skip
          </button>
        ) : null}
      </div>
    </div>
  )
}
