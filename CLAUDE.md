# CLAUDE.md — UCPv6 (Context Pack)

Full-stack SaaS app for exporting and migrating AI conversation history. Python/FastAPI backend + Next.js 14 frontend.

## Project Structure

```
UCPv6/
├── simple_backend.py        # Main FastAPI server (~7170 lines)
├── prompts.py               # AI prompt templates
├── memory_tree.py           # Memory/context tree extraction
├── email_service.py         # Resend email integration
├── email_scheduler.py       # Scheduled emails
├── errors.py                # Custom exception classes
├── utils.py                 # Logging, progress tracking
├── credit_config.py         # Credit system config
├── requirements.txt         # Python dependencies
├── frontend/                # Next.js 14 app
│   ├── app/                 # App Router pages
│   ├── components/          # React components
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utilities (api, supabase, analytics)
│   └── package.json
├── tests/
│   ├── test_process_v3_e2e.py
│   ├── test_helpers.py
│   ├── test_config.py
│   └── pytest.ini
├── SQL_schemas/             # Supabase schema definitions
└── .github/workflows/       # CI (email-scheduler daily job)
```

## Build & Run

### Backend

```bash
# Dev server (port 8000)
uvicorn simple_backend:app --host 0.0.0.0 --port 8000

# Or via script
bash start.sh
```

### Frontend

```bash
cd frontend

# Install deps
npm install

# Dev server (port 3000)
npm run dev

# Production build
npm run build
npm start
```

### Full stack locally

```bash
# Terminal 1
bash start.sh

# Terminal 2
cd frontend && npm run dev
```

### Docker

```bash
docker build -t ucp-app .
docker run -p 8000:8000 ucp-app
```

## Tests

### Python E2E tests

```bash
# Run all tests
./run_tests.sh

# With pytest args (e.g. filter by marker)
./run_tests.sh -m fast
./run_tests.sh -m slow
./run_tests.sh -m e2e
```

Pytest markers: `e2e`, `slow`, `fast`, `polling`, `partial`, `cancellation`

Config: `tests/pytest.ini`

### Frontend tests

```bash
cd frontend
npm run test
npm run test:watch
npm run test:coverage
```

## Lint

```bash
# Frontend ESLint
cd frontend && npm run lint
```

No dedicated Python linter configured — follow PEP 8.

## Deployment

- **Backend:** Railway (`railway.toml`) — builder: NIXPACKS, start: `bash start.sh`, Python 3.11
- **Frontend:** Vercel — standard Next.js deployment
- **CI:** GitHub Actions (`.github/workflows/email-scheduler.yml`) — runs `email_scheduler.py` daily at 12:00 UTC

## Environment Variables

Copy `.env` for local dev. Required keys:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `SUPABASE_JWT_SECRET` | JWT verification |
| `OPENAI_API_KEY` | GPT model calls |
| `STRIPE_SECRET_KEY` | Stripe payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook validation |
| `RESEND_API_KEY` | Email sending |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY` / `R2_SECRET_KEY` | Cloudflare R2 storage |
| `R2_BUCKET_NAME` / `R2_ENDPOINT` | R2 bucket config |
| `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_BACKEND_URL` | API base URLs |

See `env.production.template` for full production variable reference.

## Tech Stack

- **Backend:** Python 3.11, FastAPI, Uvicorn
- **Frontend:** TypeScript, React 18, Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth + JWT
- **Storage:** Cloudflare R2 (S3-compatible)
- **Payments:** Stripe
- **Email:** Resend
- **AI:** OpenAI API
- **Styling:** Tailwind CSS + shadcn/ui
- **Testing:** pytest, Jest + Testing Library

## Conventions

### Python

- Type hints on all function signatures
- `snake_case` for functions/variables, `UPPER_CASE` for constants, `PascalCase` for classes
- Custom exception hierarchy rooted at `ChunkProcessingError` (see `errors.py`)
- Structured JSON logging via `utils.py`
- Environment variables loaded via `python-dotenv`

### TypeScript/React

- Strict TypeScript mode
- `@/` path alias for absolute imports (configured in `tsconfig.json`)
- Custom hooks in `frontend/hooks/` (e.g. `usePackManagement`, `usePolling`)
- API calls via `frontend/lib/api.ts` utility functions
- Components use shadcn/ui + Tailwind utility classes
- `PascalCase` for components, `camelCase` for functions/hooks

### API

- Backend API at `http://localhost:8000` in development
- Frontend at `http://localhost:3000` in development
- Auth via JWT tokens from Supabase

---

## Code Quality Rules

These rules apply to all code written or modified in this project. They are non-negotiable.

### Minimalism

- Write the minimum code that correctly solves the problem. No more.
- Do not add features, options, or flexibility that aren't required right now.
- Three lines of direct code beats a helper abstraction used once.
- No speculative generalization. Solve what exists, not what might exist.

### No Redundancy

- Never duplicate logic. If it's written twice, it belongs in one place.
- Don't restate what the code already says in comments. Only comment non-obvious intent or constraints.
- Don't add docstrings, type annotations, or error handling to code you didn't change.
- Remove dead code immediately — don't comment it out, don't leave it "just in case."

### Structure

- One responsibility per function. If you need "and" to describe it, split it.
- Keep functions short enough to read without scrolling. If a function grows long, it's doing too much.
- Group related logic together. Unrelated logic belongs in separate modules.
- Dependencies flow one way. Lower-level modules don't import from higher-level ones.
- Flat is better than nested. Early returns over deep conditionals.

### Naming

- Names must be precise and unambiguous. Avoid `data`, `info`, `temp`, `result`, `obj`, `val`.
- Functions are named for what they do, not how: `get_user_credits` not `query_db_for_user_credit_value`.
- Booleans read as assertions: `is_expired`, `has_access`, `can_retry`.
- Don't abbreviate unless the abbreviation is universal (`id`, `url`, `html`).

### Error Handling

- Only handle errors at system boundaries (user input, external APIs, I/O).
- Don't catch exceptions you can't meaningfully handle. Let them propagate.
- Raise specific exceptions from `errors.py`, not bare `Exception` or generic `ValueError`.
- Never silently swallow errors. A bare `except: pass` is always wrong.

### Types

- **Python:** All function signatures have type hints. Use `Optional[X]` only when `None` is a real valid state, not as a lazy default.
- **TypeScript:** No `any`. If you don't know the type, derive it or define it. `unknown` with a type guard is acceptable.
- Never widen a type to make something compile. Fix the underlying mismatch.

### State & Side Effects

- Functions that compute values must not have side effects. Functions with side effects must not return computed values — keep them separate.
- Prefer returning values over mutating arguments.
- React: keep state as local as possible. Don't lift state unless two components genuinely share it.

### Tests

- Tests assert behavior, not implementation. If a refactor breaks a test without changing behavior, the test is wrong.
- One concept per test. If a test needs a long comment to explain what it's checking, split it.
- No test should depend on the execution order of other tests.
- Avoid mocking internal modules — mock at the system boundary (HTTP, DB, filesystem).

### What Not to Do

- No backwards-compatibility shims for code that hasn't shipped yet.
- No feature flags for things that only have one state.
- No wrapper functions that just call another function with the same arguments.
- No `TODO` comments left in committed code. Fix it now or file a ticket.
- No `console.log` / `print` statements in committed code.
