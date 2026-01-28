'use client'

import { useState } from 'react'

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <a href="/" className="text-xl font-bold text-primary-600">
              SmartFood
            </a>
          </div>
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            <a href="/" className="text-gray-600 hover:text-gray-900 px-2 py-2 text-sm">
              Home
            </a>
            <a href="/camera" className="text-gray-600 hover:text-gray-900 px-2 py-2 text-sm">
              Camera
            </a>
            <a href="/chat" className="text-gray-600 hover:text-gray-900 px-2 py-2 text-sm">
              Chat
            </a>
            <a href="/history" className="text-gray-600 hover:text-gray-900 px-2 py-2 text-sm">
              History
            </a>
            <a href="/predictions" className="text-gray-600 hover:text-gray-900 px-2 py-2 text-sm">
              Predictions
            </a>
          </div>
          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-600 hover:text-gray-900 p-2"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-2">
            <a href="/" className="block px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 text-sm" onClick={() => setMobileMenuOpen(false)}>
              Home
            </a>
            <a href="/camera" className="block px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 text-sm" onClick={() => setMobileMenuOpen(false)}>
              Camera
            </a>
            <a href="/chat" className="block px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 text-sm" onClick={() => setMobileMenuOpen(false)}>
              Chat
            </a>
            <a href="/history" className="block px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 text-sm" onClick={() => setMobileMenuOpen(false)}>
              History
            </a>
            <a href="/predictions" className="block px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 text-sm" onClick={() => setMobileMenuOpen(false)}>
              Predictions
            </a>
          </div>
        )}
      </div>
    </nav>
  )
}
