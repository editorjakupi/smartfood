// LSTM Model using TensorFlow.js
// Runs directly in Node.js without Python servers
// Works in both local development and serverless deployment (Vercel)
// Uses pure JavaScript TensorFlow.js (works with Node.js 24+)

import * as tf from '@tensorflow/tfjs'
import * as fs from 'fs'
import * as path from 'path'
import { loadManualLSTMWeights, predictManualLSTM } from './lstm-manual'

interface ScalerParams {
  min: number[]
  max: number[]
  features: string[]
}

interface ModelConfig {
  sequence_length: number
  features: string[]
  food_categories: string[]
  num_categories: number
  calories_mae: number
  calories_mape: number
  category_accuracy: number
}

interface HistoryEntry {
  date: string
  food_class: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
}

let lstmModel: tf.LayersModel | null = null
let scalerParams: ScalerParams | null = null
let modelConfig: ModelConfig | null = null
let useManualMode = false

// MultiHeadAttention implementation for TF.js deserialization
// Matches Keras weight names/shapes so model quality is preserved.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
class MultiHeadAttentionWrapper extends (tf.layers.Layer as any) {
  static className = 'MultiHeadAttention'

  private numHeads: number
  private keyDim: number
  private valueDim: number
  private dropout: number
  private useBias: boolean
  private attentionAxes?: number[]
  private outputShape?: number[] | null
  private inputDim = 0
  private outputDim = 0

