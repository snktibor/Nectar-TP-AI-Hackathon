# Backend

## First-time setup (Git Bash)

```bash
cd app/backend
py -3.12 -m venv .venv
source .venv/Scripts/activate
cp .env.example .env
python -m pip install -r requirements.txt
```

## Start backend (Git Bash)

```bash
cd app/backend
source .venv/Scripts/activate
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

If your terminal is already in `app/backend`, do not run `cd app/backend` again.

---

## Audit mode

The local PoC runs in deterministic mock mode by default:

```env
NECTAR_USE_REAL_AGENTS=false
NECTAR_ANTHROPIC_API_KEY=
```

Real LLM agents require a non-empty Anthropic key and explicit opt-in:

```env
NECTAR_USE_REAL_AGENTS=true
NECTAR_ANTHROPIC_API_KEY=sk-ant-...
```

If real mode is enabled without a key, `/api/v1/audits/start` fails fast with a sanitized configuration error instead of launching background agents that crash one by one.

---

## Run tests and lint checks (Git Bash)

Install development dependencies once:

```bash
cd app/backend
source .venv/Scripts/activate
python -m pip install -r requirements-dev.txt
```

Run test suite:

```bash
cd app/backend
source .venv/Scripts/activate
python -m pytest -q
```

Run Ruff checks:

```bash
cd app/backend
source .venv/Scripts/activate
python -m ruff check app tests scripts
```
