#!/usr/bin/env python3
"""
Generate CNN Training Notebook
Creates a complete Jupyter notebook for training CNN food classifier with automatic TensorFlow.js conversion
"""

import json
import os

def create_notebook():
    """Create the complete CNN training notebook"""
    
    notebook = {
        "cells": [],
        "metadata": {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3"
            },
            "language_info": {
                "name": "python",
                "version": "3.11.0"
            }
        },
        "nbformat": 4,
        "nbformat_minor": 4
    }
    
    # Cell 0: Title and description
    notebook["cells"].append({
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "# Food Classification with CNN - Transfer Learning\n",
            "\n",
            "Training a food classifier using transfer learning with EfficientNetB4 on Food-101 dataset.\n",
            "\n",
            "This notebook implements a two-phase training approach:\n",
            "1. Phase 1: Train classification head with frozen EfficientNetB4 base\n",
            "2. Phase 2: Fine-tune entire model with lower learning rate\n",
            "\n",
            "Target accuracy: 80%+ Top-1 accuracy on Food-101 validation set."
        ]
    })
    
    # Cell 1: Imports and GPU setup
    notebook["cells"].append({
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "import os\n",
            "import json\n",
            "import numpy as np\n",
            "import matplotlib.pyplot as plt\n",
            "from datetime import datetime\n",
            "\n",
            "import tensorflow as tf\n",
            "import tensorflow_datasets as tfds\n",
            "from tensorflow.keras.applications import EfficientNetB4\n",
            "from tensorflow.keras.layers import Dense, Dropout, GlobalAveragePooling2D, BatchNormalization\n",
            "from tensorflow.keras.models import Sequential\n",
            "from tensorflow.keras.optimizers import Adam\n",
            "from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping, ReduceLROnPlateau, CSVLogger\n",
            "from sklearn.metrics import confusion_matrix, classification_report\n",
            "\n",
            "print(f'TensorFlow version: {tf.__version__}')\n",
            "\n",
            "# GPU Configuration\n",
            "gpus = tf.config.list_physical_devices('GPU')\n",
            "if gpus:\n",
            "    print(f'Found {len(gpus)} GPU(s)')\n",
            "    for gpu in gpus:\n",
            "        try:\n",
            "            tf.config.experimental.set_memory_growth(gpu, True)\n",
            "        except RuntimeError as e:\n",
            "            print(f'GPU memory growth error: {e}')\n",
            "    print('GPU memory growth enabled')\n",
            "else:\n",
            "    print('No GPU detected, using CPU')\n",
            "\n",
            "tf.random.set_seed(42)\n",
            "np.random.seed(42)"
        ]
    })
    
    # Cell 2: Configuration header
    notebook["cells"].append({
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "## Configuration and Hyperparameters"
        ]
    })
    
    # Cell 3: Configuration code
    notebook["cells"].append({
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "# Hyperparameters\n",
            "IMAGE_SIZE = 224\n",
            "NUM_CLASSES = 101\n",
            "\n",
            "# Batch size - adjust based on GPU memory\n",
            "if gpus:\n",
            "    BATCH_SIZE = 32\n",
            "else:\n",
            "    BATCH_SIZE = 8\n",
            "\n",
            "# Training configuration\n",
            "INITIAL_EPOCHS = 30\n",
            "FINETUNE_EPOCHS = 15\n",
            "\n",
            "INITIAL_LR = 0.001\n",
            "FINETUNE_LR = 0.0001\n",
            "\n",
            "LABEL_SMOOTHING = 0.1\n",
            "UNFREEZE_LAYERS = 50\n",
            "\n",
            "EARLY_STOPPING_PATIENCE = 10\n",
            "LR_PATIENCE = 5\n",
            "\n",
            "# Paths - ensure model is saved to correct location\n",
            "current_dir = os.getcwd()\n",
            "\n",
            "# Find project root by looking for 'src' directory or 'smartfood' directory\n",
            "if os.path.exists(os.path.join(current_dir, 'src')):\n",
            "    PROJECT_ROOT = current_dir\n",
            "elif 'notebooks' in current_dir:\n",
            "    # If running from notebooks/cnn/, go up two levels\n",
            "    parts = current_dir.split(os.sep)\n",
            "    if 'notebooks' in parts:\n",
            "        idx = parts.index('notebooks')\n",
            "        PROJECT_ROOT = os.sep.join(parts[:idx])\n",
            "    else:\n",
            "        PROJECT_ROOT = os.path.dirname(os.path.dirname(current_dir))\n",
            "else:\n",
            "    # Try to find smartfood directory\n",
            "    test_path = current_dir\n",
            "    while test_path != os.path.dirname(test_path):\n",
            "        if os.path.exists(os.path.join(test_path, 'src')) or os.path.basename(test_path) == 'smartfood':\n",
            "            PROJECT_ROOT = test_path\n",
            "            break\n",
            "        test_path = os.path.dirname(test_path)\n",
            "    else:\n",
            "        PROJECT_ROOT = current_dir\n",
            "\n",
            "# Model save directory - absolute path to ensure correct location\n",
            "BASE_DIR = os.path.join(PROJECT_ROOT, 'data', 'models', 'cnn')\n",
            "os.makedirs(BASE_DIR, exist_ok=True)\n",
            "\n",
            "MODEL_PATH = os.path.join(BASE_DIR, 'food_classifier_best.keras')\n",
            "HISTORY_PATH = os.path.join(BASE_DIR, 'training_history.json')\n",
            "\n",
            "print(f'Project root: {PROJECT_ROOT}')\n",
            "print(f'Model save directory: {BASE_DIR}')\n",
            "print(f'Model save path: {MODEL_PATH}')\n",
            "print(f'Batch size: {BATCH_SIZE}')\n",
            "print(f'Image size: {IMAGE_SIZE}x{IMAGE_SIZE}')"
        ]
    })
    
    # Cell 4: Dataset header
    notebook["cells"].append({
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "## Load Dataset\n",
            "\n",
            "Food-101 contains 101,000 images across 101 food categories."
        ]
    })
    
    # Cell 5: Load dataset
    notebook["cells"].append({
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "# Load Food-101 dataset\n",
            "print('Loading Food-101 dataset...')\n",
            "\n",
            "TFDS_CACHE_DIR = os.path.join(PROJECT_ROOT, 'data', 'tfds')\n",
            "os.makedirs(TFDS_CACHE_DIR, exist_ok=True)\n",
            "\n",
            "(train_ds, val_ds), info = tfds.load(\n",
            "    'food101',\n",
            "    split=['train[:90%]', 'train[90%:]'],\n",
            "    with_info=True,\n",
            "    as_supervised=True,\n",
            "    data_dir=TFDS_CACHE_DIR\n",
            ")\n",
            "\n",
            "test_ds = tfds.load('food101', split='validation', as_supervised=True, data_dir=TFDS_CACHE_DIR)\n",
            "\n",
            "class_names = info.features['label'].names\n",
            "\n",
            "print(f'\\nDataset loaded successfully!')\n",
            "print(f'Classes: {len(class_names)}')\n",
            "print(f'Train samples: {int(info.splits[\"train\"].num_examples * 0.9):,}')\n",
            "print(f'Validation samples: {int(info.splits[\"train\"].num_examples * 0.1):,}')\n",
            "print(f'Test samples: {info.splits[\"validation\"].num_examples:,}')"
        ]
    })
    
    # Cell 6: Preprocessing header
    notebook["cells"].append({
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "## Data Preprocessing and Augmentation"
        ]
    })
    
    # Cell 7: Preprocessing code
    notebook["cells"].append({
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "def preprocess(image, label):\n",
            "    image = tf.image.resize(image, (IMAGE_SIZE, IMAGE_SIZE))\n",
            "    image = tf.cast(image, tf.float32) / 255.0\n",
            "    label = tf.one_hot(label, NUM_CLASSES)\n",
            "    return image, label\n",
            "\n",
            "def augment(image, label):\n",
            "    image = tf.image.random_flip_left_right(image)\n",
            "    image = tf.image.random_brightness(image, 0.2)\n",
            "    image = tf.image.random_contrast(image, 0.8, 1.2)\n",
            "    image = tf.clip_by_value(image, 0.0, 1.0)\n",
            "    return image, label\n",
            "\n",
            "AUTOTUNE = tf.data.AUTOTUNE\n",
            "\n",
            "# Training dataset with augmentation\n",
            "train_dataset = (\n",
            "    train_ds\n",
            "    .map(preprocess, num_parallel_calls=AUTOTUNE)\n",
            "    .map(augment, num_parallel_calls=AUTOTUNE)\n",
            "    .cache()\n",
            "    .shuffle(1000)\n",
            "    .batch(BATCH_SIZE)\n",
            "    .prefetch(AUTOTUNE)\n",
            ")\n",
            "\n",
            "# Validation dataset without augmentation\n",
            "val_dataset = (\n",
            "    val_ds\n",
            "    .map(preprocess, num_parallel_calls=AUTOTUNE)\n",
            "    .cache()\n",
            "    .batch(BATCH_SIZE)\n",
            "    .prefetch(AUTOTUNE)\n",
            ")\n",
            "\n",
            "# Test dataset\n",
            "test_dataset = (\n",
            "    test_ds\n",
            "    .map(preprocess, num_parallel_calls=AUTOTUNE)\n",
            "    .cache()\n",
            "    .batch(BATCH_SIZE)\n",
            "    .prefetch(AUTOTUNE)\n",
            ")\n",
            "\n",
            "print('Dataset preprocessing complete')"
        ]
    })
    
    # Cell 8: Model header
    notebook["cells"].append({
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "## Build Model\n",
            "\n",
            "Using EfficientNetB4 as base model with transfer learning."
        ]
    })
    
    # Cell 9: Build model
    notebook["cells"].append({
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "def create_model(num_classes, freeze_base=True):\n",
            "    base_model = EfficientNetB4(\n",
            "        weights='imagenet',\n",
            "        include_top=False,\n",
            "        input_shape=(IMAGE_SIZE, IMAGE_SIZE, 3)\n",
            "    )\n",
            "    base_model.trainable = not freeze_base\n",
            "    \n",
            "    model = Sequential([\n",
            "        base_model,\n",
            "        GlobalAveragePooling2D(),\n",
            "        BatchNormalization(),\n",
            "        Dense(512, activation='relu'),\n",
            "        Dropout(0.5),\n",
            "        BatchNormalization(),\n",
            "        Dense(num_classes, activation='softmax')\n",
            "    ])\n",
            "    \n",
            "    return model, base_model\n",
            "\n",
            "model, base_model = create_model(NUM_CLASSES, freeze_base=True)\n",
            "\n",
            "model.compile(\n",
            "    optimizer=Adam(learning_rate=INITIAL_LR),\n",
            "    loss=tf.keras.losses.CategoricalCrossentropy(label_smoothing=LABEL_SMOOTHING),\n",
            "    metrics=['accuracy', tf.keras.metrics.TopKCategoricalAccuracy(k=5, name='top5_accuracy')]\n",
            ")\n",
            "\n",
            "print(f'Model created')\n",
            "print(f'Total parameters: {model.count_params():,}')\n",
            "trainable = sum([tf.size(w).numpy() for w in model.trainable_weights])\n",
            "print(f'Trainable parameters: {trainable:,}')"
        ]
    })
    
    # Cell 10: Callbacks header
    notebook["cells"].append({
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "## Training Callbacks"
        ]
    })
    
    # Cell 11: Callbacks code
    notebook["cells"].append({
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "checkpoint = ModelCheckpoint(\n",
            "    MODEL_PATH,\n",
            "    monitor='val_accuracy',\n",
            "    save_best_only=True,\n",
            "    mode='max',\n",
            "    verbose=1\n",
            ")\n",
            "\n",
            "early_stopping = EarlyStopping(\n",
            "    monitor='val_accuracy',\n",
            "    patience=EARLY_STOPPING_PATIENCE,\n",
            "    restore_best_weights=True,\n",
            "    verbose=1\n",
            ")\n",
            "\n",
            "reduce_lr = ReduceLROnPlateau(\n",
            "    monitor='val_loss',\n",
            "    factor=0.5,\n",
            "    patience=LR_PATIENCE,\n",
            "    min_lr=1e-7,\n",
            "    verbose=1\n",
            ")\n",
            "\n",
            "csv_logger = CSVLogger(os.path.join(BASE_DIR, 'training_log.csv'))\n",
            "\n",
            "callbacks = [checkpoint, early_stopping, reduce_lr, csv_logger]\n",
            "print('Callbacks configured')"
        ]
    })
    
    # Cell 12: Phase 1 header
    notebook["cells"].append({
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "## Phase 1: Train Classification Head\n",
            "\n",
            "Train only the new classification layers while keeping EfficientNetB4 base frozen."
        ]
    })
    
    # Cell 13: Phase 1 training
    notebook["cells"].append({
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "print(f'Phase 1: Training classification head ({INITIAL_EPOCHS} epochs max)')\n",
            "print(f'Batch size: {BATCH_SIZE}')\n",
            "print('Starting training...')\n",
            "start_time = datetime.now()\n",
            "\n",
            "history_phase1 = model.fit(\n",
            "    train_dataset,\n",
            "    epochs=INITIAL_EPOCHS,\n",
            "    validation_data=val_dataset,\n",
            "    callbacks=callbacks,\n",
            "    verbose=1\n",
            ")\n",
            "\n",
            "phase1_time = datetime.now() - start_time\n",
            "print(f'\\nPhase 1 completed in {phase1_time}')"
        ]
    })
    
    # Cell 14: Phase 2 header
    notebook["cells"].append({
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "## Phase 2: Fine-tune Model\n",
            "\n",
            "Unfreeze top layers of EfficientNetB4 and fine-tune with lower learning rate."
        ]
    })
    
    # Cell 15: Phase 2 training
    notebook["cells"].append({
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "# Unfreeze top layers\n",
            "base_model.trainable = True\n",
            "for layer in base_model.layers[:-UNFREEZE_LAYERS]:\n",
            "    layer.trainable = False\n",
            "\n",
            "# Recompile with lower learning rate\n",
            "model.compile(\n",
            "    optimizer=Adam(learning_rate=FINETUNE_LR),\n",
            "    loss=tf.keras.losses.CategoricalCrossentropy(label_smoothing=LABEL_SMOOTHING),\n",
            "    metrics=['accuracy', tf.keras.metrics.TopKCategoricalAccuracy(k=5, name='top5_accuracy')]\n",
            ")\n",
            "\n",
            "trainable = sum([tf.size(w).numpy() for w in model.trainable_weights])\n",
            "print(f'Fine-tuning {trainable:,} parameters')\n",
            "\n",
            "print(f'\\nPhase 2: Fine-tuning ({FINETUNE_EPOCHS} epochs max)')\n",
            "start_time = datetime.now()\n",
            "\n",
            "history_phase2 = model.fit(\n",
            "    train_dataset,\n",
            "    epochs=FINETUNE_EPOCHS,\n",
            "    validation_data=val_dataset,\n",
            "    callbacks=callbacks,\n",
            "    verbose=1\n",
            ")\n",
            "\n",
            "phase2_time = datetime.now() - start_time\n",
            "print(f'\\nPhase 2 completed in {phase2_time}')"
        ]
    })
    
    # Cell 16: Evaluation header
    notebook["cells"].append({
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "## Evaluation\n",
            "\n",
            "Evaluate the best model on test set."
        ]
    })
    
    # Cell 17: Evaluation code
    notebook["cells"].append({
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "# Load best model\n",
            "model.load_weights(MODEL_PATH)\n",
            "\n",
            "# Evaluate on test set\n",
            "print('Evaluating on test set...')\n",
            "test_results = model.evaluate(test_dataset, verbose=1)\n",
            "\n",
            "test_loss = test_results[0]\n",
            "test_accuracy = test_results[1]\n",
            "test_top5 = test_results[2]\n",
            "\n",
            "print(f'\\nTest Results:')\n",
            "print(f'  Loss: {test_loss:.4f}')\n",
            "print(f'  Top-1 Accuracy: {test_accuracy*100:.2f}%')\n",
            "print(f'  Top-5 Accuracy: {test_top5*100:.2f}%')"
        ]
    })
    
    # Cell 18: Save history header
    notebook["cells"].append({
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "## Save Training History"
        ]
    })
    
    # Cell 19: Save history code
    notebook["cells"].append({
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "# Combine training histories\n",
            "combined_history = {\n",
            "    'phase1': {k: [float(v) for v in values] for k, values in history_phase1.history.items()},\n",
            "    'phase2': {k: [float(v) for v in values] for k, values in history_phase2.history.items()},\n",
            "    'test_results': {\n",
            "        'loss': float(test_loss),\n",
            "        'accuracy': float(test_accuracy),\n",
            "        'top5_accuracy': float(test_top5)\n",
            "    },\n",
            "    'config': {\n",
            "        'image_size': IMAGE_SIZE,\n",
            "        'batch_size': BATCH_SIZE,\n",
            "        'initial_epochs': INITIAL_EPOCHS,\n",
            "        'finetune_epochs': FINETUNE_EPOCHS,\n",
            "        'initial_lr': INITIAL_LR,\n",
            "        'finetune_lr': FINETUNE_LR\n",
            "    }\n",
            "}\n",
            "\n",
            "with open(HISTORY_PATH, 'w') as f:\n",
            "    json.dump(combined_history, f, indent=2)\n",
            "\n",
            "print(f'Training history saved to {HISTORY_PATH}')\n",
            "print(f'Model saved to {MODEL_PATH}')"
        ]
    })
    
    # Cell 20: TensorFlow.js conversion (AFTER model is saved)
    notebook["cells"].append({
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "## Convert to TensorFlow.js\n",
            "\n",
            "Automatically convert the trained model to TensorFlow.js format for Node.js deployment.\n",
            "This allows the model to run directly in Vercel serverless functions without Python servers."
        ]
    })
    
    # Cell 21: TensorFlow.js conversion code
    notebook["cells"].append({
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "print('\\n' + '=' * 60)\n",
            "print('Converting model to TensorFlow.js format...')\n",
            "print('=' * 60)\n",
            "\n",
            "try:\n",
            "    import tensorflowjs as tfjs\n",
            "    \n",
            "    # Output directory for TensorFlow.js model\n",
            "    TFJS_OUTPUT_DIR = os.path.join(BASE_DIR, 'tfjs')\n",
            "    os.makedirs(TFJS_OUTPUT_DIR, exist_ok=True)\n",
            "    \n",
            "    print(f'Converting {MODEL_PATH} to TensorFlow.js format...')\n",
            "    print(f'Output directory: {TFJS_OUTPUT_DIR}')\n",
            "    \n",
            "    # Load the saved model\n",
            "    model_for_tfjs = tf.keras.models.load_model(MODEL_PATH, compile=False)\n",
            "    \n",
            "    # Convert to TensorFlow.js\n",
            "    tfjs.converters.save_keras_model(model_for_tfjs, TFJS_OUTPUT_DIR)\n",
            "    \n",
            "    print(f'✓ Model successfully converted to TensorFlow.js!')\n",
            "    print(f'  TensorFlow.js model location: {TFJS_OUTPUT_DIR}')\n",
            "    print(f'  The model can now be used directly in Node.js/TypeScript')\n",
            "    print(f'  No Python servers needed in deployment!')\n",
            "    \n",
            "except ImportError:\n",
            "    print('⚠ tensorflowjs not installed. Skipping TensorFlow.js conversion.')\n",
            "    print('  To convert later, run: pip install tensorflowjs')\n",
            "    print('  Then run: Convert in notebook (TF.js cell) or see README')\n",
            "except Exception as e:\n",
            "    print(f'⚠ Error converting to TensorFlow.js: {e}')\n",
            "    print('  You can convert manually later in notebook or see README')\n",
            "\n",
            "print('=' * 60)"
        ]
    })
    
    # Cell 22: Summary header
    notebook["cells"].append({
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "## Training Summary"
        ]
    })
    
    # Cell 23: Summary code
    notebook["cells"].append({
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "total_time = phase1_time + phase2_time\n",
            "\n",
            "print('=' * 60)\n",
            "print('TRAINING SUMMARY')\n",
            "print('=' * 60)\n",
            "print(f'Model: EfficientNetB4 with transfer learning')\n",
            "print(f'Dataset: Food-101 ({NUM_CLASSES} classes)')\n",
            "print(f'')\n",
            "print(f'Training configuration:')\n",
            "print(f'  - Batch size: {BATCH_SIZE}')\n",
            "print(f'  - Image size: {IMAGE_SIZE}x{IMAGE_SIZE}')\n",
            "print(f'  - Label smoothing: {LABEL_SMOOTHING}')\n",
            "print(f'')\n",
            "print(f'Results:')\n",
            "print(f'  Top-1 Accuracy: {test_accuracy*100:.2f}%')\n",
            "print(f'  Top-5 Accuracy: {test_top5*100:.2f}%')\n",
            "print(f'')\n",
            "print(f'Training time:')\n",
            "print(f'  Phase 1: {phase1_time}')\n",
            "print(f'  Phase 2: {phase2_time}')\n",
            "print(f'  Total: {total_time}')\n",
            "print('=' * 60)"
        ]
    })
    
    return notebook

def main():
    """Generate the notebook file"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    notebook_path = os.path.join(script_dir, 'notebooks', 'cnn', 'cnn_training_complete.ipynb')
    
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(notebook_path), exist_ok=True)
    
    # Generate notebook
    notebook = create_notebook()
    
    # Write to file
    with open(notebook_path, 'w', encoding='utf-8') as f:
        json.dump(notebook, f, indent=1, ensure_ascii=False)
    
    print(f"✓ Notebook generated successfully!")
    print(f"  Location: {notebook_path}")
    print(f"\nNext steps:")
    print(f"  1. Open the notebook in Jupyter")
    print(f"  2. Install tensorflowjs: pip install tensorflowjs")
    print(f"  3. Run all cells")
    print(f"  4. Model will be automatically converted to TensorFlow.js format")

if __name__ == '__main__':
    main()
