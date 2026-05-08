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

## 6. MŰKÖDÉSI FOLYAMAT RÉSZLETESEN

### 6.1 Bemenet és előfeldolgozás
1. A felhasználó feltölti a releváns dokumentumokat (Master File, Local File, szerződések, számlák, benchmark).
2. A dokumentum parser minden fájlt strukturált szövegre bont: oldal, bekezdés, szakaszcím, táblázat.
3. Minden szövegrész kap egy forrásazonosítót (`<doc_id>:<page>:<paragraph>`), hogy később visszakereshető legyen.
4. A rendszer a darabolt tartalmat vektorindexbe helyezi, így az ágensek célzottan tudnak keresni.

### 6.2 Ágens-vezérelt elemzés
1. **Konzisztencia-Őr**: állításokat (claim) emel ki minden dokumentumból, majd ellentmondásokat keres claim-párok között.
2. **Kötelező Elem Checker**: a 32/2017 NGM rendelet szerinti checklist alapján elemenként minősít: megvan / hiányos / hiányzik.
3. **Benchmark Validátor**: interkvartilis tartományt olvas a benchmarkból, és összeveti a Local File tényszámaival.
4. Az orchestrator közös munkamemóriát tart fenn, így a második és harmadik ágens látja az előző eredményeit.

### 6.3 Aggregáció és priorizálás
1. Az aggregátor egyesíti a három ágens findings listáját.
2. Minden finding kap súlyosságot: `critical`, `high`, `medium`, `low`.
3. A súlyosságokból összesített kockázati pontszám készül.
4. A rendszer kiszámítja a becsült NAV-kitettséget (ahol számszerűsíthető a pénzügyi hatás).

### 6.4 Kimenet
- Vezetői összefoglaló kockázati szinttel.
- Részletes findings lista forráshivatkozásokkal.
- Tranzakció szintű benchmark megfelelési státusz.
- Kötelező elemek megfelelőségi mátrixa.

---

## 7. SZABÁLYRENDSZER ÉS OSZTÁLYOZÁS

Az elemzés szabályalapú és LLM-alapú réteget kombinál:

- **Dokumentum-besorolás**: dokumentumtípus azonosítás kulcsszavak és szerkezeti jelek alapján.
- **TP módszer-besorolás**: CUP, RPM, CPM, TNMM, PSM felismerés és validáció.
- **Súlyosság-besorolás**: finding-ok minősítése kritikus/magas/közepes/alacsony szintre.
- **NAV kockázati kategóriák**: audit-trigger és kitettség szerinti besorolás.

A szabályok célja, hogy az output konzisztens legyen, visszaellenőrizhető legyen, és ne csak szabad szöveges LLM-válaszból álljon.

---

## 8. KORLÁTOK ÉS MINŐSÉGBIZTOSÍTÁS

### Korlátok
- A rendszer nem helyettesíti az adótanácsadói szakmai döntést.
- A parser minősége befolyásolja az eredmény pontosságát (különösen komplex PDF esetén).
- A benchmark értékeléshez megfelelő minőségű összehasonlító adatok szükségesek.

### Minőségbiztosítás
- Minden finding csak forráshivatkozással érvényes.
- A bizonyossági szint kötelező mező.
- A beépített szintetikus hibákon rendszeres visszamérés történik (ground truth ellen).
- A végső riport emberi validációval zárul.

---

*"Nem azt mondjuk meg mi van a dokumentumban. Azt mondjuk meg miért fontos, és mit kell vele csinálni."*
