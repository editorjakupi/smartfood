import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SmartFood - AI Food Classification',
  description: 'AI-driven food classification with nutrition information and dietary recommendations',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          <nav className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <a href="/" className="text-xl font-bold text-primary-600">
                    SmartFood
                  </a>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-4">
                  <a href="/" className="text-gray-600 hover:text-gray-900 px-2 py-2 text-sm sm:text-base">
                    Home
                  </a>
                  <a href="/camera" className="text-gray-600 hover:text-gray-900 px-2 py-2 text-sm sm:text-base">
                    Camera
                  </a>
                  <a href="/chat" className="text-gray-600 hover:text-gray-900 px-2 py-2 text-sm sm:text-base">
                    Chat
                  </a>
                  <a href="/history" className="text-gray-600 hover:text-gray-900 px-2 py-2 text-sm sm:text-base">
                    History
                  </a>
                  <a href="/predictions" className="text-gray-600 hover:text-gray-900 px-2 py-2 text-sm sm:text-base">
                    Predictions
                  </a>
                </div>
              </div>
            </div>
          </nav>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
