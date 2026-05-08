# REDLINE PHANTOM
## Transzferár-dokumentáció Konzisztencia Auditor

**PwC Hungary AI Hackathon 2026 — Document Intelligence**
*Csapat: Kerek Barackok (Hajdú Patrik Zsolt, Sinka Tibor, Jonás Gergely)*

---

## 1. EXECUTIVE SUMMARY

### Egy mondatban
Multi-ágens AI rendszer, amely egy multinacionális cégcsoport transzferár-dokumentációjában automatikusan felderíti a dokumentumok közötti ellentmondásokat, hiányzó kötelező elemeket és benchmark-eltéréseket — még mielőtt a NAV megtenné.

### A pitch egy mondata
"Egy NAV transzferár-ellenőrzésen 50–200 millió forint büntetés a tét. Mi 3 órában megtaláljuk amit egy juniornak 3 hét lenne."

### Miért most, miért nekünk
A transzferár-dokumentáció **kötelező** minden multinak Magyarországon (32/2017. NGM rendelet). A büntetés egy hiányos dokumentációért **akár 5 millió forint dokumentumonként**, és egy elvesztett vita 50–200 millió forintot is kitehet. A PwC adótanácsadó üzletágában ez az egyik legnagyobb fix éves bevételű szolgáltatás — ami jelenleg **nagyrészt manuális**.

---

## 2. A PROBLÉMA

### Mi a transzferárazás (laikus magyarázat)

Ha egy német anyacég Magyarországon működtet leányvállalatot, és a magyar leány gyárt valamit, amit az anyacégnek szállít — milyen áron tegye ezt? Ha túl olcsón, a magyar adóalapból tűnik el pénz. Ha túl drágán, a német adóalap szenved. A két ország adóhatósága ezt nem nézi jó szemmel.

A megoldás: az úgynevezett **arm's length** elv. A cégcsoporton belüli árazásnak olyannak kell lennie, **mintha független felek között történne**. Ezt **bizonyítani** kell minden évben, dokumentációval.

### A dokumentum-univerzum

Egy transzferár-dokumentáció **nem egy fájl**, hanem egy összefüggő rendszer:

- **Master File** — a teljes cégcsoport: ki kicsoda, ki mit csinál, hol van a szellemi tulajdon, milyen finanszírozási struktúra van
- **Local File** — a magyar leány konkrét tranzakciói: kivel, miért, mennyit
- **Csoporton belüli szerződések** — a leány és az anyacég (vagy testvércégek) közötti megállapodások
- **Számlák** — kiállított és fogadott számlák a kapcsolt felek felé
- **Benchmark tanulmány** — mennyit kérnek független cégek hasonló szolgáltatásért (független adatbázisokból)
- **APA** (opcionális) — előzetes árképzési megállapodás a NAV-val
- **Country-by-Country Report** — a teljes cégcsoport pénzügyi adatai országonként

### A tényleges fájdalom

A NAV ellenőrzéskor **ezeket a dokumentumokat együtt** vizsgálja, és **ellentmondásokat** keres. Ezek a tipikus problémák:

**Konzisztencia-rés a dokumentumok között:**
A Master File azt írja "a magyar leány rutin gyártást végez". A Local File-ban viszont van egy menedzsment-szolgáltatási tranzakció felszámlázva 80 millió forintért. Ellentmondás → bírság.

**Hiányzó kötelező elem:**
A 32/2017 NGM rendelet 24 kötelező tartalmi elemet ír elő. Egyetlen elem hiánya is bírságot vonhat maga után. Egy junior senki sem tudja fejből az összeset.

**Benchmark-szakadék:**
A benchmark tanulmány azt mondja: "független felek 3–7%-os jutalékkal dolgoznak". A Local File-ban tárgyalt tranzakció 12%-os jutalékkal megy. Ez kimagasló, de senki sem vette észre, mert a két fájl 200 oldal egymás után.

