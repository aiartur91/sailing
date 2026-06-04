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

## Jak działa
1. Dla każdej z 12 par (UN/LOCODE → UN/LOCODE) woła endpoint Maersk Point-to-Point Schedules na najbliższe 6 tygodni, carrier = `MAEU`.
2. Z odpowiedzi wyciąga: POL, ewentualny przeładunek (TS), POD, statek matkę + feeder (nazwa, voyage, IMO), serwis, ETD/ETA, transit time, numer tygodnia.
3. Z `sailings.csv` zostawia wiersze **innych armatorów**, a wszystkie wiersze MAERSK zastępuje świeżym pobraniem.
4. Workflow commituje `sailings.csv` — strona odświeża się sama.

## Uwagi
- **Endpoint:** w skrypcie ustawiony jest `https://api.maersk.com/schedules/point-to-point`. Sprawdź dokładny adres i parametry na swojej stronie produktu „Point-to-Point Schedules" w portalu Maersk („Try it") — różne konta mogą mieć inny host/wersję. Zmienisz go w stałej `BASE` na górze skryptu.
- **Cut-offy** nie są częścią rozkładów P2P (pochodzą z modułu ofert/bookingu) — pozostają puste.
- **Błąd 401** = zły klucz lub nagłówek; **403** = produkt nieprzypięty do konta; **429** = za dużo zapytań (skrypt już zwalnia do ~2,5/s).
- Jeśli `sailings.csv` po przebiegu nie ma wierszy MAERSK, uruchom z `--debug` i podeślij `maersk-raw.json` — dostroję mapowanie pól do realnej struktury Twojej odpowiedzi.

## Skala
12 par × ~kilka sailingów = kilkadziesiąt wierszy MAERSK. Bezpłatne (GitHub Actions: 2000 min/mc w planie Free, ten job zajmuje <1 min/tydzień).