  // Weights
  private queryKernel!: tf.LayerVariable
  private keyKernel!: tf.LayerVariable
  private valueKernel!: tf.LayerVariable
  private outputKernel!: tf.LayerVariable
  private queryBias?: tf.LayerVariable
  private keyBias?: tf.LayerVariable
  private valueBias?: tf.LayerVariable
  private outputBias?: tf.LayerVariable

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(config: any) {
    super(config)
    this.numHeads = config.numHeads ?? config.num_heads ?? 1
    this.keyDim = config.keyDim ?? config.key_dim ?? 0
    this.valueDim = config.valueDim ?? config.value_dim ?? this.keyDim
    this.dropout = config.dropout ?? 0
    this.useBias = config.useBias ?? config.use_bias ?? true
    this.attentionAxes = config.attentionAxes ?? config.attention_axes
    this.outputShape = config.outputShape ?? config.output_shape ?? null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  build(inputShape: any): void {
    const shapes = Array.isArray(inputShape) ? inputShape : [inputShape]
    const queryShape = shapes[0]
    const inputDim = queryShape[queryShape.length - 1]
    const outputDim = this.outputShape?.[this.outputShape.length - 1] ?? inputDim
    this.inputDim = inputDim
    this.outputDim = outputDim

    const kernelInit = tf.initializers.glorotUniform({})
    const biasInit = tf.initializers.zeros()

    this.queryKernel = this.addWeight(
      'query/kernel',
      [inputDim, this.numHeads, this.keyDim],
      'float32',
      kernelInit
    )
    this.keyKernel = this.addWeight(
      'key/kernel',
      [inputDim, this.numHeads, this.keyDim],
      'float32',
      kernelInit
    )
    this.valueKernel = this.addWeight(
      'value/kernel',
      [inputDim, this.numHeads, this.valueDim],
      'float32',
      kernelInit
    )
    this.outputKernel = this.addWeight(
      'attention_output/kernel',
      [this.numHeads, this.valueDim, outputDim],
      'float32',
      kernelInit
    )

    if (this.useBias) {
      this.queryBias = this.addWeight('query/bias', [this.numHeads, this.keyDim], 'float32', biasInit)
      this.keyBias = this.addWeight('key/bias', [this.numHeads, this.keyDim], 'float32', biasInit)
      this.valueBias = this.addWeight('value/bias', [this.numHeads, this.valueDim], 'float32', biasInit)
      this.outputBias = this.addWeight('attention_output/bias', [outputDim], 'float32', biasInit)
    }

    this.built = true
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  call(inputs: any, kwargs: any): any {
    return tf.tidy(() => {
      const inputsArr = Array.isArray(inputs) ? inputs : [inputs]
      const query = inputsArr[0]
      const value = inputsArr[1] ?? inputsArr[0]
      const key = inputsArr[2] ?? value

      const seqLenQ = query.shape[1] ?? 0
      const seqLenK = key.shape[1] ?? 0

      const q2d = tf.reshape(query, [-1, this.inputDim])
      const k2d = tf.reshape(key, [-1, this.inputDim])
      const v2d = tf.reshape(value, [-1, this.inputDim])

      const qKernel2d = tf.reshape(this.queryKernel.read(), [this.inputDim, this.numHeads * this.keyDim])
      const kKernel2d = tf.reshape(this.keyKernel.read(), [this.inputDim, this.numHeads * this.keyDim])
      const vKernel2d = tf.reshape(this.valueKernel.read(), [this.inputDim, this.numHeads * this.valueDim])

      let qProj = tf.matMul(q2d, qKernel2d)
      let kProj = tf.matMul(k2d, kKernel2d)
      let vProj = tf.matMul(v2d, vKernel2d)

      if (this.useBias) {
        const qBias = this.queryBias?.read()
        const kBias = this.keyBias?.read()
        const vBias = this.valueBias?.read()
        if (qBias) qProj = tf.add(qProj, qBias.reshape([1, this.numHeads * this.keyDim]))
        if (kBias) kProj = tf.add(kProj, kBias.reshape([1, this.numHeads * this.keyDim]))
        if (vBias) vProj = tf.add(vProj, vBias.reshape([1, this.numHeads * this.valueDim]))
      }

      const q = tf.reshape(qProj, [-1, seqLenQ, this.numHeads, this.keyDim])
      const k = tf.reshape(kProj, [-1, seqLenK, this.numHeads, this.keyDim])
      const v = tf.reshape(vProj, [-1, seqLenK, this.numHeads, this.valueDim])

      const qT = tf.transpose(q, [0, 2, 1, 3]) // [B, H, Tq, K]
      const kT = tf.transpose(k, [0, 2, 1, 3]) // [B, H, Tk, K]
      const vT = tf.transpose(v, [0, 2, 1, 3]) // [B, H, Tk, V]

      let scores = tf.matMul(qT, kT, false, true) // [B, H, Tq, Tk]
      const scale = 1 / Math.sqrt(this.keyDim)
      scores = tf.mul(scores, scale)

      let weights = tf.softmax(scores, -1)
      if (this.dropout > 0 && kwargs?.training) {
        weights = tf.dropout(weights, this.dropout)
      }

      const context = tf.matMul(weights, vT) // [B, H, Tq, V]
      const contextT = tf.transpose(context, [0, 2, 1, 3]) // [B, Tq, H, V]
      const context2d = tf.reshape(contextT, [-1, this.numHeads * this.valueDim])
      const outKernel2d = tf.reshape(this.outputKernel.read(), [this.numHeads * this.valueDim, this.outputDim])
      let output = tf.matMul(context2d, outKernel2d)
      if (this.useBias && this.outputBias) {
        output = tf.add(output, this.outputBias.read())
      }
      return tf.reshape(output, [-1, seqLenQ, this.outputDim])
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  computeOutputShape(inputShape: any): any {
    const shapes = Array.isArray(inputShape) ? inputShape : [inputShape]
    const queryShape = shapes[0]
    const inputDim = queryShape[queryShape.length - 1]
    const outputDim = this.outputShape?.[this.outputShape.length - 1] ?? inputDim
    return [queryShape[0], queryShape[1], outputDim]
  }

  getConfig(): tf.serialization.ConfigDict {
    return {
      ...super.getConfig(),
      numHeads: this.numHeads,
      keyDim: this.keyDim,
      valueDim: this.valueDim,
      dropout: this.dropout,
      useBias: this.useBias,
      attentionAxes: this.attentionAxes,
      outputShape: this.outputShape
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromConfig(config: any): MultiHeadAttentionWrapper {
    return new MultiHeadAttentionWrapper(config)
  }
}

// Map food classes to categories (breakfast, lunch, dinner, snack)
const FOOD_CATEGORY_MAP: Record<string, number> = {
  'bagel': 0, 'breakfast_burrito': 0, 'eggs_benedict': 0, 'french_toast': 0,
  'omelette': 0, 'pancakes': 0, 'waffles': 0,
  'beet_salad': 1, 'caprese_salad': 1, 'caesar_salad': 1, 'club_sandwich': 1,
  'croque_madame': 1, 'deviled_eggs': 1, 'falafel': 1, 'fish_and_chips': 1,
  'french_fries': 1, 'grilled_cheese_sandwich': 1, 'greek_salad': 1, 'hamburger': 1,
  'hot_dog': 1, 'hummus': 1, 'macaroni_and_cheese': 1, 'miso_soup': 1,
  'nachos': 1, 'onion_rings': 1, 'pad_thai': 1, 'pizza': 1,
  'pulled_pork_sandwich': 1, 'ramen': 1, 'samosa': 1, 'seaweed_salad': 1,
  'spring_rolls': 1, 'tacos': 1, 'takoyaki': 1, 'wings': 1,
  'baby_back_ribs': 2, 'beef_carpaccio': 2, 'beef_tartare': 2, 'bibimbap': 2,
  'crab_cakes': 2, 'filet_mignon': 2, 'fried_calamari': 2, 'fried_rice': 2,
  'grilled_salmon': 2, 'hot_and_sour_soup': 2, 'lasagna': 2, 'oysters': 2,
  'paella': 2, 'pork_chop': 2, 'poutine': 2, 'prime_rib': 2,
  'ravioli': 2, 'risotto': 2, 'sashimi': 2, 'scallops': 2,
  'shrimp_and_grits': 2, 'spaghetti_bolognese': 2, 'spaghetti_carbonara': 2,
  'steak': 2, 'sushi': 2, 'tuna_tartare': 2,
  'apple_pie': 3, 'beignets': 3, 'bread_pudding': 3, 'cannoli': 3,
  'carrot_cake': 3, 'cheesecake': 3, 'chocolate_cake': 3, 'churros': 3,
  'cup_cakes': 3, 'donuts': 3, 'frozen_yogurt': 3, 'ice_cream': 3,
  'macarons': 3, 'mussels': 3, 'panna_cotta': 3, 'red_velvet_cake': 3,
  'tiramisu': 3
}

const getDefaultCategory = (hour: number): number => {
  if (hour >= 6 && hour < 11) return 0
  if (hour >= 11 && hour < 15) return 1
  if (hour >= 15 && hour < 19) return 2
  return 3
}

// Paths to try relative to a base (project root or workspace root)
const LSTM_TFJS_REL = path.join('data', 'models', 'lstm', 'tfjs', 'model.json')
const LSTM_TFJS_PUBLIC = path.join('public', 'models', 'lstm', 'tfjs', 'model.json')
// When run from workspace root (e.g. Categories), smartfood can be nested here
const SMARTFOOD_UNDER_STUDY = path.join('studymodules', 'NBI Handlesakademin', 'AI - teori och tillämpning', 'del2', 'Kunskapkskontroll', 'del2', 'smartfood', 'data', 'models', 'lstm', 'tfjs', 'model.json')

function findTFJSModelPath(): string | null {
  let base = process.cwd()

  const tryBase = (b: string): string | null => {
    const p = path.join(b, LSTM_TFJS_REL)
    if (fs.existsSync(p)) return path.dirname(p)
    const pub = path.join(b, LSTM_TFJS_PUBLIC)
    if (fs.existsSync(pub)) return path.dirname(pub)
    const nested = path.join(b, SMARTFOOD_UNDER_STUDY)
    if (fs.existsSync(nested)) return path.dirname(nested)
    const smartfoodChild = path.join(b, 'smartfood', 'data', 'models', 'lstm', 'tfjs', 'model.json')
    if (fs.existsSync(smartfoodChild)) return path.dirname(smartfoodChild)
    return null
  }

  for (let i = 0; i < 8; i++) {
    const found = tryBase(base)
    if (found) return found
    const parent = path.dirname(base)
    if (parent === base) break
    base = parent
  }

  // Last resort: find any dir containing package.json with "name":"smartfood" and the model
  try {
    const searchRoot = process.cwd()
    const dirs = fs.readdirSync(searchRoot, { withFileTypes: true })
    for (const d of dirs) {
      if (!d.isDirectory()) continue
      const candidate = path.join(searchRoot, d.name, 'data', 'models', 'lstm', 'tfjs', 'model.json')
      if (fs.existsSync(candidate)) {
        const pkgPath = path.join(searchRoot, d.name, 'package.json')
        if (fs.existsSync(pkgPath)) {
          try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
            if (pkg && pkg.name === 'smartfood') return path.dirname(candidate)
          } catch { /* ignore */ }
        }
      }
    }
  } catch { /* ignore */ }

  return null
}

// Patch Keras 3.x model topology to TensorFlow.js compatible format
// Issues fixed:
// 1. InputLayer: batch_shape -> batchInputShape
// 2. dtype: {module, class_name, config} -> string
// 3. Regularizers: {module, class_name, config} -> {className, config} (keep uppercase L1/L2/L1L2)
// 4. Initializers: {module, class_name, config} -> {className, config}
// 5. Nested layers in Bidirectional wrappers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function patchKeras3Topology(topology: any): any {
  if (!topology) return topology

  // Convert Keras 3 serialization format to TF.js format
  // Keras 3: {module: "keras.regularizers", class_name: "L2", config: {l2: 0.001}, registered_name: null}
  // TF.js:   {className: "L1L2", config: {l1: 0, l2: 0.001}}  (TF.js only exposes L1L2)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function convertKeras3Object(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj
    if (Array.isArray(obj)) return obj.map(convertKeras3Object)

    // Check if this is a Keras 3 serialized object (has module and class_name)
    if (obj.module && obj.class_name) {
      const className = obj.class_name
      const moduleName = String(obj.module)
      const rawConfig = obj.config !== undefined && obj.config !== null
        ? convertKeras3Object(obj.config)
        : undefined

      // Regularizers: TF.js only provides L1L2 class
      if (moduleName.includes('regularizers')) {
        if (className === 'L2') {
          return { className: 'L1L2', config: { l1: 0, l2: rawConfig?.l2 ?? 0 } }
        }
        if (className === 'L1') {
          return { className: 'L1L2', config: { l1: rawConfig?.l1 ?? 0, l2: 0 } }
        }
        if (className === 'L1L2') {
          return { className: 'L1L2', config: { l1: rawConfig?.l1 ?? 0, l2: rawConfig?.l2 ?? 0 } }
        }
      }

      // Initializers/constraints/etc: keep className uppercase (GlorotUniform, Zeros, Orthogonal, etc.)
      const converted: any = { className }
      if (rawConfig !== undefined) {
        converted.config = rawConfig
      }
      return converted
    }

    // Recursively convert nested objects
    const result: any = {}
    for (const key of Object.keys(obj)) {
      result[key] = convertKeras3Object(obj[key])
    }
    return result
  }

  // Convert Keras 3 inbound_nodes to TF.js nodeData format
  // Keras 3: [{ args: [{class_name:"__keras_tensor__", config:{keras_history:[name, node, tensor]}}, ...], kwargs: {...}}]
  // TF.js:   [ [ [name, node, tensor, kwargs?], ... ] ]
  function patchInboundNodes(layer: any): void {
    const inbound = layer?.inbound_nodes
    if (!Array.isArray(inbound)) return

    const toNodeData = (arg: any, kwargs: any) => {
      const history = arg?.config?.keras_history
      if (!Array.isArray(history) || history.length < 3) return null
      return [history[0], history[1], history[2], kwargs ?? {}]
    }

    const patched = inbound.map((node: any) => {
      // If already array format, keep it
      if (Array.isArray(node)) return node

      const argsRaw = Array.isArray(node?.args) ? node.args : []
      const kwargs = node?.kwargs ?? {}
      const args = argsRaw.length === 1 && Array.isArray(argsRaw[0]) ? argsRaw[0] : argsRaw
      const nodeData = args.map((arg: any) => toNodeData(arg, kwargs)).filter(Boolean)
      return [nodeData]
    })

    layer.inbound_nodes = patched
  }

  // Patch a single layer config
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function patchLayerConfig(layer: any): void {
    if (!layer) return

    // Remove module and registered_name from layer (TF.js doesn't need them)
    if (layer.module) delete layer.module
    if (layer.registered_name !== undefined) delete layer.registered_name
    if (layer.build_config !== undefined) delete layer.build_config

    patchInboundNodes(layer)
    if (!layer.config) return

    // MultiHeadAttention config: snake_case -> camelCase for TF.js
    if (layer.class_name === 'MultiHeadAttention') {
      const c = layer.config
      if (c.num_heads !== undefined && c.numHeads === undefined) c.numHeads = c.num_heads
      if (c.key_dim !== undefined && c.keyDim === undefined) c.keyDim = c.key_dim
      if (c.value_dim !== undefined && c.valueDim === undefined) c.valueDim = c.value_dim
      if (c.attention_axes !== undefined && c.attentionAxes === undefined) c.attentionAxes = c.attention_axes
      if (c.use_bias !== undefined && c.useBias === undefined) c.useBias = c.use_bias
      if (c.output_shape !== undefined && c.outputShape === undefined) c.outputShape = c.output_shape
      // Keep both names to be safe; TF.js will use camelCase
    }

    // InputLayer: batch_shape -> batchInputShape
    if (layer.class_name === 'InputLayer') {
      if (layer.config.batch_shape && !layer.config.batchInputShape) {
        layer.config.batchInputShape = layer.config.batch_shape
        delete layer.config.batch_shape
      }
    }

    // Convert dtype from Keras 3 DTypePolicy object to string
    if (layer.config.dtype && typeof layer.config.dtype === 'object') {
      layer.config.dtype = layer.config.dtype.config?.name || 'float32'
    }

    // Keys that may contain Keras 3 serialized objects
    const keysToConvert = [
      // Regularizers
      'kernel_regularizer', 'bias_regularizer', 'activity_regularizer', 'recurrent_regularizer',
      // Initializers
      'kernel_initializer', 'bias_initializer', 'recurrent_initializer',
      // Constraints
      'kernel_constraint', 'bias_constraint', 'recurrent_constraint'
    ]

    for (const key of keysToConvert) {
      if (layer.config[key] && typeof layer.config[key] === 'object') {
        layer.config[key] = convertKeras3Object(layer.config[key])
      }
    }

    // Handle nested layers in Bidirectional, TimeDistributed, etc.
    // Keras 3 stores them as {module, class_name, config, registered_name, build_config}
    const nestedLayerKeys = ['layer', 'backward_layer', 'forward_layer']
    for (const nlKey of nestedLayerKeys) {
      if (layer.config[nlKey] && typeof layer.config[nlKey] === 'object') {
        const nested = layer.config[nlKey]
        // If it's a Keras 3 serialized layer, clean it up
        if (nested.module) delete nested.module
        if (nested.registered_name !== undefined) delete nested.registered_name
        if (nested.build_config !== undefined) delete nested.build_config
        // Recursively patch the nested layer
        patchLayerConfig(nested)
      }
    }
  }

  // Handle model_config.config.layers array (Keras 3 Functional model format)
  if (topology.model_config?.config?.layers) {
    for (const layer of topology.model_config.config.layers) {
      patchLayerConfig(layer)
    }
  }

  // Also check top-level config.layers (Sequential or older format)
  if (topology.config?.layers) {
    for (const layer of topology.config.layers) {
      patchLayerConfig(layer)
    }
  }

  return topology
}

// Load LSTM model and configs
function registerMultiHeadAttention(): void {
  const tryRegister = (Ctor: any) => {
    if (Ctor) {
      try {
        tf.serialization.registerClass(Ctor)
      } catch {
        // Ignore duplicate registration
      }
    }
  }

  // Always register wrapper to ensure deserialization works
  tryRegister(MultiHeadAttentionWrapper)
}

export async function loadLSTMModelTFJS(): Promise<boolean> {
  if (useManualMode && scalerParams !== null && modelConfig !== null) {
    return true
  }
  
  try {
    // Ensure backend is initialized
    try {
      await tf.setBackend('cpu')
    } catch {
      // ignore if backend already set
    }
    await tf.ready()
    console.log(`TF.js backend: ${tf.getBackend()}`)

    const tfjsModelDir = findTFJSModelPath()
    if (!tfjsModelDir) {
      console.log('LSTM TensorFlow.js model not found. Expected at:')
      console.log('  - data/models/lstm/tfjs/model.json (relative to project root or a parent)')
      console.log('  - Checked from cwd:', process.cwd())
      return false
    }

    const modelDir = path.dirname(tfjsModelDir)
    const scalerPath = path.join(modelDir, 'scaler_params.json')
    const configPath = path.join(modelDir, 'model_config.json')

    if (!fs.existsSync(scalerPath) || !fs.existsSync(configPath)) {
      console.log('LSTM config files not found at', modelDir)
      return false
    }
    
    // Load scaler params
    const scalerData = fs.readFileSync(scalerPath, 'utf-8')
    scalerParams = JSON.parse(scalerData) as ScalerParams
    
    // Load model config
    const configData = fs.readFileSync(configPath, 'utf-8')
    modelConfig = JSON.parse(configData) as ModelConfig
    
    console.log(`Loading LSTM model from: ${tfjsModelDir}`)
    const loadStart = Date.now()
    
    // Use fast manual mode directly (instant loading, same accuracy)
    console.log('Using optimized manual mode (instant loading)...')
    
    // Load weights in manual mode
    const success = await loadManualLSTMWeights(tfjsModelDir)
    if (success) {
      useManualMode = true
      const loadTime = Date.now() - loadStart
      console.log(`✓ LSTM model loaded in ${loadTime}ms (optimized mode)`)
      console.log(`  Model accuracy: ${(modelConfig.category_accuracy * 100).toFixed(1)}%`)
      console.log(`  Calories MAE: ${modelConfig.calories_mae.toFixed(1)} kcal`)
      return true
    }
    
    console.error('Failed to load LSTM weights')
    return false
  } catch (error: any) {
    console.error(`LSTM load error: ${error.message}`)
    return false
  }
}

// Normalize features using scaler params
function normalizeFeatures(features: number[]): number[] {
  if (!scalerParams) return features
  
  return features.map((val, idx) => {
    const min = scalerParams!.min[idx]
    const max = scalerParams!.max[idx]
    return (val - min) / (max - min)
  })
}

// Prepare sequence from history
function prepareSequence(history: HistoryEntry[]): number[][] | null {
  if (!modelConfig || !scalerParams) return null
  
  const SEQUENCE_LENGTH = modelConfig.sequence_length
  
  if (history.length < SEQUENCE_LENGTH) {
    return null
  }
  
  const recentHistory = history.slice(-SEQUENCE_LENGTH)
  const sequence: number[][] = []
  
  for (const entry of recentHistory) {
    const date = new Date(entry.date)
    const hour = date.getHours()
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0
    
    const foodClassLower = entry.food_class.toLowerCase().trim()
    let category = FOOD_CATEGORY_MAP[foodClassLower]
    
    if (category === undefined) {
      const normalized = foodClassLower.replace(/[\s_-]/g, '_')
      category = FOOD_CATEGORY_MAP[normalized]
    }
    
    if (category === undefined) {
      category = getDefaultCategory(hour)
    }
    
    let mealNumber = 0
    if (hour >= 6 && hour < 11) mealNumber = 0
    else if (hour >= 11 && hour < 15) mealNumber = 1
    else if (hour >= 15 && hour < 19) mealNumber = 2
    else mealNumber = 3
    
    const featureVector = [
      entry.calories,
      category,
      hour,
      dayOfWeek,
      isWeekend,
      entry.protein || 0,
      entry.carbs || 0,
      entry.fat || 0,
      mealNumber
    ]
    
    const normalized = normalizeFeatures(featureVector)
    sequence.push(normalized)
  }
  
  return sequence
}

// Predict using LSTM model
export async function predictLSTM(history: HistoryEntry[]): Promise<{
  calories: number
  category: number
  categoryConfidence: number
} | null> {
  try {
    // Load model if not loaded (uses optimized manual mode)
    if (!useManualMode) {
      const loaded = await loadLSTMModelTFJS()
      if (!loaded) {
        return null
      }
    }
    
    if (!scalerParams || !modelConfig) {
      return null
    }
    
    const sequence = prepareSequence(history)
    if (!sequence) {
      return null
    }
    
    // Use manual mode if enabled (faster on CPU)
    if (useManualMode) {
      const result = await predictManualLSTM(sequence)
      if (result) {
        // Denormalize calories
        const calMin = scalerParams.min[0]
        const calMax = scalerParams.max[0]
        const predictedCalories = result.calories * (calMax - calMin) + calMin
        
        return {
          calories: predictedCalories,
          category: result.category,
          categoryConfidence: result.categoryConfidence
        }
      }
      return null
    }
    
    // Use full model if loaded
    if (!lstmModel) {
      return null
    }
    
    // Convert to tensor
    const sequenceTensor = tf.tensor3d([sequence])
    
    // Make prediction
    const predictions = lstmModel.predict(sequenceTensor) as tf.Tensor[]
    
    // Get outputs
    const caloriesPred = await predictions[0].array() // calories output
    const categoryPred = await predictions[1].array() // category probabilities
    
    const calories = (caloriesPred as number[][])[0][0]
    const categoryProbs = (categoryPred as number[][])[0]
    
    // Denormalize calories
    const calMin = scalerParams.min[0]
    const calMax = scalerParams.max[0]
    const predictedCalories = calories * (calMax - calMin) + calMin
    
    // Get category
    const categoryIndex = categoryProbs.indexOf(Math.max(...categoryProbs))
    const categoryConfidence = categoryProbs[categoryIndex]
    
    // Cleanup tensors
    sequenceTensor.dispose()
    predictions.forEach(t => t.dispose())
    
    return {
      calories: predictedCalories,
      category: categoryIndex,
      categoryConfidence: categoryConfidence
    }
  } catch (error: any) {
    console.error('LSTM prediction error:', error.message)
    return null
  }
}