**Verziós káosz:**
A szerződés 2023-as. A Master File 2024-es. A számla 2024 augusztusi de még a régi árképzéssel készült. Ki figyel erre?

**Forráshivatkozás kötelező:**
A NAV minden megállapításra kéri: "ezt honnan veszi?". Az emberi auditor manuálisan keresi vissza a hivatkozott szakaszokat — naponta órák mennek el ezzel.

### Ki szenved ettől

- **PwC transzferárazási csapat:** évente 50–80 multi dokumentációját készíti vagy auditálja, ügyfélenként 200–600 munkaóra
- **Multinacionális cégek adóigazgatói:** egy dokumentáció elkészítése 6–12 hét, és sosem biztosak benne hogy minden konzisztens
- **NAV ellenőr:** átnéz egy 800 oldalas dokumentumcsomagot 2 hét alatt, közben kell hogy észrevegye az ellentmondásokat

### A piac mérete (PwC-s perspektíva)

Magyarországon ~2.500 cég kötelezett transzferár-dokumentációt készíteni. A PwC ennek 8–12%-át szolgálja ki. Egy dokumentáció elkészítése 5–15 millió forint, egy NAV-os vita lebonyolítása ennek a többszöröse. Konzervatív becsléssel ez egy **3–5 milliárd forintos PwC-s bevételi sáv évente**, amelyben az emberi munkaóra a fő költségtétel.

---

## 3. A MEGOLDÁS

### Az alapötlet

A Redline Phantom egy **multi-ágens dokumentumelemző rendszer**, amely a transzferár-dokumentáció teljes csomagját egyszerre olvassa, és három különböző szempontból elemzi:

1. **Konzisztens-e** a dokumentumok között az állítások halmaza?
2. **Hiánytalan-e** a kötelező tartalmi elemek listája?
3. **Védhető-e** a feltüntetett árazás a benchmark tartomány alapján?

Minden megállapítás konkrét dokumentum-szakaszra mutat (forráshivatkozás), és minden megállapításhoz **bizonyossági szint** tartozik.

### A három ágens

#### Ágens 1 — KONZISZTENCIA-ŐR
**Szerep:** Olvassa az összes dokumentumot, és állításokat von ki strukturált formában. Aztán keresi az ellentmondásokat az állítások között.

**Példa állítások:**
- "A magyar leány tevékenysége: rutin gyártás" *(Master File, 14. oldal)*
- "Magyarország felszámlázott menedzsment-szolgáltatást: 80 MFt" *(Local File, 47. oldal)*
- "Menedzsment-szolgáltatási szerződés a magyar leány és az anyacég között" *(Szerződés MGMT-2024-01)*

**Ellentmondás:** Ha a Master File szerint a magyar leány csak gyártást végez, akkor honnan jön a menedzsment-bevétel? Ezt jelzi.

#### Ágens 2 — KÖTELEZŐ ELEM CHECKER
**Szerep:** Ismeri a 32/2017 NGM rendelet kötelező tartalmi listáját (24 elem Master File-hoz, 16 elem Local File-hoz). Minden elem mellett megjelöli: megvan, hiányzik, vagy hiányos.

**Példa output:**
- ✅ Master File 5.§ (1) a) — cégcsoport szervezeti struktúrája — *megvan, 3. oldal*
- ❌ Master File 5.§ (1) e) — DEMPE funkciók (immateriális javak fejlesztése) — *hiányzik*
- ⚠️ Local File 6.§ (2) c) — funkcionális elemzés — *megvan de hiányos: nincs kockázatelemzés*

#### Ágens 3 — BENCHMARK VALIDÁTOR
**Szerep:** Kiveszi a benchmark tanulmányból a megengedett tartományokat (interkvartilis range), és összeveti a Local File-ban szereplő tényleges tranzakciók árazásával.

