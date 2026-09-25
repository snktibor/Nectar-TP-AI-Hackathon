# 🍯 Nectar TP

![PwC AI Hackathon 2026 emléklap a Kerek Barackok csapatnak, nyakpántokkal és belépőkkel](docs/Pwc%20Hackathon%20Eml%C3%A9klap.jpg)

![Python](https://img.shields.io/badge/Backend-Python-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/API-FastAPI_0.115.0-009688?style=flat&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/Frontend-React_18-61DAFB?style=flat&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/Language-TypeScript_5.5.4-3178C6?style=flat&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Build-Vite_8-646CFF?style=flat&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Style-Tailwind_CSS_3-38B2AC?style=flat&logo=tailwindcss&logoColor=white)
![ChromaDB](https://img.shields.io/badge/Vector_DB-ChromaDB_0.5.13-FF6446?style=flat)
![Claude](https://img.shields.io/badge/LLM-Claude_%28anthropic_0.40.0%29-D97757?style=flat&logo=anthropic&logoColor=white)
![Sentence Transformers](https://img.shields.io/badge/Embeddings-sentence--transformers_3.1.1-FF9D00?style=flat&logo=huggingface&logoColor=white)
![BM25](https://img.shields.io/badge/Hybrid_Search-rank--bm25_0.2.2-4B8BBE?style=flat&logo=python&logoColor=white)
![License](https://img.shields.io/badge/License-All_Rights_Reserved-red?style=flat)

A **Nectar TP** a *Kerek Barackok* csapat által fejlesztett, domain-specifikus, RAG-alapú multi-ágens pre-audit rendszer. A projekt célja a transzferár-dokumentációk (Master File, Local File, Benchmark tanulmányok, szerződések, számlák) automatizált, kereszt-dokumentumos konzisztenciavizsgálata és a NAV-ellenőrzési kockázatok előzetes feltárása.

---

## ✨ Főbb Funkciók

* **Intelligens Ingest Pipeline:** PDF/DOCX fájlok automatikus osztályozása, szemantikus darabolása (chunking) és vektorizálása szabályalapú és LLM hibrid motorral.
* **Multi-Ágens Architektúra:** 6 dedikált specialista ágens (Master File, Local File, Benchmark, Szerződés, Számla és Kereszt-konzisztencia ellenőr) dolgozik össze egy szigorú *Tool-Use* ciklusban.
* **Bizonyíték-alapú működés (Zero Hallucination):** A rendszer nem "talál ki" hibákat. Minden megállapítást (finding) pontos forráshivatkozással (citation), jogszabályi háttérrel és konfidencia-szinttel támaszt alá.
* **Big4-szintű Riportolás:** Egy gombnyomásra generálható, 20+ oldalas, formázott, ügyfélnek átadható "Transzferár Megfelelőségi Jelentés" PDF formátumban, becsült pénzügyi kitettséggel és remediációs ütemtervvel.

---

## 🛠️ Technológiai Stack (BME VIK MIT Mérnöki Szemlélet)

A projekt egy két rétegből álló, szeparált architektúrára épül, ipari (deploy-ready) minőségi elvek mentén:

**Frontend (Client Layer)**
* React + Vite + TypeScript
* Tailwind CSS (Szigorú "Clean Design" elvek, árnyékok nélkül)
* Polling-alapú aszinkron audit státuszkezelés

**Backend (API & AI Layer)**
* Python + FastAPI (Aszinkron REST API egységes válaszborítékkal)
* Anthropic Claude API (`anthropic` Python SDK) – saját, szekvenciális *Tool-Use* ágens-orchestráció (LangChain / LangGraph nélkül)
* ChromaDB (Lokális vektoradatbázis elszeparált dokumentum-kollekciókkal)
* sentence-transformers + rank-bm25 (Hibrid dense + BM25 keresés)
* pypdf / python-docx (PDF és DOCX szövegkinyerés)

---

## 📂 Projekt Struktúra

```text
/PWC-Kerek-Barackok
├── .claude/
├── .github/
├── app/
│   ├── frontend/
│   └── backend/
├── docs/
├── .gitignore
├── CLAUDE.md
├── LICENSE.md
└── README.md
```

---

## 👥 A Csapat (Kerek Barackok)

- Sinka Tibor (@snktibor) - Data, Storage, Backend logikák & UX integráció
- Hajdú Patrik (@hajdu-patrik) - Orchestration, Architekturális döntések, Prompt Engineering
- Jónás Gergely (@JGeri) - LLM & RAG struktúra, Vektoros keresés, Frontend & UI/UX

*A projekt a 2026-os PwC Hungary AI Hackathon "Document Intelligence" kihívására készült.*

---

## 📄 Licenc

Copyright (c) Hajdú Patrik Zsolt, Sinka Tibor, Jónás Gergely. Minden jog fenntartva.

A projekt kizárólag bemutatási és portfólió célra publikus; bármely részének tanulmányi feladat megoldásaként való felhasználása szigorúan tilos. A teljes feltételek: [LICENSE.md](LICENSE.md).
