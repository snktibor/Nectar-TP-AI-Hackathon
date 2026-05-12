![Node.js](https://img.shields.io/badge/Node.js-18.x%2B-339933?style=for-the-flat&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/Frontend-React_18-61DAFB?style=for-the-flat&logo=react&logoColor=white)
![Tailwind](https://img.shields.io/badge/Style-Tailwind_CSS-38B2AC?style=for-the-flat&logo=tailwind-css&logoColor=white)
![JSON Server](https://img.shields.io/badge/Backend-json--server_0.17.4-000000?style=for-the-flat&logo=json&logoColor=white)
![Vercel](https://img.shields.io/badge/Deployment-Vercel-000000?style=for-the-flat&logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/API_Host-Render-46E3B7?style=for-the-flat&logo=render&logoColor=white)
![Status](https://img.shields.io/badge/Status-Live_Production-success?style=for-the-flat)

# 🍯 Nectar TP

![PwC AI Hackathon 2026 emléklap a Kerek Barackok csapatnak, nyakpántokkal és belépőkkel](docs/Pwc%20Hackathon%20Eml%C3%A9klap.jpg)

A **Nectar TP** a *Kerek Barackok* csapat által fejlesztett, domain-specifikus, RAG-alapú multi-ágens pre-audit rendszer. A projekt célja a transzferár-dokumentációk (Master File, Local File, Benchmark tanulmányok, szerződések, számlák) automatizált, kereszt-dokumentumos konzisztenciavizsgálata és a NAV-ellenőrzési kockázatok előzetes feltárása.

---

## 🚀 Főbb Funkciók

* **Intelligens Ingest Pipeline:** PDF/DOCX fájlok automatikus osztályozása, szemantikus darabolása (chunking) és vektorizálása szabályalapú és LLM hibrid motorral.
* **Multi-Ágens Architektúra:** 6 dedikált specialista ágens (Master File, Local File, Benchmark, Szerződés, Számla és Kereszt-konzisztencia ellenőr) dolgozik össze egy szigorú *Tool-Use* ciklusban.
* **Bizonyíték-alapú működés (Zero Hallucination):** A rendszer nem "talál ki" hibákat. Minden megállapítást (finding) pontos forráshivatkozással (citation), jogszabályi háttérrel és konfidencia-szinttel támaszt alá.
* **Big4-szintű Riportolás:** Egy gombnyomásra generálható, 20+ oldalas, formázott, ügyfélnek átadható "Transzferár Megfelelőségi Jelentés" PDF formátumban, becsült pénzügyi kitettséggel és remediációs ütemtervvel.

## 🛠️ Technológiai Stack (BME VIK MIT Mérnöki Szemlélet)

A projekt egy két rétegből álló, szeparált architektúrára épül, ipari (deploy-ready) minőségi elvek mentén:

**Frontend (Client Layer)**
* React + Vite + TypeScript
* Tailwind CSS + shadcn/ui (Szigorú "Clean Design" elvek, árnyékok nélkül)
* Polling-alapú aszinkron audit státuszkezelés

**Backend (API & AI Layer)**
* Python + FastAPI (Aszinkron REST API egységes válaszborítékkal)
* LangChain / LangGraph (Orchestráció és State Machine)
* ChromaDB (Lokális vektoradatbázis elszeparált dokumentum-kollekciókkal)
* LlamaParse / PyMuPDF (Layout-aware dokumentum kinyerés)

## 📂 Projekt Struktúra

```text
/Nectar-TP
├── .claude/
├── .github/
├── app/
│   ├── frontend/
│   └── backend/
├── .docs/
├── .logs/
└── .gitignore
```

---

## 👥 A Csapat (Kerek Barackok)

- Sinka Tibor (@snktibor) - Data, Storage, Backend logikák & UX integráció
- Hajdú Patrik (@hajdu-patrik) - Orchestration, Architekturális döntések, Prompt Engineering
- Jónás Gergely (@JGeri) - LLM & RAG struktúra, Vektoros keresés, Frontend & UI/UX

*A projekt a 2026-os PwC Hungary AI Hackathon "Document Intelligence" kihívására készült.*
