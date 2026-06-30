# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Momentum AI Gemini backend

Momentum AI uses a local FastAPI backend to keep the Gemini API key private. Do not expose `GEMINI_API_KEY` in frontend code.

1. Confirm your `.env` file contains:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

2. Install the Python backend dependencies:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

3. Start the backend:

```bash
uvicorn server:app --reload
```

4. Start the frontend in another terminal:

```bash
npm install
npm run dev
```

The frontend calls `/api/generate-plan`, and Vite proxies that request to the local FastAPI backend.

## Gemini API Setup

1. Create a file named `.env` in the project root.
2. Paste your Gemini API key on the `GEMINI_API_KEY=` line.
3. Do not commit `.env` to version control.
4. When a backend is added, use `process.env.GEMINI_API_KEY` to keep the secret private.

Example `.env` content:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

The project is prepared for future Gemini API calls with a shared helper file and secure env storage.
