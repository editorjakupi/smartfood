#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CNN Food Classification Service
Simple Python script to run CNN predictions for Food-101 classification
Can be called from Next.js API or run as a microservice

Usage:
    python cnn_predict.py <image_base64>
    
Or as HTTP service:
    python cnn_predict.py --server
"""

import sys
import json
import base64
import io
import os
import numpy as np
import tensorflow as tf
from pathlib import Path
from PIL import Image

# Fix Windows encoding issues
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Paths
MODEL_DIR = Path(__file__).parent / 'data' / 'models' / 'cnn'
MODEL_DIR_ALT = Path(__file__).parent / 'notebooks' / 'data' / 'models' / 'cnn'
MODEL_PATH = None
if (MODEL_DIR / 'food_classifier_best.keras').exists():
    MODEL_PATH = MODEL_DIR / 'food_classifier_best.keras'
elif (MODEL_DIR_ALT / 'food_classifier_best.keras').exists():
    MODEL_PATH = MODEL_DIR_ALT / 'food_classifier_best.keras'

# Food-101 class names (same order as training)
FOOD_CLASSES = [
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

# Model and image size (should match training)
# IMPORTANT: The actual saved model is ResNet50 (expects 224x224), not EfficientNetB4 (380x380)
# The error message confirms: "expected shape=(None, 224, 224, 3), found shape=(1, 380, 380, 3)"
IMAGE_SIZE = 224  # ResNet50 input size (the saved model is ResNet50, not EfficientNetB4)
NUM_CLASSES = 101

# Load model (cached)
_model = None

def load_model():
    """Load CNN model"""
    global _model
    
    if _model is not None:
        return _model
    
    if not MODEL_PATH or not MODEL_PATH.exists():
        raise FileNotFoundError(f"CNN model not found. Expected at: {MODEL_PATH}")
    
    # Load model
    _model = tf.keras.models.load_model(str(MODEL_PATH), compile=False)
    return _model

def preprocess_image(image_base64: str):
    """Preprocess base64 image for model input"""
    try:
        # Decode base64
        image_data = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_data))
        
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize to model input size
        image = image.resize((IMAGE_SIZE, IMAGE_SIZE))
        
        # Convert to array and normalize
        img_array = np.array(image) / 255.0
        img_array = np.expand_dims(img_array, axis=0)  # Add batch dimension
        
        return img_array
    except Exception as e:
        raise ValueError(f"Failed to preprocess image: {str(e)}")

def predict(image_base64: str):
    """
    Make prediction from base64 image
    
    Args:
        image_base64: Base64 encoded image string
    
    Returns:
        dict with class, label, confidence, top_5
    """
    model = load_model()
    
    # Preprocess image
    img_array = preprocess_image(image_base64)
    
    # Make prediction
    predictions = model.predict(img_array, verbose=0)
    
    # Get top 5 predictions
    top_5_indices = np.argsort(predictions[0])[-5:][::-1]
    
    # Get top prediction
    top_index = int(top_5_indices[0])
    top_class = FOOD_CLASSES[top_index]
    top_confidence = float(predictions[0][top_index])
    
    # Get top 5 results
    top_5 = []
    for idx in top_5_indices:
        top_5.append({
            'label': FOOD_CLASSES[int(idx)],
            'score': float(predictions[0][int(idx)])
        })
    
    return {
        'class': top_class,
        'label': top_class.replace('_', ' '),
        'confidence': top_confidence,
        'top_5': top_5
    }

def main():
    if len(sys.argv) < 2:
        print("Usage: python cnn_predict.py <image_base64>")
        print("   or: python cnn_predict.py --server")
        sys.exit(1)
    
    if sys.argv[1] == '--server':
        # Run as HTTP server using Flask
        try:
            from flask import Flask, request, jsonify
            from flask_cors import CORS
        except ImportError:
            print("Flask not installed. Install with: pip install flask flask-cors", file=sys.stderr)
            sys.exit(1)
        
        app = Flask(__name__)
        CORS(app)  # Enable CORS for Next.js to call the server
        
        # Pre-load model when server starts
        try:
            load_model()
            print("CNN model loaded successfully", flush=True)
            print(f"Model path: {MODEL_PATH}", flush=True)
        except Exception as e:
            print(f"Warning: Could not load CNN model: {e}", flush=True)
            print(f"Looking for model at: {MODEL_DIR} or {MODEL_DIR_ALT}", flush=True)
        
        @app.route('/predict', methods=['POST'])
        def predict_endpoint():
            try:
                data = request.json
                if not data:
                    return jsonify({'error': 'No JSON data provided'}), 400
                
                image_base64 = data.get('image')
                if not image_base64:
                    return jsonify({'error': 'Missing image'}), 400
                
                result = predict(image_base64)
                return jsonify(result)
            except Exception as e:
                return jsonify({'error': str(e)}), 500
        
        @app.route('/health', methods=['GET'])
        def health():
            model_loaded = _model is not None
            return jsonify({
                'status': 'ok',
                'model_loaded': model_loaded,
                'model_available': MODEL_PATH.exists() if MODEL_PATH else False
            })
        
        print("Starting CNN prediction server on http://localhost:5001", flush=True)
        print("Endpoints:", flush=True)
        print("  POST /predict - Make prediction", flush=True)
        print("  GET /health - Check server status", flush=True)
        app.run(host='127.0.0.1', port=5001, debug=False, use_reloader=False)
        return
    
    # Direct call mode
    try:
        image_base64 = sys.argv[1]
        result = predict(image_base64)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
