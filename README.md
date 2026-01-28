# SmartFood - AI Food Classification & Nutrition Assistant

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An intelligent web application that identifies food from images using deep learning and provides comprehensive nutrition information, personalized dietary recommendations, and eating pattern analysis.

## Features

- **Food Classification**: Upload food images and get instant identification using:
  - **Google Cloud Vision API**: High-accuracy food classification (primary, 1000 free requests/month)
  - **Local CNN Model** (when available): Your trained EfficientNetB4 model (fallback)
- **Nutrition Information**: View detailed nutrition data including calories, protein, carbs, fat, and fiber
- **AI Chat Assistant**: Ask nutrition questions and get personalized dietary advice powered by Llama 3.1
- **Eating History**: Track your food intake over time with visual charts and statistics
- **Camera Support**: Capture food photos directly from your device camera
- **User Separation**: Each user has their own isolated data using SQLite database

## Tech Stack

### Frontend
- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **React** with custom hooks
- **Recharts** for data visualization

### Backend & APIs
- **Next.js API Routes** for backend logic
- **SQLite** (better-sqlite3) for persistent data storage
- **Google Cloud Vision API** for food classification (primary, 1000 free requests/month)
- **Local CNN Model** for food classification (fallback when available)
- **Groq API** for fast LLM inference (both local and deployment)
- **Livsmedelsverket API** for Swedish nutrition data

### AI/ML Models
- **Food Classification**: Two-tier approach for maximum accuracy
  1. **Google Cloud Vision API** (PRIMARY): High-accuracy food classification (1000 free requests/month)
  2. **Local CNN Model** (fallback): Your trained EfficientNetB4 model on Food-101 (when available)
