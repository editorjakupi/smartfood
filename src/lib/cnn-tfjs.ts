// CNN Model using TensorFlow.js
// (Node backend is loaded in classify route before this module is imported.)
import * as tf from '@tensorflow/tfjs'
import * as fs from 'fs'
import * as path from 'path'

// Register Keras 3 Normalization layer (not in TF.js by default)
// This is a pass-through layer when mean/variance are null (no normalization applied)
class Normalization extends tf.layers.Layer {
  static className = 'Normalization'
  private mean: tf.Tensor | null = null
  private variance: tf.Tensor | null = null
  private axis: number[]
  private invert: boolean

  constructor(config: any) {
    super(config)
    this.axis = config.axis || [-1]
    this.invert = config.invert || false
    // mean and variance can be set later via adapt() but for pretrained models they're often null (no-op)
  }

  call(inputs: tf.Tensor | tf.Tensor[]): tf.Tensor | tf.Tensor[] {
    return tf.tidy(() => {
      const input = Array.isArray(inputs) ? inputs[0] : inputs
      // If mean/variance not set, pass through unchanged (common in pretrained EfficientNet)
      if (this.mean == null || this.variance == null) {
        return input
      }
      // Apply normalization: (x - mean) / sqrt(variance + epsilon)
      const normalized = tf.sub(input, this.mean)
      const std = tf.sqrt(tf.add(this.variance, 1e-7))
      return this.invert ? tf.mul(normalized, std) : tf.div(normalized, std)
    })
  }

  getConfig(): any {
    const config = super.getConfig()
    return { ...config, axis: this.axis, invert: this.invert }
  }
}

// Register the custom layer so TF.js can deserialize it
tf.serialization.registerClass(Normalization)

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

const IMAGE_SIZE = 224 // EfficientNet/ResNet input size
let cnnModel: tf.LayersModel | null = null
let classNames: string[] = [...FOOD_CLASSES] // use saved class_names.json when present

// Find TensorFlow.js model directory (same path as notebook output: data/models/cnn/tfjs)
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

// Load class names from notebook output (data/models/cnn/class_names.json) so order matches trained model
function loadClassNames(): void {
  const candidates = [
    path.join(process.cwd(), 'data', 'models', 'cnn', 'class_names.json'),
    path.join(process.cwd(), 'public', 'models', 'cnn', 'class_names.json')
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf-8')
        const parsed = JSON.parse(raw) as string[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          classNames = parsed
          return
        }
      } catch {
        // keep default
      }
      break
    }
  }
}

// Keras 3 uses different format than TF.js expects. Patch:
// 1. InputLayer: batch_shape -> batchInputShape (not both batchInputShape and inputShape)
// 2. inbound_nodes: Keras 3 uses {args:[...], kwargs:{}} but TF.js expects [[...]]
// 3. activation: 'silu' -> 'swish' (TF.js has swish but not silu alias)
function patchTopologyForTFJS(topology: any): any {
  if (!topology) return topology
  const out = JSON.parse(JSON.stringify(topology))
  
  function convertInboundNodes(nodes: any): any {
    if (!Array.isArray(nodes)) return nodes
    return nodes.map((node: any) => {
      // Keras 3: {args: [{class_name: "__keras_tensor__", config: {keras_history: [...]}}, ...], kwargs: {}}
      // TF.js: [[keras_history, ...], ...]
      if (node && typeof node === 'object' && node.args && Array.isArray(node.args)) {
        return node.args.map((arg: any) => {
          if (arg && arg.class_name === '__keras_tensor__' && arg.config && arg.config.keras_history) {
            return arg.config.keras_history
          }
          return arg
        })
      }
      return node
    })
  }
  
  function walk(obj: any): void {
    if (!obj || typeof obj !== 'object') return
    if (Array.isArray(obj)) {
      obj.forEach(walk)
      return
    }
    
    // Fix InputLayer config
    if (obj.class_name === 'InputLayer' && obj.config) {
      const c = obj.config
      if (c.batchInputShape == null) {
        if (c.batch_shape != null) {
          c.batchInputShape = c.batch_shape
        } else if (c.input_shape != null) {
          c.batchInputShape = [null, ...(Array.isArray(c.input_shape) ? c.input_shape : [c.input_shape])]
        }
      }
      if (c.batchInputShape != null && c.inputShape != null) delete c.inputShape
    }
    
    // Fix activation: silu -> swish (TF.js knows swish but not silu)
    if (obj.config && typeof obj.config.activation === 'string' && obj.config.activation === 'silu') {
      obj.config.activation = 'swish'
    }
    
    // Fix inbound_nodes format (all layers)
    if (obj.inbound_nodes && Array.isArray(obj.inbound_nodes)) {
      obj.inbound_nodes = convertInboundNodes(obj.inbound_nodes)
    }
    
    for (const key of Object.keys(obj)) {
      walk(obj[key])
    }
  }
  
  walk(out)
  return out
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
    
    loadClassNames()
    console.log(`Loading CNN model from: ${modelDir}`)
    
    // In Node/Next.js, fetch('file://...') fails. Load from filesystem via custom IO handler (same idea as LSTM manual path).
    const modelJsonPath = path.join(modelDir, 'model.json')
    console.log('Reading model.json...')
    const modelJson = JSON.parse(fs.readFileSync(modelJsonPath, 'utf-8')) as {
      modelTopology: object
      weightsManifest: Array<{ paths: string[]; weights: Array<{ name: string; shape: number[]; dtype: string }> }>
    }
    console.log('Reading weight shards...')
    const manifest = modelJson.weightsManifest[0]
    const shardBuffers: Buffer[] = []
    for (const relPath of manifest.paths) {
      shardBuffers.push(fs.readFileSync(path.join(modelDir, relPath)))
    }
    console.log(`Concatenating ${shardBuffers.length} weight shards...`)
    const concat = Buffer.concat(shardBuffers)
    const weightArrayBuffer = concat.buffer.slice(concat.byteOffset, concat.byteOffset + concat.byteLength)
    console.log('Patching topology for TF.js compatibility...')
    const topology = patchTopologyForTFJS(modelJson.modelTopology)
    console.log('Creating IO handler...')
    const handler: tf.io.IOHandler = {
      load: async () => ({
        modelTopology: topology,
        weightSpecs: manifest.weights as tf.io.WeightsManifestEntry[],
        weightData: weightArrayBuffer
      })
    }
    console.log('Loading model with TensorFlow.js...')
    cnnModel = await tf.loadLayersModel(handler)
    
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
  
  // Convert to tensor [H, W, 3]
  const imageTensor = tf.tensor3d(imageArray)
  
  // EfficientNet (and notebook) expects ImageNet normalization: (x/255 - mean) / std per channel.
  const mean = [0.485, 0.456, 0.406]
  const std = [0.229, 0.224, 0.225]
  const scaled = imageTensor.div(255.0)
  const normalized = tf.sub(scaled, mean).div(std)
  const batched = normalized.expandDims(0)
  imageTensor.dispose()
  scaled.dispose()
  // Do not dispose normalized; batched shares its buffer and caller disposes batched
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
    
    // Get top 5 indices (use classNames from class_names.json when loaded)
    const top5Indices = probs
      .map((prob, idx) => ({ prob, idx }))
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 5)
    
    const topIndex = top5Indices[0].idx
    const topClass = classNames[topIndex] ?? FOOD_CLASSES[topIndex] ?? `class_${topIndex}`
    const topConfidence = probs[topIndex]
    
    const top5 = top5Indices.map(({ prob, idx }) => ({
      label: classNames[idx] ?? FOOD_CLASSES[idx] ?? `class_${idx}`,
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
