# Integracja IQAX BigSchedules → sailings.csv (wszyscy armatorzy OPRÓCZ Maerska)

IQAX BigSchedules to **agregator** — jeden klucz API zwraca rozkłady wielu armatorów dla danej trasy w jednym zapytaniu. W tym projekcie IQAX dostarcza **8 armatorów** (MSC, Hapag-Lloyd, COSCO, OOCL, Yang Ming, ONE, CMA CGM, Evergreen). **Maersk jest celowo wykluczony** — pobierasz go z własnego API Maerska (`update-maersk.yml`).

## Podział pracy (kto czym zarządza)
- **IQAX** „posiada" wszystkie wiersze **oprócz** Maerska. Przy każdym przebiegu podmienia tylko wiersze nie-Maerskowe na trasach z danego slice'a; wiersze Maerska zostają nietknięte.
- **Maersk API** „posiada" tylko wiersze Maerska.
- Dzięki temu oba workflowy piszą do tego samego `sailings.csv` bez kasowania sobie danych.

## Pliki
- `scripts/fetch-iqax.mjs` — pobiera 8 armatorów dla par krajów, mapuje do `sailings.csv`.
- `.github/workflows/update-iqax.yml` — harmonogram (Pon/Wt/Śr) + ręczne uruchamianie z wyborem pary krajów.

## Limity licencji (trial) — wbudowane w skrypt
- **150 wywołań/dzień** — dlatego dzielimy na pary krajów.
- **maks. 30 wywołań/minutę** — skrypt robi **2,5 s** przerwy między trasami (~24/min, z zapasem).
- **maks. 3 rozkłady na armatora na wywołanie** — limit trialu; jedna trasa zwróci do 3 najbliższych sailingów każdego armatora.
- Trial trwa 14 dni; niewykorzystane wywołania nie przechodzą na kolejny okres.

## Podział na PARY KRAJÓW
`LANE_GROUP` przyjmuje: jedną parę `cn-pl`, cały kraj origin `cn` (wszystkie cele), listę `cn-pl,in-de`, albo `all`.

Liczba wywołań na parę (origin × cel):
| origin → | PL (2 porty) | DE (3) | NL (1) | BE (1) | suma |
|---|---|---|---|---|---|
| **CN** (8 portów) | 16 | 24 | 8 | 8 | 56 |
| **IN** (11) | 22 | 33 | 11 | 11 | 77 |
| **BD** (3) | 6 | 9 | 3 | 3 | 21 |
| **VN** (5) | 10 | 15 | 5 | 5 | 35 |

**Harmonogram** (każdy dzień ≤ 77 wywołań, mieści się w 150):
- **Poniedziałek 05:00 UTC** → `cn` (56)
- **Wtorek 05:00 UTC** → `in` (77)
- **Środa 05:00 UTC** → `bd,vn` (56)

## Konfiguracja (raz)
1. appKey z https://developer.iqax.com/ (Sailing Schedules API).
2. **Settings → Secrets and variables → Actions → New repository secret** — dodaj dwa:
   - `IQAX_APP_KEY` = Twój appKey
   - `IQAX_BASE` = `https://www.bigschedules.com` (potwierdzony host z panelu IQAX — API Keys → Scopes).
3. Wgraj `scripts/fetch-iqax.mjs` i `.github/workflows/update-iqax.yml`.

## Test
Actions → **„Update schedules (IQAX …)" → Run workflow** → `lane_group = cn-pl` → `debug = true` → Run.
W logu zobaczysz np. `OK CNSHA->PLGDN: 18 sailings (6 carriers)` i `by carrier: MSC:9 COSCO:6 ...`. Plik `iqax-raw.json` to surowa odpowiedź — przyda się do dostrojenia mapowania.

## Kody portów IQAX (ważne)
Twój klucz jest ograniczony do **kodów portów IQAX**, które miejscami różnią się od standardowych UN/LOCODE. Skrypt **wysyła kody IQAX** (wymagane przez klucz), a w odpowiedzi **mapuje je z powrotem** na nasze standardowe kody, żeby CSV i strona były spójne z danymi Maerska. Mapowania:
| IQAX wysyła | Nasz kod | Port |
|---|---|---|
| `CNSHG` | `CNSHA` | Shanghai |
| `CNSZX` | `CNYTN` | Shenzhen / Yantian |
| `CNTSN` | `CNTXG` | Tianjin / Xingang |
| `VNCMV` | `VNCMT` | Cai Mep |
| `VNQNH` | `VNUIH` | Quy Nhon |

Porty występujące tylko w IQAX (Lianyungang `CNLYG`, Nanjing `CNNKG`, Guangzhou `CNCAN`, New Mangalore `INNML`, Mumbai `INBOM`, Dhaka `BDDAC`) zostały dodane do słownika `PORTS` w `hifi-d-data.js`. Pełna lista licencjonowanych kodów (origin/destination/carrier) jest w panelu IQAX → API Keys → Scopes; gdy IQAX rozszerzy Twój scope, dopisz kody w `ORIGIN_GROUPS`/`DEST_GROUPS` skryptu.

## Klucz typu „Browser"
Twój klucz IQAX jest typu **Browser**. Jeśli przy uruchomieniu z GitHub Actions zwróci `401`/`403` mimo poprawnego hosta i appKey (a ten sam adres **działa w przeglądarce**), oznacza to, że klucz ma ograniczenie do origin/domeny. Skrypt wysyła nagłówki `Referer`/`Origin` = `https://www.bigschedules.com`, co zwykle wystarcza; gdyby nie — poproś IQAX o klucz typu **Server** (do wywołań serwerowych) albo o dopisanie dozwolonego origin.

## Endpoint (Big Schedules v2.0.1)
```
GET {IQAX_BASE}/openapi/schedules/routeschedules
  ?appKey=...
  &porID=CNSHA &fndID=PLGDN        (UN/LOCODE)
  &searchDuration=6                (1..8 tygodni)
  &carrier=MSCU,HLCU,COSU,OOLU,YMLU,ONEY,CMDU,ANNU,EGLV   (BEZ Maerska)
  &exposeMaerskService=true
```
Odpowiedź: `routeGroupsList[]` (po armatorze) → `route[]` → `leg[]`. Bierzemy: POL, przeładunek, POD, statek matkę + feeder (nazwa + IMO), kod/nazwę serwisu, ETD/ETA, transit, cut-offy (`cyCutoffTime`→gate-in, `vgmCutoffTime`→VGM, `siCutoffTime`→doc). Wiersze Maerska (gdyby się pojawiły) są pomijane.

## Deduplikacja (bez powtórek, zawsze najnowsza wersja)
Każdy wiersz dostaje znacznik `fetched_at` (czas pobrania). Przy zapisie skrypt grupuje sailingi po **stabilnym kluczu** — armator + POL + POD + przeładunek + serwis + statek matka + numer podróży (`mother_voyage`) — i zostawia **najnowszy**, kasując starszy. Dzięki temu:
- ten sam sailing pobierany co tydzień nie tworzy duplikatów;
- gdy armator zmieni rozkład danej podróży (np. inny ETD), starsza wersja zostaje zastąpiona nowszą;
- różne podróże (inny `mother_voyage`) pozostają jako osobne wpisy.

Kolumna `fetched_at` jest ignorowana przez stronę i edytor (nie wyświetla się). Wiersz dodany/edytowany ręcznie w edytorze dostaje świeży znacznik, więc ma pierwszeństwo nad starszym wpisem z API o tym samym kluczu.

## Nazwy portów
