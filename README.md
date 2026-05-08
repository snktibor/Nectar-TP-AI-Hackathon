# REDLINE PHANTOM

REDLINE PHANTOM egy transzferár-dokumentáció konzisztencia auditor a PwC Hungary AI Hackathon 2026-ra. A célja, hogy Master File, Local File, szerződés, számla és benchmark dokumentumcsomagokból gyorsan feltárja a dokumentumok közötti ellentmondásokat, hiányzó kötelező elemeket és benchmark-kockázatokat.

## Miért készült?

A transzferár-dokumentáció manuális ellenőrzése lassú, drága és könnyű benne kihagyni a kereszt-dokumentum ellentmondásokat. A projekt értékteremtése három pontban foglalható össze:

- Gyorsabb előszűrés: több száz oldalnyi dokumentumcsomag néhány perc alatt feldolgozható.
- Jobb auditkészültség: a rendszer forráshoz kötött, priorizált findingokat készít.
- Skálázható tanácsadói workflow: az ismétlődő dokumentumellenőrzés automatizálható, az emberi szakértő pedig a döntésekre és ügyfélkommunikációra koncentrálhat.

## Jelenlegi állapot

Ez a repo jelenleg egy működő PoC/MVP alapot tartalmaz:

- React + Vite frontend dokumentumfeltöltő és dashboard felülettel.
- FastAPI backend szabványos API envelope-pal.
- Batch dokumentum ingest végpont PDF/DOCX fájlokra.
- pypdf és python-docx alapú szövegkinyerés.
- Ruleset-alapú dokumentumtípus-besorolás.
- Chunkolás és lokális ChromaDB vektorindex.
- Mock audit pipeline pollinggal és demo finding outputtal.
- Központi `phantomDesign` frontend design system fehér, pasztell dashboard UI-hoz.

## Architektúra

```text
Frontend (React + Vite)
  -> Document Ingestor
  -> Audit polling dashboard

Backend (FastAPI)
  -> /api/v1/documents/ingest
  -> parser: PDF/DOCX text extraction
  -> classifier: document_classification.json
  -> chunker: overlapping text chunks
  -> vector store: ChromaDB persistent local index
  -> /api/v1/audits/start
  -> mock agent pipeline
  -> /api/v1/audits/status/{id}
  -> /api/v1/audits/results/{id}
```

## Mappastruktúra

- [app/backend](app/backend) FastAPI backend, Pydantic DTO-k, ingest szolgáltatások és rulesetek.
- [app/backend/app/api/v1/endpoints](app/backend/app/api/v1/endpoints) API route handlerek.
- [app/backend/app/services](app/backend/app/services) parser, classifier, chunker, vector store és mock audit service.
- [app/backend/rulesets](app/backend/rulesets) determinisztikus ruleset fájlok és referencia anyagok.
- [app/frontend](app/frontend) React + Vite frontend.
- [app/frontend/src/components](app/frontend/src/components) UI komponensek, köztük a `DocumentIngestor` és eredmény dashboard.
- [app/frontend/src/design-system](app/frontend/src/design-system) központi frontend design token namespace.
- [.claude/agents](.claude/agents) Claude agent profilok.
- [.github/agents](.github/agents) GitHub Copilot agent profilok.
- [.github/instructions](.github/instructions) path-specifikus Copilot instrukciók.

## Előfeltételek

- Python 3.11 vagy újabb.
- Node.js 20 vagy újabb.
- npm.
- Windows PowerShell vagy Git Bash.

## Backend indítása

PowerShell alatt:

```powershell
cd app/backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Git Bash alatt:

```bash
cd app/backend
python -m venv .venv
source .venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Health check:

```text
http://127.0.0.1:8000/health
```

Swagger UI:

```text
http://127.0.0.1:8000/docs
```

## Frontend indítása

Első futtatás előtt hozd létre a lokális env fájlt az example alapján:

```bash
cd app/frontend
cp .env.example .env
npm install
npm run dev -- --host 127.0.0.1
```

Frontend URL:

```text
http://127.0.0.1:5173/
```

Az `.env` fájlban az API alapértelmezett címe:

```env
VITE_API_BASE_URL=http://localhost:8000
```

## Használati folyamat

1. Indítsd el a backend szervert.
2. Indítsd el a frontend szervert.
3. Nyisd meg a frontend URL-t.
4. A `Document Ingestor` panelen tölts fel PDF vagy DOCX dokumentumokat.
5. A backend parse-olja, besorolja, chunkolja és ChromaDB-be indexeli a dokumentumokat.
6. Az ingest után megjelenik a legacy audit upload panel.
7. Töltsd fel a kötelező audit inputokat, majd indítsd el az auditot.
8. A dashboard pollingolja az audit státuszt, majd megjeleníti a mock audit reportot.