- **LSTM**: Bidirectional LSTM for eating pattern prediction (automatically started)
- **LLM**: Llama 3.1 8B via Groq API for chat functionality

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.9+ (for LSTM and CNN model predictions - automatically started by Next.js)
- **Groq API Key** (free at [console.groq.com](https://console.groq.com)) - required for both local and deployment
- **Google Cloud Vision API Key** (required, free tier: 1000 requests/month at [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)) - for food classification

## Getting Started

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/smartfood.git
   cd smartfood
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Python dependencies (for CNN and LSTM models - optional)**
   ```bash
   pip install -r requirements.txt
   ```
   Note: Python is only needed if you want to use the local CNN or LSTM models. The app works with Google Cloud Vision API without Python. To use local models, start them manually:
   - CNN: `python cnn_predict.py --server` (runs on port 5001)
   - LSTM: `python lstm_predict.py --server` (runs on port 5002)

4. **Set up environment variables**
   
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add your configuration:
   ```env
   # Groq API key (required for both local and deployment)
   # Get your API key at: https://console.groq.com
   GROQ_API_KEY=your_groq_api_key_here
   
   # Google Cloud Vision API key (required for food classification)
   # Get your API key at: https://console.cloud.google.com/apis/credentials
   GOOGLE_CLOUD_VISION_API_KEY=your_google_cloud_vision_api_key_here
   ```

### Running the Application

#### Development Mode

1. **Start the Next.js development server**
   ```bash
   npm run dev
   ```

2. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)
   
   **Note**: Make sure you have set `GROQ_API_KEY` in your `.env.local` file.

#### Production Build

```bash
# Build the application
npm run build

# Start production server
npm start
```

## Project Structure

```
smartfood/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API routes
│   │   │   ├── chat/           # Chat endpoint
│   │   │   ├── classify/       # Image classification
│   │   │   ├── history/        # Food history CRUD
│   │   │   ├── nutrition/      # Nutrition data
│   │   │   └── recommendations/ # Dietary recommendations
│   │   ├── camera/             # Camera page
│   │   ├── chat/               # Chat page
│   │   ├── history/            # History page
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Home page
│   ├── components/             # React components
│   │   ├── CameraCapture.tsx
│   │   ├── ChatInterface.tsx
│   │   ├── FoodClassifier.tsx
│   │   ├── HistoryChart.tsx
│   │   └── NutritionDisplay.tsx
│   ├── hooks/                  # Custom React hooks
│   │   ├── useChat.ts
│   │   ├── useFoodClassifier.ts
│   │   └── useNutrition.ts
│   ├── lib/                    # Utilities
│   │   └── db.ts               # SQLite database operations
│   └── types/                  # TypeScript type definitions
│       ├── api.ts
│       ├── chat.ts
│       ├── food.ts
│       └── nutrition.ts
├── notebooks/                  # Jupyter notebooks (training)
│   ├── cnn/
│   │   └── cnn_training_complete.ipynb
│   └── lstm/
│       └── lstm_eating_patterns.ipynb
├── data/                       # Data directory (gitignored)
│   └── models/                 # Trained models
│       ├── cnn/
│       └── lstm/
├── test_images/               # Sample test images
├── .env.example                # Environment variables template
├── .gitignore
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── README.md
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/classify` | POST | Classify food image (returns food class, confidence, nutrition) |
| `/api/nutrition` | POST | Get nutrition data for a food class |
| `/api/chat` | POST | Chat with nutrition assistant |
| `/api/recommendations` | POST | Get personalized dietary recommendations |
| `/api/history` | GET | Get user's food history |
| `/api/history` | POST | Add food entry to history |
| `/api/history` | DELETE | Delete food history (with optional `?id=entryId`) |

### Example API Usage

**Classify Food Image:**
```bash
curl -X POST http://localhost:3000/api/classify \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/jpeg;base64,..."}'
```

**Get Nutrition Data:**
```bash
curl -X POST http://localhost:3000/api/nutrition \
  -H "Content-Type: application/json" \
  -d '{"foodClass": "pizza"}'
```

## Training Notebooks

The `notebooks/` folder contains Jupyter notebooks demonstrating the ML training process:

### CNN Training (`notebooks/cnn/cnn_training_complete.ipynb`)
- Transfer learning with EfficientNetB4 on Food-101 dataset
- Sequential API implementation
- Two-phase training: frozen base → fine-tuning
- **Note**: Production primarily uses Google Cloud Vision API. Local CNN model (food_classifier_best.keras) is available as fallback when the model file exists and the Python server is running

### LSTM Training (`notebooks/lstm/lstm_eating_patterns.ipynb`)
- Bidirectional LSTM for eating pattern prediction
- Multi-output: calories regression + category classification
- Achieves ~88% category accuracy

To run notebooks:
```bash
# Install Python dependencies
pip install -r requirements.txt

# Start Jupyter
jupyter notebook
```

## Database

The application uses SQLite for persistent storage:

- **Location**: `data/smartfood.db` (gitignored)
- **Schema**: 
  - `users` table: User IDs
  - `food_history` table: Food entries with nutrition data
- **User Separation**: Each user has a unique ID stored in localStorage
- **Features**: Automatic user creation, foreign key constraints, indexes for performance

## Configuration

### Groq API Setup

The app uses Groq API for LLM functionality in both development and production.

1. **Get your API key**
   - Sign up at [console.groq.com](https://console.groq.com)
   - Create a new API key
   - Copy the key to your `.env.local` file as `GROQ_API_KEY`

2. **Verify your setup**
   - The app will use Groq API automatically once `GROQ_API_KEY` is configured
   - No local setup or additional services required

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables:
   - `GROQ_API_KEY` (your Groq API key)
   - `NODE_ENV=production` (optional, defaults to production on Vercel)
4. Deploy!

### Other Platforms

The app can be deployed to any platform supporting Next.js:
- **Netlify**: Connect GitHub repo, add environment variables
- **Railway**: Deploy from GitHub, configure environment variables
- **Docker**: Build with `docker build -t smartfood .` (add Dockerfile)

## Testing

Test images are available in the `test_images/` folder. Upload them through the web interface to test classification accuracy.

### Manual Testing Checklist

- [ ] Upload food image and verify classification
- [ ] Check nutrition information display
- [ ] Test camera capture functionality
- [ ] Verify chat assistant responses
- [ ] Test history tracking and charts
- [ ] Verify user data separation (test with multiple browser sessions)

## Troubleshooting

### Groq API Issues

If you get "Groq API error" messages:

1. **Verify your API key:**
   - Check that `GROQ_API_KEY` is set in your `.env.local` file
   - Ensure there are no extra spaces or quotes around the key
   - Verify the key is valid at [console.groq.com](https://console.groq.com)

2. **Check API rate limits:**
   - Groq free tier has rate limits
   - If you hit limits, wait a few minutes and try again
   - Consider upgrading your Groq plan for higher limits

3. **Network issues:**
   - Ensure you have internet connection
   - Check browser console for detailed error messages

### Database Issues

If you encounter database errors:

1. Delete `data/smartfood.db` and restart the app (database will be recreated)
2. Ensure `data/` directory has write permissions
3. Check that `better-sqlite3` compiled correctly: `npm rebuild better-sqlite3`

### Classification Issues

- Ensure you have internet connection (uses Google Cloud Vision API)
- Check that `GOOGLE_CLOUD_VISION_API_KEY` is set in `.env.local`
- Verify image format (JPEG, PNG supported)
- If Google Cloud Vision fails, local CNN model will be used as fallback (if available)
- To use local CNN model: Start the server with `python cnn_predict.py --server` (runs on port 5001)
- To use local LSTM model: Start the server with `python lstm_predict.py --server` (runs on port 5002)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Support

For issues and questions, please open an issue on GitHub.

## Acknowledgments

- Food-101 dataset and model providers
- Google Cloud Vision API for food classification
- Groq for fast LLM inference (Llama 3.1)
- Livsmedelsverket for nutrition data

---

**Built with Next.js, TypeScript, and AI/ML technologies**
