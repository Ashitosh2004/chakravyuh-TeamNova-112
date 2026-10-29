# CHAKRAVYUH — Smart ENTC Learning & Innovation Platform

An AI-powered learning platform for Electronics & Telecommunication (ENTC) students:
published courses with lessons, a virtual laboratory (logic gates, circuits, signals,
communication, sensors), real-world scenario simulations, coding challenges graded on
the server, quizzes with server-side scoring, progress/achievements, and an AI
learning assistant with a genuine, configurable provider.

Built for the CHAKRAVYUH AI Vibe Coding Challenge.

## Architecture

```
Browser (React 19 + TypeScript + Vite + Tailwind, TanStack Start)
   │  fetch with credentials:"include" — httpOnly cookies, no tokens in JS
   ▼
FastAPI backend (Python 3.11+)  ──app/── api/v1/* routes → services → MongoDB
   │                              ChakraScript sandbox (authoritative grading)
   ▼                              AI provider adapter (server-side keys only)
MongoDB (local service or Atlas)
```

- **Frontend** lives in this repository root (Lovable project — TanStack Start,
  React, TypeScript, Tailwind CSS). Simulation engines run deterministically in the
  browser; learning content is also bundled so the app works in development mode
  without a backend.
- **Backend** (`backend/`, FastAPI + PyMongo async) owns authentication, users,
  authoritative quiz scoring, challenge grading (including hidden tests), session
  persistence, activity/progress aggregation, achievements, search and the AI
  assistant. It never fakes data: without MongoDB it reports not-ready; without AI
  credentials it reports that AI is unconfigured.
- **ChakraScript** is a tiny sandboxed C/Arduino-style language. The browser
  interpreter (`src/engines/interpreter.ts`) and the server port
  (`backend/app/services/chakrascript.py`) are cross-validated against a shared
  75-case gold master so client practice results and server grades always agree.
  Neither uses `eval`/`exec`.

## Technologies

| Layer | Stack |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4, TanStack Start/Router, zustand, zod |
| Backend | Python 3.11+, FastAPI, Uvicorn, Pydantic v2, PyJWT, bcrypt, httpx |
| Database | MongoDB 6/7 (local service or MongoDB Atlas) |
| AI (optional) | Any OpenAI-compatible API or Anthropic, configured server-side |
| Tests | Vitest (frontend, 26 tests) · Pytest (backend, 62 tests) |

## Prerequisites

- **Windows 10/11** (for the `Run.bat` launcher; manual setup works on any OS)
- **Python 3.11+** — <https://www.python.org/downloads/> (check "Add to PATH")
- **Node.js 18+** with npm — <https://nodejs.org/>
- **MongoDB** — local service or an Atlas cluster (see below)

## Quick start on Windows (Run.bat)

1. Install the prerequisites above.
2. Start MongoDB (e.g. admin terminal: `net start MongoDB`, or use Atlas).
3. Double-click **`Run.bat`** (or run it from a terminal).

The launcher checks everything (Python, Node, ports, MongoDB), creates the virtual
environment and `.env` files on first run, installs dependencies only when missing,
initializes indexes and curriculum content idempotently, starts the backend and
frontend, waits until both actually answer their health endpoints, and opens the
browser.

- Frontend: <http://127.0.0.1:5173>
- Backend API: <http://127.0.0.1:8000> · docs: <http://127.0.0.1:8000/docs>
- Health: <http://127.0.0.1:8000/health> · Readiness: <http://127.0.0.1:8000/ready>

