# SmartFood

🌐**Live:** [https://smartfood-ten.vercel.app/](https://smartfood-ten.vercel.app/)

Web app that identifies food from images, shows nutrition data (per 100 g), and provides eating-pattern predictions and dietary advice. Built with Next.js, TypeScript, and AI/ML (Google Cloud Vision, Livsmedelsverket, Groq/Llama 3.1, optional CNN/LSTM via TensorFlow.js).

---

## Features

- **Food classification** — Image to food type via Google Cloud Vision (primary) or local CNN model (fallback when available).
- **Nutrition** — Livsmedelsverket (primary) and Open Food Facts (fallback) use free, open APIs; then Llama 3.1 estimates → generic category values. Base data is per 100 g; the app scales to an estimated serving (150 g) for display, history, and recommendations so advice matches "what was eaten" (same in deployment).
- **Translation** — English food names translated to Swedish via Llama 3.1 (fallback: hardcoded list) for Livsmedelsverket lookup.
- **Predictions** — Expected next meal (calories and type) and personalized tips from eating history (LSTM or simplified model when TF.js model is unavailable).
- **Chat** — Dietary advice powered by Llama 3.1 (Groq).
- **History, camera, profiles** — Per-user history (SQLite locally, Postgres in production); camera capture; create profile, login with Profile ID, log out to use another profile (desktop and mobile).

---

## Tech stack

| Layer            | Stack                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| Frontend         | Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts                                    |
| Backend          | Next.js API routes, SQLite (local) / Postgres (production)                                     |
| Food / nutrition | Google Cloud Vision, Livsmedelsverket API, Groq (Llama 3.1), optional CNN/LSTM (TensorFlow.js) |

---

## Prerequisites

- **Node.js** 18+ and npm
- **GROQ_API_KEY** — Chat, translation, and nutrition fallback (get at [console.groq.com](https://console.groq.com))
- **GOOGLE_CLOUD_VISION_API_KEY** — Food classification (get at [Google Cloud Console](https://console.cloud.google.com/apis/credentials))
- **Python** 3.9+ — Only for training and converting models; the app runs models in Node via TensorFlow.js

Nutrition data: Livsmedelsverket (primary) and Open Food Facts (fallback) are free, open APIs (no API keys required).

---

## Getting started

**Run in PowerShell (Windows) or terminal (macOS/Linux).**

```bash
git clone <repo-url>
cd smartfood
npm install
cp .env.example .env.local
```

Edit `.env.local` and set at least:

- `GROQ_API_KEY`
- `GOOGLE_CLOUD_VISION_API_KEY`

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Training and TensorFlow.js conversion

Models are trained in Jupyter. TensorFlow.js conversion runs reliably on **Ubuntu or WSL** (on Windows, the `tensorflowjs` pip package can fail due to `tensorflow-decision-forests`; use WSL or see [scripts/install_tfjs_converter_windows.md](scripts/install_tfjs_converter_windows.md)).

**Run in Ubuntu or WSL:**

```bash
cd smartfood
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install tensorflow tensorflowjs h5py
jupyter notebook --allow-root
```

- **CNN:** `notebooks/cnn/cnn_training_complete.ipynb` — Saves the model and converts to TF.js in the notebook.
- **LSTM:** `notebooks/lstm/lstm_eating_patterns.ipynb` — Saves the model and converts to TF.js in the notebook (run all cells including the TF.js conversion cell).

Output: `data/models/cnn/tfjs/` and `data/models/lstm/tfjs/`. Next.js loads these via TensorFlow.js; no Python servers are used.

**LSTM config:** The app needs `data/models/lstm/scaler_params.json` and `model_config.json`. Default files are provided; for best accuracy after training, run the notebook cell **"Save Model and Config"** to overwrite them with the trained scaler and metrics.

---

## Testing that the LSTM model is used

1. **At least 14 meals in history** — The LSTM needs a sequence of 14 meals; with fewer, the app uses simplified estimates.
2. Open **Predictions** in the app (or call `GET /api/predictions` with a valid user).
3. In the response, check **`lstmModelUsed: true`** — then the TensorFlow.js LSTM model was used. If `lstmModelUsed: false`, you get the `note` field explaining why (e.g. need 14+ meals or missing TF.js model/config).
4. In the browser: DevTools → Network → select the predictions request → Response: look for `"lstmModelUsed": true` and `"modelUsed": "LSTM (Bidirectional LSTM with Attention)"`.

---

## Database

- **Local:** SQLite at `data/smartfood.db`
- **Production:** Postgres (e.g. Vercel Postgres, Neon); set `POSTGRES_URL`

---

## Deployment (Vercel)

1. Connect the repo to Vercel.
2. Set environment variables: `GROQ_API_KEY`, `GOOGLE_CLOUD_VISION_API_KEY`, `POSTGRES_URL` (recommended for production so history and profiles persist).
3. Deploy.

**Behavior in production (same as local where applicable):**

- **Profiles and DB** — Profile create/login/delete and history use the database. Set `POSTGRES_URL` in Vercel so production uses Postgres. Profile existence check (before login) and permanent delete work the same as locally.
- **LSTM model** — Runs in API routes (Node.js). Include `data/models/lstm/tfjs/` (and `scaler_params.json`, `model_config.json`) in the repo so they are deployed; the app loads the model from the filesystem. If the model is missing, predictions fall back to simplified estimates.
- **Portion and recommendations** — Nutrition is scaled to an estimated serving (150 g) for display, saved history, and recommendations. The LLM is told these values are "meal intake", not per 100 g, so recommendations stay accurate in deployment.

---

## Troubleshooting

- **Groq errors** — Check `GROQ_API_KEY` in `.env.local` (no extra spaces or quotes).
- **Classification** — Requires `GOOGLE_CLOUD_VISION_API_KEY` and network access.
- **Nutrition** — Livsmedelsverket (primary), Open Food Facts (fallback; free open API) → Llama 3.1 estimates → generic values. Translation: Llama 3.1 → hardcoded.
- **SQLite** — If the DB is corrupted, delete `data/smartfood.db` and restart; tables are created on first use.

---

## License

MIT — see [LICENSE](LICENSE).