**Példa output:**
- Tranzakció: Menedzsment-szolgáltatás (8,5%-os jutalékkal)
- Benchmark interkvartilis tartomány: 3,2%–7,1%
- **Megállapítás:** A 8,5% kívül esik a tartományon. Indoklás szükséges, vagy kockázat 23,5 MFt adóalap-korrekcióra.

### Az orchestrator

A három ágens nem izoláltan dolgozik. Az **orchestrator** koordinálja őket:

1. Először a Konzisztencia-Őr kivonja az állításokat
2. Ezt felhasználja a Kötelező Elem Checker (mert tudja mit talált)
3. Aztán a Benchmark Validátor megnézi a tényleges számokat
4. Végül egy összesítő réteg priorizálja a megállapításokat: KRITIKUS / FIGYELMEZTETÉS / INFO

### Output: a Risk Dashboard

Egy oldalas vezetői összefoglaló:

```
ÖSSZESÍTETT KOCKÁZATI PONTSZÁM: 7.2 / 10  (MAGAS)

KRITIKUS (3):
- Inkonzisztencia: Master/Local funkcionális leírás
- Hiányzó: DEMPE elemzés
- Kívül esik benchmark: Menedzsment-jutalék 8.5%

FIGYELMEZTETÉS (7):
- ...

INFO (12):
- ...

BECSÜLT NAV-KOCKÁZAT: 32–58 MFt
```

És minden tételhez tartozik egy "részletek" gomb, ami megmutatja a forrásdokumentumot a hivatkozott szakasszal.

---

## 4. ARCHITEKTÚRA

### Magas szintű folyamat

```
[Felhasználó feltölti a 5-7 dokumentumot]
              ↓
[Dokumentum Parser: PDF/DOCX → strukturált szöveg + szakaszhivatkozások]
              ↓
[Vektor adatbázis: chunkok beágyazása, hogy az ágensek gyorsan keressenek]
              ↓
┌─────────────────────────────────────────────────┐
│            ORCHESTRATOR                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐│
│  │ Ágens 1    │  │ Ágens 2    │  │ Ágens 3    ││
│  │ Konziszt.  │  │ Kötelező   │  │ Benchmark  ││
│  │ Őr         │  │ Elem       │  │ Validátor  ││
│  └────────────┘  └────────────┘  └────────────┘│
│              ↓ ↓ ↓                               │
│         [Aggregátor + Priorizáló]                │
└─────────────────────────────────────────────────┘
              ↓
[Risk Dashboard + Forráshivatkozott jelentés]
```

### Tech stack — *minimalista, hogy 19 órában működjön*

| Réteg | Választás | Miért |
|-------|-----------|-------|
| Frontend | Next.js + Tailwind | Gyors prototípus, Tibor ismeri |
| Backend | Python FastAPI | Aszinkron, egyszerű |
| Dokumentum parser | LlamaParse (vagy pypdf + python-docx ha nincs idő) | PDF/DOCX → szöveg + struktúra |
| Vektor DB | ChromaDB (helyi, fájlban) | Nem kell külső szolgáltatás, pillanatok alatt fut |
| Embedding | `paraphrase-multilingual-MiniLM-L12-v2` | Magyar+angol jól megy |
| LLM | Claude (Sonnet a 3 ágenshez, Opus az aggregátorhoz) | Hosszú kontextus, jó magyar |
| Orchestration | **Saját Python kód, sequential** | LangGraph/CrewAI 19 órában öngyilkosság |

### Kritikus architektúrális döntés

**Nem használunk LangGraph-ot vagy CrewAI-t.**

A "multi-ágens" itt valójában **3 egymás utáni, jól promptolt LLM-hívás**, közös munkamemóriával. Ez:
- Kevesebb mint 200 sor Python
- 100%-ban debuggolható
- Demókor nem omlik össze
- A pitch-ben **ugyanúgy multi-ágensként adható el**, mert funkcionálisan az is

Ha marad idő → utólag rárakható egy LangGraph wrapper. Ha nem marad → működik így is.

### Forráshivatkozás megvalósítása