Stop everything with **`Stop.bat`** (it stops only this project's processes) or by
closing the two server windows.

## MongoDB setup

**Option A — local Windows service** (installed with the MongoDB MSI):

```bat
:: admin terminal
net start MongoDB
```

Default URI used by the backend: `mongodb://127.0.0.1:27017`.

**Option B — MongoDB Atlas (cloud):** create a free cluster at
<https://www.mongodb.com/cloud/atlas>, allow your IP, create a database user, then
set in `backend/.env`:

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true
MONGODB_DB=chakravyuh
```

The database is never reset automatically; seeding only upserts published
educational content and never touches user data.

## Running backend and frontend separately

Backend (from `backend/`):

```sh
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
copy .env.example .env
.venv\Scripts\python -m app.seed          # indexes + curriculum (idempotent)
.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend (repository root):

```sh
npm install
copy .env.example .env        # VITE_API_BASE_URL=http://127.0.0.1:8000
npm run dev -- --host 127.0.0.1 --port 5173
```

Use `http://127.0.0.1:5173` (not `localhost`) so cookies share the host with the
API. Without `VITE_API_BASE_URL` the app runs in a clearly-labelled development
mode and backend-dependent features honestly show as unavailable.

## Running tests

```sh
:: Frontend (repository root)
npx vitest run

:: Backend (from backend/) — needs MongoDB running; uses the chakravyuh_test DB
.venv\Scripts\python -m pytest
```

The backend suite covers auth (hashing, sessions, rate limits), ownership, quiz
answer-hiding and server-side scoring, challenge grading incl. hidden tests and
sandbox safety, AI provider behavior (mocked transport, clearly labelled), search,
injection guards, and the interpreter gold-master. See `docs/API.md` for the
endpoint reference and `docs/TROUBLESHOOTING.md` for common errors.

## Environment configuration

| File | Purpose |
|---|---|
| `.env` (root) | `VITE_API_BASE_URL=http://127.0.0.1:8000` for the frontend |
| `backend/.env` | MongoDB URI/db, session secret, CORS, AI provider, SMTP — see `backend/.env.example` |

AI provider (all server-side; keys never reach the browser):

```env
AI_PROVIDER=openai            # openai | openai_compatible | anthropic
AI_API_KEY=sk-...
AI_MODEL=gpt-4o-mini          # any model your account supports
AI_BASE_URL=                  # required for openai_compatible
```

Leave `AI_PROVIDER` empty to disable the assistant — the UI reports honestly that
AI is not configured and everything else keeps working.

## Project structure

```
├─ src/                    frontend (Lovable: routes, components, engines, content)
├─ backend/
│  ├─ app/
│  │  ├─ main.py           FastAPI app, CORS, body limit, lifespan
│  │  ├─ core/             config, security (JWT/bcrypt/cookies), errors, rate limit
│  │  ├─ db/               async Mongo client, index definitions
│  │  ├─ models/           storage shapes
│  │  ├─ schemas/          Pydantic request/response contracts
│  │  ├─ api/v1/           auth, users, courses, quizzes, challenges, lab, ai,
│  │  │                    progress, search, system
│  │  ├─ services/         chakrascript sandbox, evaluation, quiz scoring,
│  │  │                    activities, achievements, scenarios, AI adapter, email
│  │  └─ seed.py           idempotent database initialization CLI
│  ├─ tests/               pytest suite (real MongoDB, isolated test DB)
│  ├─ scripts/             content export + interpreter gold-master tooling
│  └─ seed_data/           published curriculum exported from src/content
├─ docs/                   API.md, SETUP.md, TROUBLESHOOTING.md, API_CONTRACT.md
├─ Run.bat / Stop.bat      Windows launcher
```

## Deployment considerations

`Run.bat` is for local development/demonstration only. For production:

- Frontend: build with `npm run build` and host the output (or keep the Lovable
  publishing flow).
- Backend: run `uvicorn` behind HTTPS with `ENVIRONMENT=production`,
  `SESSION_SECRET` set, `CORS_ORIGINS` restricted to the real site origin,
  `COOKIE_SECURE=true`, and a managed MongoDB (Atlas recommended) with backups.
- Never commit `.env` files; rotate secrets out of git history if they leak.
- The in-process rate limiter suits a single worker; use a shared store (e.g.
  Redis) when scaling horizontally.

## Building with Lovable

This project is connected to [Lovable](https://lovable.dev) — open it in the
Lovable editor to keep iterating with prompts; commits pushed to the connected
branch sync back into the editor.
