// CNN Python Server Manager
// Automatically starts and manages the Python CNN prediction server

import * as path from 'path'
import * as fs from 'fs'
import { spawn, ChildProcess } from 'child_process'

let pythonServer: ChildProcess | null = null
let serverReady = false
const SERVER_URL = 'http://localhost:5001'
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

// Start Python CNN server
export async function startCNNServer(): Promise<boolean> {
  // Check if server is already running
  if (await checkServerHealth()) {
    console.log('CNN Python server already running')
    serverReady = true
    return true
  }

  // Check if Python script exists
  const pythonScript = path.join(process.cwd(), 'cnn_predict.py')
  if (!fs.existsSync(pythonScript)) {
    console.log('CNN Python script not found, skipping server startup')
    return false
  }

  // Check if model exists
  const modelPath1 = path.join(process.cwd(), 'data', 'models', 'cnn', 'food_classifier_best.keras')
  const modelPath2 = path.join(process.cwd(), 'notebooks', 'data', 'models', 'cnn', 'food_classifier_best.keras')
  const modelPath = fs.existsSync(modelPath1) ? modelPath1 : 
                   (fs.existsSync(modelPath2) ? modelPath2 : null)
  
  if (!modelPath) {
    console.log('CNN model not found, skipping server startup')
    return false
  }

  try {
    console.log('Starting CNN Python server...')
    
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
      if (output.includes('Starting CNN prediction server')) {
        console.log('CNN Python server starting...')
      }
      if (output.includes('Running on')) {
        console.log('CNN Python server ready')
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
          console.error('CNN server error:', error.trim())
        }
      }
    })

    // Handle server exit
    pythonServer.on('exit', (code) => {
      if (code !== null && code !== 0) {
        console.log(`CNN Python server exited with code ${code}`)
      }
      pythonServer = null
      serverReady = false
    })

    // Wait for server to be ready (poll health endpoint)
    const startTime = Date.now()
    while (Date.now() - startTime < MAX_STARTUP_WAIT) {
      if (await checkServerHealth()) {
        serverReady = true
        console.log('CNN Python server is ready and responding')
        return true
      }
      await new Promise(resolve => setTimeout(resolve, 500)) // Wait 500ms between checks
    }

    console.log('CNN Python server did not start in time, using Hugging Face models')
    return false
  } catch (error: any) {
    console.error('Failed to start CNN Python server:', error.message)
    return false
  }
}

// Stop Python CNN server
export function stopCNNServer(): void {
  if (pythonServer) {
    console.log('Stopping CNN Python server...')
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
    stopCNNServer()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    stopCNNServer()
    process.exit(0)
  })

  process.on('exit', () => {
    stopCNNServer()
  })
}