Fontos: az ingest pipeline már valódi parser/classifier/chunker/vector-store folyamatot használ, de az audit findingok jelenleg mock adatokból készülnek. A következő fejlesztési lépés az ingestelt chunkok bekötése a tényleges agent pipeline-ba.

## API végpontok

Minden backend válasz szabványos envelope-ban érkezik:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {
    "request_id": "...",
    "timestamp": "...",
    "api_version": "v1"
  }
}
```

Aktív végpontok:

- `GET /health` rendszer health check.
- `POST /api/v1/documents/upload` egyszerű dokumentum metadata upload.
- `GET /api/v1/documents/{session_id}` session dokumentumlista.
- `POST /api/v1/documents/ingest` batch PDF/DOCX ingest, besorolás és vektorindexelés.
- `POST /api/v1/audits/start` mock audit pipeline indítása.
- `GET /api/v1/audits/status/{audit_task_id}` audit polling.
- `GET /api/v1/audits/results/{audit_task_id}` kész audit report lekérése.

## Feature státusz

| Terület | Státusz | Megjegyzés |
| --- | --- | --- |
| React + Vite frontend | Kész MVP | Upload, ingest panel, polling dashboard és design system működik. |
| Fehér/pasztell dashboard design system | Kész MVP | `phantomDesign`, Tailwind `phantom` tokenek és `--phantom-*` CSS változók. |
| Batch document ingest | Kész MVP | PDF/DOCX validáció, 50 MB/file limit, több fájl egyszerre. |
| PDF/DOCX parsing | Kész MVP | pypdf és python-docx alapú szövegkinyerés. |
| Dokumentumtípus-besorolás | Kész MVP | `document_classification.json` keyword ruleset alapján. |
| Chunkolás | Kész MVP | Overlapelt karakteralapú chunkok forrás metaadatokkal. |
| ChromaDB index | Kész MVP | Session-scoped lokális persistent collection. |
| Audit polling | Kész MVP | In-memory mock pipeline állapotkezeléssel. |
| Valódi multi-agent elemzés | Következő lépés | A mock service helyére kell kötni a Structure, Consistency, Completeness, Benchmark és Risk Scorer ágenseket. |
| Forráshivatkozott findingok | Részleges | DTO-k és chunk metadata iránya megvan, de a mock findingok még nem valódi chunk-hivatkozásból jönnek. |
| Benchmark validáció | Tervezett | A benchmark agent és ruleset integráció még nem teljes backend pipeline. |
| Completeness matrix | Tervezett | Frontend instruction szinten megvan, teljes képernyő még nincs kész. |
| NAV risk scoring | Tervezett | Ruleset-alapú pontozás és pénzügyi kitettség számítás még hiányzik. |

## Fontos fejlesztési hiányok

- Az audit indítás jelenleg külön legacy upload flow-t igényel az ingest után; ezt érdemes összekötni az ingestelt dokumentumokkal.
- A `tp_method_classification.json`, `severity_scoring.json` és `nav_risk_categories.json` célrulesetek még nincsenek teljesen implementálva a jelenlegi kódban.
- A ChromaDB adat jelenleg lokálisan keletkezik az `app/backend/data/chromadb` alatt; ezt fejlesztői gépen lokális futási adatként kell kezelni.
- Nincs automatizált tesztcsomag; legalább backend API smoke tesztek és frontend responsive smoke tesztek ajánlottak.
- A mock audit pipeline-t valódi, forráshivatkozott agent pipeline-ra kell cserélni.

## Validációs parancsok

Frontend:

```bash
cd app/frontend
npm run lint
npm run build
```

Backend import/indítás ellenőrzés:

```bash
cd app/backend
python -m compileall app
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Biztonsági alapelvek

- Feltöltött dokumentumokat bizalmas adózási anyagként kell kezelni.
- Ne kerüljön dokumentumtartalom logba.
- Ne kerüljön API kulcs vagy token a repóba.
- A fájltípus, fájlméret és üres fájl validáció kötelező.
- Minden findingnek forráshivatkozással kell készülnie, mielőtt éles döntést támogatna.

## Csapat

Kerek Barackok, PwC Hungary AI Hackathon 2026:

- Hajdú Patrik Zsolt
- Sinka Tibor
- Jonás Gergely
