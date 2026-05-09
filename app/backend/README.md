# Backend

```bash
cd app/backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python -m uvicorn --app-dir ../backend app.main:app --reload --reload-dir ../backend --port 8000
```