Minden dokumentum-chunknak van egy ID-ja: `<doc_id>:<page>:<paragraph>`. Az ágensek minden állításukhoz mellékelik a forrás chunk ID-t. A frontend ezt használja a "részletek" gomb működéséhez — kattintásra kiemeli a forrásdokumentumban a szakaszt.

---

## 5. ADATSZTRATÉGIA

### A probléma
Valós transzferár-dokumentációt nem fogunk kapni — az ügyfélbizalmas, NDA alatt áll. **Szintetikus adatból építjük a demót**, kombinálva nyilvános OECD/NAV anyagokkal.

### A három forrásréteg

**1. Nyilvános referencia anyag (credibility):**
- OECD Transfer Pricing Guidelines 2022 (publikus PDF)
- NAV transzferár GYIK (publikus)
- 32/2017 NGM rendelet teljes szövege
- OECD BEPS Action 13 minta dokumentáció

**2. Szintetikusan generált dokumentum-csomag (a demó magja):**
- 1 fiktív cégcsoport ("Hungaria Manufacturing Group") teljes dokumentumcsomagja
- Master File (15 oldal) — generált
- Local File (25 oldal) — generált
- 3 csoporton belüli szerződés — generált
- 12 számla minta — generált
- Benchmark tanulmány kivonat — generált

**Beépített hibák a szintetikus csomagba:**
- Master File ↔ Local File funkcionális leírás konfliktus
- Hiányzó DEMPE-elemzés (32/2017 5.§ (1) e)
- Benchmark-tartományon kívül eső jutalékráta
- Szerződés és számla közötti dátumeltérés
- Mennyiségi inkonzisztencia (szerződés vs számla)

Ti tudjátok hol vannak a hibák — ez a "ground truth", amivel mérni tudjátok az F1 score-t.

**3. Adversariális teszt (ha marad idő):**
- 1 "tiszta" dokumentumcsomag, ahol nincs hiba — ezt is felismerni kell
- Edge case-ek: mi van ha hiányzik egy egész fájl?

### Generálási recept (egy doksi)

A mentortól kérünk egy 1-oldalas "mit kell tartalmaznia" útmutatót → ezt prompt-formába öntjük → Claude generál realisztikus szöveget → kézzel beépítünk 2-3 hibát szándékosan → ground truth táblázatba felvezetjük mit kell megtalálnia a rendszernek.

---

## 6. ÜZLETI ÉRTÉK A PwC-NEK

### Hogyan lesz ebből pénz

#### 1. Belső eszköz a transzferárazási csapatnak — közvetlen óramegtakarítás
Egy senior konzulens jelenleg 200–600 órát tölt egy ügyfél dokumentációjával. Ha a Redline Phantom elvégzi a konzisztencia-ellenőrzés és a kötelező-elem-check 80%-át, az 30–40% órát megtakarít. **Ugyanolyan minőségű deliverable, kevesebb munkaóra → nagyobb margin.**

#### 2. Skálázhatóság — több ügyfél kiszolgálása ugyanannyi emberrel
A PwC transzferárazási csapata kapacitás-korlátozott. Új ügyfeleket sokszor visszautasítanak. Az automatizált előszűréssel **+40% ügyfélkapacitás** elérhető anélkül hogy új embert vennének fel.

#### 3. Új termékvonal: "Pre-NAV Health Check"
Egy önálló, csomagolt termék: az ügyfél feltölti a dokumentációját, kap egy 24 órán belül kész kockázati riportot. **Belépő pont a teljes szolgáltatáshoz**, csábító árképzéssel (pl. 800 ezer Ft / health check, ami a teljes dokumentáció árának 5-10%-a).

#### 4. NAV-vita támogatás — magas díjas tanácsadás
Ha egy ügyfélnél NAV vizsgálat van, a PwC **óradíjas alapon** dolgozik. A rendszer felhasználható a védekezési stratégia előkészítésére: gyorsan megmutatja hol a leggyengébb pont. **Ez a legmagasabb óradíjas munka** a csapatban.

