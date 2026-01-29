// CNN Model using TensorFlow.js
// Runs directly in Node.js without Python servers
// Works in both local development and serverless deployment (Vercel)
// Uses pure JavaScript TensorFlow.js (works with Node.js 24+)

import * as tf from '@tensorflow/tfjs'
import * as fs from 'fs'
import * as path from 'path'

// Food-101 class names (same order as training)
const FOOD_CLASSES = [
  'apple_pie', 'baby_back_ribs', 'baklava', 'beef_carpaccio', 'beef_tartare',
  'beet_salad', 'beignets', 'bibimbap', 'bread_pudding', 'breakfast_burrito',
  'bruschetta', 'caesar_salad', 'cannoli', 'caprese_salad', 'carrot_cake',
  'ceviche', 'cheesecake', 'cheese_plate', 'chicken_curry', 'chicken_quesadilla',
  'chicken_wings', 'chocolate_cake', 'chocolate_mousse', 'churros', 'clam_chowder',
  'club_sandwich', 'crab_cakes', 'creme_brulee', 'croque_madame', 'cup_cakes',
  'deviled_eggs', 'donuts', 'dumplings', 'edamame', 'eggs_benedict',
  'escargots', 'falafel', 'filet_mignon', 'fish_and_chips', 'foie_gras',
  'french_fries', 'french_onion_soup', 'french_toast', 'fried_calamari', 'fried_rice',
  'frozen_yogurt', 'garlic_bread', 'gnocchi', 'greek_salad', 'grilled_cheese_sandwich',
  'grilled_salmon', 'guacamole', 'gyoza', 'hamburger', 'hot_and_sour_soup',
  'hot_dog', 'huevos_rancheros', 'hummus', 'ice_cream', 'lasagna',
  'lobster_bisque', 'lobster_roll_sandwich', 'macaroni_and_cheese', 'macarons', 'miso_soup',
  'mussels', 'nachos', 'omelette', 'onion_rings', 'oysters',
  'pad_thai', 'paella', 'pancakes', 'panna_cotta', 'peking_duck',
  'pho', 'pizza', 'pork_chop', 'poutine', 'prime_rib',
  'pulled_pork_sandwich', 'ramen', 'ravioli', 'red_velvet_cake', 'risotto',
  'samosa', 'sashimi', 'scallops', 'seaweed_salad', 'shrimp_and_grits',
  'spaghetti_bolognese', 'spaghetti_carbonara', 'spring_rolls', 'steak', 'strawberry_shortcake',
  'sushi', 'tacos', 'takoyaki', 'tiramisu', 'tuna_tartare',
  'waffles'
]

const IMAGE_SIZE = 224 // ResNet50 input size
let cnnModel: tf.LayersModel | null = null

// Find TensorFlow.js model directory
function findTFJSModelPath(): string | null {
  const paths = [
    path.join(process.cwd(), 'data', 'models', 'cnn', 'tfjs', 'model.json'),
    path.join(process.cwd(), 'public', 'models', 'cnn', 'tfjs', 'model.json')
  ]
  
  for (const modelPath of paths) {
    if (fs.existsSync(modelPath)) {
      return path.dirname(modelPath)
    }
  }
  
  return null
}

// Load CNN model (cached)
export async function loadCNNModel(): Promise<boolean> {
  if (cnnModel !== null) {
    return true
  }
  
  try {
    const modelDir = findTFJSModelPath()
    
    if (!modelDir) {
      console.log('CNN TensorFlow.js model not found. Expected at:')
      console.log('  - data/models/cnn/tfjs/model.json')
      console.log('  - public/models/cnn/tfjs/model.json')
      console.log('Convert CNN in notebook (TF.js) or see README')
      return false
    }
    
    console.log(`Loading CNN model from: ${modelDir}`)
    
    // Load model using file:// protocol for local files
    const modelUrl = `file://${modelDir}`
    cnnModel = await tf.loadLayersModel(modelUrl)
    
    console.log('✓ CNN model loaded successfully (TensorFlow.js)')
    return true
  } catch (error: any) {
    console.error('Error loading CNN model:', error.message)
    return false
  }
}

// Preprocess image from base64
// Uses jimp for image decoding (pure JavaScript, works everywhere)
async function preprocessImage(base64Data: string): Promise<tf.Tensor> {
  // Remove data URL prefix if present
  const base64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '')
  const buffer = Buffer.from(base64, 'base64')
  
  // Use jimp for image decoding (pure JavaScript, no native bindings)
  const Jimp = require('jimp')
  
  const image = await Jimp.read(buffer)
  
  // Resize to model input size
  image.resize(IMAGE_SIZE, IMAGE_SIZE)
  
  // Get pixel data
  const width = image.bitmap.width
  const height = image.bitmap.height
  const imageArray: number[][][] = []
  
  for (let y = 0; y < height; y++) {
    const row: number[][] = []
    for (let x = 0; x < width; x++) {
      const pixel = Jimp.intToRGBA(image.getPixelColor(x, y))
      row.push([pixel.r, pixel.g, pixel.b]) // RGB
    }
    imageArray.push(row)
  }
  
  // Convert to tensor
  const imageTensor = tf.tensor3d(imageArray)
  
  // Normalize to [0, 1]
  const normalized = imageTensor.div(255.0)
  
  // Add batch dimension
  const batched = normalized.expandDims(0)
  
  // Cleanup
  imageTensor.dispose()
  normalized.dispose()
  
  return batched
}

// Predict food class from base64 image
export async function predictCNN(imageBase64: string): Promise<{
  class: string
  label: string
  confidence: number
  top_5: Array<{ label: string; score: number }>
} | null> {
  try {
    // Load model if not loaded
    if (!cnnModel) {
      const loaded = await loadCNNModel()
      if (!loaded) {
        return null
      }
    }
    
    if (!cnnModel) {
      return null
    }
    
    // Preprocess image
    const imageTensor = await preprocessImage(imageBase64)
    
    // Make prediction
    const predictions = cnnModel.predict(imageTensor) as tf.Tensor
    
    // Get top 5 predictions (batch shape: [1, numClasses])
    const predictionsArray = (await predictions.array()) as number[][]
    const probs = predictionsArray[0]
    
    // Get top 5 indices
    const top5Indices = probs
      .map((prob, idx) => ({ prob, idx }))
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 5)
    
    // Get top prediction
    const topIndex = top5Indices[0].idx
    const topClass = FOOD_CLASSES[topIndex]
    const topConfidence = probs[topIndex]
    
    // Get top 5 results
    const top5 = top5Indices.map(({ prob, idx }) => ({
      label: FOOD_CLASSES[idx],
      score: prob
    }))
    
    // Cleanup tensors
    imageTensor.dispose()
    predictions.dispose()
    
    return {
      class: topClass,
      label: topClass.replace(/_/g, ' '),
      confidence: topConfidence,
      top_5: top5
    }
  } catch (error: any) {
    console.error('CNN prediction error:', error.message)
    return null
  }
}
