# SmartFood

**Live:** [https://smartfood-ten.vercel.app/](https://smartfood-ten.vercel.app/)

Web app that identifies food from images, shows nutrition data (per 100 g and per serving), predicts eating patterns, and includes a nutrition chatbot. Built with Next.js, TypeScript, Google Cloud Vision (primary classifier), optional CNN/LSTM via TensorFlow.js, and Groq (Llama) for chat and translation.

---

## Features

- **Food classification** — Upload or capture image → Google Cloud Vision (primary) or local CNN (fallback).
- **Nutrition** — Livsmedelsverket and Open Food Facts APIs; per 100 g and selectable portion (small/normal/large). Add by ingredients or barcode (Open Food Facts).
- **Predictions** — Expected next meal and daily intake from eating history (LSTM when model and 14+ meals available; otherwise simplified estimates).
- **Chat** — Nutrition Assistant powered by Llama (Groq), with access to the user’s meal history as context.
- **History & profiles** — Per-user meal log, export CSV, edit/delete. Create profile and log in with Profile ID (SQLite locally, Postgres in production).
- **Today summary** — Daily kcal and protein, goals in Settings, water tracker, streak.
- **Dark mode** — Toggle in navigation.

---

## Tech stack

| Layer     | Stack                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------- |
| Frontend  | Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts                                             |
| Backend   | Next.js API routes, SQLite (local) / Postgres (production)                                              |
| Food / AI | Google Cloud Vision, Livsmedelsverket, Open Food Facts, Groq (Llama), optional CNN/LSTM (TensorFlow.js) |

---

## Prerequisites

- **Node.js** 18+
- **GROQ_API_KEY** — Chat and translation ([console.groq.com](https://console.groq.com))
- **GOOGLE_CLOUD_VISION_API_KEY** — Food classification ([Google Cloud Console](https://console.cloud.google.com/apis/credentials))
- **POSTGRES_URL** — Optional; only for production (e.g. Vercel Postgres). Omit for local SQLite.

---

## Getting started

```bash
git clone <repo-url>
cd smartfood
npm install
cp .env.example .env.local
```

Edit `.env.local`: set `GROQ_API_KEY` and `GOOGLE_CLOUD_VISION_API_KEY`.

**Windows paths with special characters (e.g. “ä”):** use the project’s `dev`/`build` scripts; they use `--webpack` to avoid Turbopack path issues.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Training and TensorFlow.js models

Models are trained in Jupyter. TensorFlow.js conversion runs reliably on **Ubuntu or WSL** (on Windows, `tensorflowjs` can fail; use WSL).

- **CNN:** `notebooks/cnn/food_classifier_transfer_learning_colab.ipynb` — Training; saves best model during training. Conversion to TensorFlow.js (and optionally ONNX) is in `notebooks/cnn/cnn_convert_tfjs_onnx.ipynb` in the same folder.
- **LSTM:** `notebooks/lstm/lstm_eating_patterns.ipynb` — Training and TF.js conversion in the notebook.

Output: `data/models/cnn/tfjs/` and `data/models/lstm/tfjs/`. The app also needs `data/models/lstm/scaler_params.json` and `data/models/lstm/model_config.json` (defaults are provided; overwrite from the LSTM notebook after training for best accuracy).

---

## Database

- **Local:** SQLite at `data/smartfood.db` (created on first use).
- **Production:** Set `POSTGRES_URL` (e.g. Vercel Postgres, Neon).

---

## Deployment (Vercel)

1. Connect the repo to Vercel.
2. Set environment variables: `GROQ_API_KEY`, `GOOGLE_CLOUD_VISION_API_KEY`, and for production persistence `POSTGRES_URL`.
3. Run `npm run build` locally to verify before pushing; deployment runs build on push.

---

## License

MIT — see [LICENSE](LICENSE).