### A számok egy pitch-slide-ra

| Metrika | Jelenleg | Redline Phantommal |
|---------|----------|--------------------|
| Egy dokumentáció átfutási ideje | 6–12 hét | 4–8 hét |
| Kötelező elem hiány felderítése | ~85% | ~98% |
| Inkonzisztencia felderítése | Senior tapasztalattól függ | Konzisztens |
| Junior óra / projekt | 80–150 | 30–60 |
| Új ügyfél onboarding kapacitás | Korlátozott | +40% |

### Mi NEM a Redline Phantom

**Nem helyettesíti a transzferárazási konzulenst.** A komplex döntéseket továbbra is ember hozza meg (pl. melyik benchmark módszer a megfelelő, hogyan kell érvelni). A rendszer az **előkészítő munka és az ellenőrzési ciklus** automatizálását célozza — ami a csapat idejének 60-70%-a.

---

## 7. MEGVALÓSÍTÁSI ÜTEMTERV (19 ÓRA)

### Csapatfelosztás

| Csapattag | Felelősségi terület |
|-----------|---------------------|
| Hajdú Patrik Zsolt | Backend, orchestrator, API-ok, ágens-logika |
| Sinka Tibor | Frontend (Next.js), dokumentum parser, demo dashboard |
| Jonás Gergely | Prompt engineering, ágens-promptok, benchmark logika, pitch tartalom |

### Időrend

**0–2. óra: Előkészítés és architektúra**
- Repo felállítás, közös API-szerződés definiálása
- Mentor briefing: kötelező elem lista (32/2017 NGM)
- Adat: szintetikus dokumentumcsomag első verzió generálása

**2–6. óra: Infrastruktúra**
- Patrik: FastAPI backend váz, dokumentum-feltöltő endpoint
- Tibor: Next.js frontend, fájlfeltöltő UI, alap dashboard layout
- Geri: első ágens prompt-jai (Konzisztencia-Őr), tesztelés a dokumentumokon

**6–10. óra: Ágens fejlesztés**
- Patrik: orchestrator szekvenciális hívási logika, közös context-objektum
- Tibor: forráshivatkozás-megjelenítés (chunk → kiemelés a dokumentumon)
- Geri: a 3 ágens prompt-jainak finomhangolása, kötelező elem checklist beépítése

**10–14. óra: Integráció**
- End-to-end folyamat: feltöltés → ágensek → dashboard
- Hibák, edge case-ek
- Risk score számítási logika

**14–17. óra: Tesztelés és csiszolás**
- Tesztelés a szintetikus csomagon, ground truth ellenőrzés
- F1 score mérés, metrikák a pitchhez
- UI csiszolás, responsive

**17–19. óra: Pitch + demó**
- Demó videó felvétele backup gyanánt
- Pitch deck (10–12 slide)
- Élő demó forgatókönyv

### MVP — minimális győzelmi szint

A 19 óra végén ezt **muszáj** működőképesnek lennie:
- Felhasználó feltölt 4–5 dokumentumot
- A rendszer kiad egy dashboardot 8–12 megállapítással
- Minden megállapításnak van forráshivatkozása
- A risk score-ok tükrözik a beépített hibákat
- A szintetikus csomag legalább 70% F1 score-t hoz

### Stretch goalok — *csak ha minden megy*
- Reális (anonimizált) PDF tesztelés a mentortól
- Orchestrator átírása LangGraph-ra
- "Magyarázd el laikusan" gomb minden megállapításhoz
- PDF export (klienseknek küldhető riport)

---

## 8. PITCH STRUKTÚRA (5 PERC)

### Slide-ok

