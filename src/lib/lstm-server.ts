// LSTM Python Server Manager
// Automatically starts and manages the Python LSTM prediction server

import * as path from 'path'
import * as fs from 'fs'
import { spawn, ChildProcess } from 'child_process'

let pythonServer: ChildProcess | null = null
let serverReady = false
const SERVER_URL = 'http://localhost:5000'
const MAX_STARTUP_WAIT = 30000 // 30 seconds max wait for server to start

// Check if Python server is running
async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${SERVER_URL}/health`, {
      signal: AbortSignal.timeout(2000)
    })
    return response.ok
  } catch {
    return false
  }
}

// Start Python LSTM server
export async function startLSTMServer(): Promise<boolean> {
  // Check if server is already running
  if (await checkServerHealth()) {
    console.log('✓ LSTM Python server already running')
    serverReady = true
    return true
  }

  // Check if Python script exists
  const pythonScript = path.join(process.cwd(), 'lstm_predict.py')
  if (!fs.existsSync(pythonScript)) {
    console.log('LSTM Python script not found, skipping server startup')
    return false
  }

  // Check if model exists
  const modelPath = path.join(process.cwd(), 'data', 'models', 'lstm', 'eating_pattern_model.h5')
  if (!fs.existsSync(modelPath)) {
    console.log('LSTM model not found, skipping server startup')
    return false
  }

  try {
    console.log('Starting LSTM Python server...')
    
    // Start Python server
    // Use 'python3' on Unix, 'python' on Windows
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
    
    pythonServer = spawn(pythonCmd, [pythonScript, '--server'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      env: { ...process.env, PYTHONUNBUFFERED: '1' } // Ensure output is not buffered
    })

    // Handle server output
    let serverOutput = ''
    pythonServer.stdout?.on('data', (data: Buffer) => {
      const output = data.toString()
      serverOutput += output
      if (output.includes('Starting LSTM prediction server')) {
        console.log('✓ LSTM Python server starting...')
      }
      if (output.includes('Running on')) {
        console.log('✓ LSTM Python server ready')
      }
    })

    pythonServer.stderr?.on('data', (data: Buffer) => {
      const error = data.toString()
      // Ignore TensorFlow info messages, but log real errors
      if (!error.includes('oneDNN') && 
          !error.includes('I tensorflow') && 
          !error.includes('Created device') &&
          !error.includes('oneDNN custom operations')) {
        // Only log actual errors, not warnings
        if (error.toLowerCase().includes('error') || error.toLowerCase().includes('exception')) {
          console.error('LSTM server error:', error.trim())
        }
      }
    })

    // Handle server exit
    pythonServer.on('exit', (code) => {
      if (code !== null && code !== 0) {
        console.log(`LSTM Python server exited with code ${code}`)
      }
      pythonServer = null
      serverReady = false
    })

    // Wait for server to be ready (poll health endpoint)
    const startTime = Date.now()
    while (Date.now() - startTime < MAX_STARTUP_WAIT) {
      if (await checkServerHealth()) {
        serverReady = true
        console.log('✓ LSTM Python server is ready and responding')
        return true
      }
      await new Promise(resolve => setTimeout(resolve, 500)) // Wait 500ms between checks
    }

    console.log('⚠ LSTM Python server did not start in time, using fallback mode')
    return false
  } catch (error: any) {
    console.error('Failed to start LSTM Python server:', error.message)
    return false
  }
}

// Stop Python LSTM server
export function stopLSTMServer(): void {
  if (pythonServer) {
    console.log('Stopping LSTM Python server...')
    pythonServer.kill('SIGTERM')
    pythonServer = null
    serverReady = false
  }
}

// Check if server is ready
export function isServerReady(): boolean {
  return serverReady
}

// Get server URL
export function getServerUrl(): string {
  return SERVER_URL
}

// Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('SIGINT', () => {
    stopLSTMServer()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    stopLSTMServer()
    process.exit(0)
  })

  process.on('exit', () => {
    stopLSTMServer()
  })
}
