#!/usr/bin/env python3
"""
LSTM Prediction Service
Simple Python script to run LSTM predictions
Can be called from Next.js API or run as a microservice

Usage:
    python lstm_predict.py <sequence_json>
    
Or as HTTP service:
    python lstm_predict.py --server
"""

import sys
import json
import os
import numpy as np
import tensorflow as tf
from pathlib import Path

# Fix Windows encoding issues
if sys.platform == 'win32':
    import io
    # Set UTF-8 encoding for stdout/stderr on Windows
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    else:
        # Fallback for older Python versions
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Paths - Find project root and model directory
def find_project_root():
    """Find project root by looking for 'src' directory or 'package.json'"""
    current = Path(__file__).parent.absolute()
    
    # Try current directory first
    if (current / 'src').exists() or (current / 'package.json').exists():
        return current
    
    # Try parent directories (max 5 levels)
    for _ in range(5):
        if (current / 'src').exists() or (current / 'package.json').exists():
            return current
        parent = current.parent
        if parent == current:  # Reached filesystem root
            break
        current = parent
    
    # Fallback: use script directory
    return Path(__file__).parent.absolute()

PROJECT_ROOT = find_project_root()
MODEL_DIR = PROJECT_ROOT / 'data' / 'models' / 'lstm'
MODEL_PATH = MODEL_DIR / 'eating_pattern_model.h5'
SCALER_PATH = MODEL_DIR / 'scaler_params.json'
CONFIG_PATH = MODEL_DIR / 'model_config.json'

# Load model and configs (cached)
_model = None
_scaler_params = None
_model_config = None

def load_model():
    """Load LSTM model and configs"""
    global _model, _scaler_params, _model_config
    
    if _model is not None:
        return _model, _scaler_params, _model_config
    
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model not found: {MODEL_PATH}")
    
    # Load model
    _model = tf.keras.models.load_model(str(MODEL_PATH), compile=False)
    
    # Load scaler params
    with open(SCALER_PATH, 'r') as f:
        _scaler_params = json.load(f)
    
    # Load model config
    with open(CONFIG_PATH, 'r') as f:
        _model_config = json.load(f)
    
    return _model, _scaler_params, _model_config

def predict(sequence):
    """
    Make prediction from sequence
    
    Args:
        sequence: List of feature vectors (14 x 9)
    
    Returns:
        dict with calories, category, categoryConfidence
    """
    model, scaler_params, model_config = load_model()
    
    # Convert to numpy array
    sequence_array = np.array([sequence], dtype=np.float32)
    
    # Make prediction
    predictions = model.predict(sequence_array, verbose=0)
    
    # Get outputs
    calories_pred = predictions[0][0][0]  # calories output
    category_pred = predictions[1][0]    # category probabilities
    
    # Denormalize calories
    cal_min = scaler_params['min'][0]
    cal_max = scaler_params['max'][0]
    predicted_calories = calories_pred * (cal_max - cal_min) + cal_min
    
    # Get category
    category_index = int(np.argmax(category_pred))
    predicted_category = model_config['food_categories'][category_index]
    category_confidence = float(category_pred[category_index])
    
    return {
        'calories': float(predicted_calories),
        'category': category_index,
        'categoryConfidence': float(category_confidence)
    }

def main():
    if len(sys.argv) < 2:
        print("Usage: python lstm_predict.py <sequence_json>")
        print("   or: python lstm_predict.py --server")
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
            print(f"[INFO] Looking for model at: {MODEL_PATH}", flush=True)
            print(f"[INFO] Model exists: {MODEL_PATH.exists()}", flush=True)
            load_model()
            print("[OK] Model loaded successfully", flush=True)
        except Exception as e:
            print(f"[WARNING] Could not load model: {e}", flush=True)
            print(f"[INFO] Model path: {MODEL_PATH}", flush=True)
            print(f"[INFO] Model exists: {MODEL_PATH.exists()}", flush=True)
        
        @app.route('/predict', methods=['POST'])
        def predict_endpoint():
            try:
                data = request.json
                if not data:
                    return jsonify({'error': 'No JSON data provided'}), 400
                
                sequence = data.get('sequence')
                if not sequence:
                    return jsonify({'error': 'Missing sequence'}), 400
                
                result = predict(sequence)
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
        
        print("Starting LSTM prediction server on http://localhost:5000", flush=True)
        print("Endpoints:", flush=True)
        print("  POST /predict - Make prediction", flush=True)
        print("  GET /health - Check server status", flush=True)
        app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)
        return
    
    # Direct call mode (called from Next.js)
    # Note: This starts a new Python process each time, so model loads each time
    # For better performance, use --server mode and call HTTP endpoint instead
    try:
        sequence_json = sys.argv[1]
        sequence = json.loads(sequence_json)
        
        result = predict(sequence)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