1. **Hook** (30 sec): "Egy NAV transzferár-ellenőrzésen 50–200 millió forint büntetés a tét. Egy junior konzulens 3 hetet tölt egy dokumentáció ellenőrzésével. Mi 3 órára csökkentjük."
2. **A probléma** (45 sec): Mi a transzferárazás, mi a manuális fájdalom (5–7 dokumentum, 800 oldal, kötelező konzisztencia)
3. **Tipikus hibák** (30 sec): 3 konkrét példa egy ellentmondásra, hiányzó elemre, benchmark-szakadékra
4. **A megoldás vizuálisan** (60 sec): A 3 ágens, az orchestrator, a dashboard
5. **Élő demó** (90 sec): Feltöltés → 30 másodperc várakozás → dashboard a beépített hibákkal
6. **Üzleti érték a PwC-nek** (45 sec): Óramegtakarítás + új termékvonal + skálázhatóság
7. **Tech kompetencia** (15 sec): "Mérnök informatikus csapat, BME VIK"
8. **Závás** (15 sec): "Egy hackathon-MVP 19 óra alatt — éles deploy 3 hónapon belül lehetséges"

### Mit ne mondjunk
- ❌ "Forradalmi", "diszruptív", "AI-vezérelt"
- ❌ Azt hogy az SAP nem tud ilyet (de tud, csak strukturált adatokon)
- ❌ Túlbecsülni a pénzügyi hatást — maradjunk reálisan a sávban

### Mit muszáj mondanunk
- ✅ "Forráshivatkozás minden megállapításnál" — ez a brief egyik kulcs-elvárása
- ✅ "Bizonytalanságot kezelünk" — a brief explicit említi
- ✅ "Multi-dokumentum elemzés, nem chatbot" — ez az amitől eltér a generic AI-tól
- ✅ "32/2017 NGM rendelet" — legalább egyszer, hogy lássák hogy értjük a domain-t

---

## 9. KOCKÁZATOK ÉS MITIGÁCIÓ

| Kockázat | Valószínűség | Mitigáció |
|----------|--------------|-----------|
| LLM hallucinál egy ellentmondást ami nincs | KÖZEPES | Forráshivatkozás kötelező → ha nincs, nem fogadjuk el |
| Nincs idő mind a 3 ágensre | KÖZEPES | Fallback: 2 ágens (Konzisztencia + Kötelező Elem) |
| PDF parser elszáll a komplex layouton | MAGAS | Backup: minden szintetikus dokumentum legyen "tiszta" PDF, semmi szkennelés |
| Mentor nem ér rá a kötelező elem listához | KÖZEPES | NAV honlapról letölthető, OECD-ből kiegészíthető — időigényes, de nem blokkoló |
| Demó során elszáll egy API | ALACSONY | Előre rögzített backup videó kéznél |
| A zsűri kérdez a szakmai mélységről | MAGAS | Geri legyen a "domain-felelős" — vegye át a transzferárazás vázát mentor briefing alapján |

---

## 10. MIÉRT EZ NYER

A brief 6 explicit elvárást támaszt — a Redline Phantom mindegyiket teljesíti:

1. ✅ **Multi-dokumentum értelmezés** — 5–7 fájl együtt elemzése
2. ✅ **Eltérések, hiányosságok felderítése** — pont ez a fő funkció
3. ✅ **Forráshivatkozás minden megállapításhoz** — chunk-ID rendszerrel
4. ✅ **Bizonytalanság kezelése** — minden megállapításnál bizonyossági szint
5. ✅ **Strukturált, magyarázható output** — risk dashboard és priorizálás
6. ✅ **Nem helyettesíti az embert, hanem támogatja** — ez a pozícionálásunk magja

És a PwC-s szempontból: **valódi, mérhető, már létező szolgáltatási vonalra építünk**, nem fiktív felhasználási esetre. A transzferárazás a PwC adózási üzletágának egyik legnagyobb és legdokumentum-intenzívebb területe.

---

*"Nem azt mondjuk meg mi van a dokumentumban. Azt mondjuk meg miért fontos, és mit kell vele csinálni."*
