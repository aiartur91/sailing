# Integracja Maersk API → sailings.csv

Automatyczne pobieranie rozkładów Maersk do pliku `sailings.csv` przez **GitHub Actions**.
Klucz API jest schowany w sekrecie repozytorium — nigdy nie trafia do kodu ani na publiczną stronę.

## Pliki
- `scripts/fetch-maersk.mjs` — pobiera rozkłady Maersk dla 12 par POL→POD, mapuje do formatu `sailings.csv`, zachowuje wiersze innych armatorów.
- `.github/workflows/update-maersk.yml` — harmonogram (poniedziałek 06:00 UTC) + ręczne uruchamianie.

## Konfiguracja (raz)
1. W repozytorium: **Settings → Secrets and variables → Actions → New repository secret**
   - **Name:** `MAERSK_API_KEY`
   - **Value:** Twój klucz (Consumer-Key) z developer.maersk.com
2. Wgraj do repo foldery `scripts/` i `.github/` (obok `index.html` i `sailings.csv`).

## Test
- **Ręcznie na GitHubie:** zakładka **Actions → „Update Maersk schedules" → Run workflow**.
  Zaznacz `debug = true`, by zapisać `maersk-raw.json` (surowa odpowiedź — przyda się, jeśli trzeba poprawić mapowanie pól).
- **Lokalnie** (Node 18+):
  ```bash
  MAERSK_API_KEY=twoj_klucz node scripts/fetch-maersk.mjs --debug
  ```
  Skrypt wypisze ile sailingów pobrał per lane i zaktualizuje `sailings.csv`.

## API (potwierdzone ze specyfikacji)
- **Produkt:** „Ocean – Commercial Schedules [DCSA]" v1
- **Endpoint:** `GET https://api.maersk.com/ocean/commercial-schedules/dcsa/v1/point-to-point-routes`
- **Nagłówek autoryzacji:** `Consumer-Key: <twój klucz>` (+ `API-Version: 1`)
- **Parametry:** `placeOfReceipt`, `placeOfDelivery` (UN/LOCODE), `departureStartDate`, `departureEndDate` (YYYY-MM-DD)
- **Odpowiedź:** tablica `PointToPoint` → każda ma `placeOfReceipt`/`placeOfDelivery` (z `dateTime`), `transitTime` i `legs[]`. Noga (`Leg`) z `transport.vessel.{name,vesselIMONumber}` oraz `transport.servicePartners[].{carrierServiceCode,carrierServiceName,carrierExportVoyageNumber}`.

## Jak działa
1. Dla każdej z 12 par (UN/LOCODE → UN/LOCODE) woła endpoint na najbliższe 6 tygodni.
2. Z `legs[]` wybiera nogi morskie (VESSEL): najdłuższa = statek matka, druga = feeder. Wyciąga: POL, ewentualny przeładunek (TS), POD, statek matkę + feeder (nazwa, voyage, IMO), serwis, ETD/ETA, transit time, numer tygodnia.
3. Z `sailings.csv` zostawia wiersze **innych armatorów**, a wszystkie wiersze MAERSK zastępuje świeżym pobraniem.
4. Workflow commituje `sailings.csv` — strona odświeża się sama.

## Uwagi
- **Cut-offy** nie są częścią rozkładów P2P (pochodzą z modułu ofert/bookingu) — pozostają puste.
- **Błąd 401 `ERR_GW_001`** = zły klucz **albo zły endpoint dla tego klucza** (każdy klucz jest przypięty do konkretnego API). Ten skrypt celuje już w DCSA Commercial Schedules.
- **403** = produkt nieprzypięty/oczekuje na zatwierdzenie; **429** = za dużo zapytań (skrypt zwalnia do ~2/s).
- Jeśli `sailings.csv` po przebiegu nie ma wierszy MAERSK, uruchom z `--debug` i zajrzyj do `maersk-raw.json` — sprawdzimy realną strukturę odpowiedzi.

## Rola: tylko Maersk (reszta przez IQAX)
Ten workflow pobiera **wyłącznie Maerska** z oficjalnego API Maersk. Pozostałych 8 armatorów dostarcza IQAX (`update-iqax.yml`). Skrypt Maersk dotyka **tylko wierszy Maerska** na trasach z danego slice'a — wiersze innych armatorów (z IQAX) zostają nietknięte. Oba workflowy bezpiecznie piszą do tego samego `sailings.csv`.

## Podział na PARY KRAJÓW
`LANE_GROUP` przyjmuje: jedną parę `cn-pl`, cały origin `cn`, listę `cn-de,in-de`, albo `all`. Maersk pomija Gdynię (`PLGDY`) — DCSA P2P nigdy nie zwraca bezpośredniego zawinięcia do Gdyni.

Liczba wywołań na parę (origin × cel; PL = tylko Gdańsk):
| origin → | PL (1) | DE (3) | NL (1) | BE (1) | suma |
|---|---|---|---|---|---|
| **CN** (8) | 8 | 24 | 8 | 8 | 48 |
| **IN** (11) | 11 | 33 | 11 | 11 | 66 |
| **BD** (3) | 3 | 9 | 3 | 3 | 18 |
| **VN** (5) | 5 | 15 | 5 | 5 | 30 |

**Harmonogram** (07:00 UTC — po IQAX o 05:00, by uniknąć kolizji przy commit):
- **Pon** → `cn` (48) · **Wt** → `in-pl,in-nl,in-be` (33) · **Śr** → `in-de` (33) · **Czw** → `bd,vn` (48)

Skrypt: ponawia 429 z narastającym czekaniem (20s→240s, 5 prób, respektuje `Retry-After`), robi ~1,2 s przerwy między trasami, każdy slice podmienia tylko swoje pary (POL+POD).

> Jeśli mimo to widzisz `429`, dzienny limit Twojego klucza Maersk jest niski — odpalaj pojedyncze pary (`cn-de` osobno) rzadziej, albo poproś Maersk o wyższą quotę. Grupy/porty zmienisz w `ORIGIN_GROUPS`/`DEST_GROUPS` na górze skryptu.

## Deduplikacja (bez powtórek, zawsze najnowsza wersja)
Każdy wiersz dostaje znacznik `fetched_at`. Przy zapisie skrypt grupuje sailingi po stabilnym kluczu (armator + POL + POD + przeładunek + serwis + statek matka + `mother_voyage`) i zostawia **najnowszy**, kasując starszy. Ten sam sailing pobrany ponownie nie tworzy duplikatu; zmieniony przez armatora rozkład danej podróży zastępuje starszą wersję. Kolumna `fetched_at` jest ignorowana przez stronę i edytor.

## Nazwy portów (zasada systemowa)
W skrypcie i CSV trzymamy **kody UN/LOCODE** (np. `CNSHA`, `MAPTM`, `PLGDN`). Strona zamienia je na czytelne nazwy (Shanghai, Tanger Med, Gdańsk) przez słownik `PORTS` w `hifi-d-data.js`. Jeśli API zwróci hub, którego nie ma w słowniku, strona pokaże sam kod — dopisz go wtedy do `PORTS`. Ta sama zasada obowiązuje przyszłe integracje innych armatorów.
