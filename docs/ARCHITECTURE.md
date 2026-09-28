# Architektura i środowisko

## 1. Przeznaczenie

Decyzje techniczne, struktura projektu oraz warunki uruchomienia i publikacji.

---

## 2. Decyzje techniczne

| Obszar | Decyzja |
|---|---|
| Typ aplikacji | statyczna SPA, jeden dokument HTML, routing na fragmencie adresu, bez backendu |
| Technologie | HTML, CSS i JavaScript w modułach; jedyna zależność produkcyjna to biblioteka przeciągania (§10), dołączona do repozytorium; bez frameworku interfejsu |
| Proces budowania | brak — kod publikowany w postaci, w jakiej jest pisany |
| Baza danych | jeden plik JSON; odczyt przy starcie, zapis zmian bezpośrednio do pliku przez lokalny serwer (§4), bez kopii pośredniej |
| Stan sesji | w pamięci przeglądarki i w adresie; plan sesji nie jest zapisywany trwale |
| Ustawienia użytkownika | trwały zapis po stronie przeglądarki, bez backendu i bez konta |
| Hosting | statyczny, bez konfiguracji serwera |

Konsekwencje:

- Brak gotowych mechanizmów zarządzania stanem i komponentami — ograniczające przy rozbudowie
  o widoki współdzielące złożony stan.
- Zapis bazy wymaga serwera z obsługą zapisu (§4); wdrożona treść zmienia się po ponownej
  publikacji katalogu aplikacji.
- Trwały zapis ustawień jest lokalny dla przeglądarki i urządzenia (§5).

---

## 3. Struktura projektu

```
logopedium/
├─ README.md                  # uruchomienie lokalne, publikacja, spis dokumentacji
├─ package.json               # type: module, skrypty start i test
│
├─ docs/                      # ARCHITECTURE, APPLICATION, DATA-SCHEMA, DECISIONS, BACKLOG
├─ tools/serve.js             # lokalny serwer HTTP bez zależności, z zapisem bazy
├─ tests/                     # testy uruchamiane przez node --test
│
└─ src/
   └─ webapp/                 # katalog deployowalny — jego zawartość trafia na hosting
      ├─ index.html           # jedyny dokument HTML
      │
      ├─ css/                 # base (reset, zmienne), layout, marks (oznaczenia treści)
      │
      ├─ js/
      │  ├─ main.js           # start aplikacji, routing, przełączanie stanów
      │  ├─ data.js           # wczytanie i walidacja bazy
      │  ├─ params.js         # formularz parametrów i przeciąganie
      │  ├─ blocks.js         # model bloków, limity, adres i zapis parametrów
      │  ├─ rng.js            # losowanie z ziarnem
      │  ├─ picker.js         # budowa planu sesji
      │  ├─ session.js        # przechodzenie przez ćwiczenia
      │  ├─ browse.js         # przeglądanie bazy
      │  ├─ editor.js         # edycja, podgląd i zapis bazy
      │  ├─ html.js           # dozwolone znaczniki i sanitacja treści
      │  ├─ settings.js       # trwały zapis ustawień w przeglądarce
      │  └─ render.js         # wyświetlanie treści
      │
      ├─ data/database.json   # kompletna baza ćwiczeń
      ├─ vendor/              # dołączone biblioteki, w postaci niezmienionej (§10)
      └─ assets/              # img (ilustracje), icons
```

Zasady:

- Katalog aplikacji jest samowystarczalny i pozbawiony zależności — publikacja polega
  na skopiowaniu go w całości. Dokumentacja, testy i narzędzia zostają poza nim.
- Baza leży wewnątrz katalogu aplikacji, bo jest pobierana zapytaniem sieciowym.
- Podział kodu według odpowiedzialności, nie według stanów interfejsu.

---

## 4. Uruchomienie lokalne

Wymagany lokalny serwer HTTP uruchomiony w katalogu aplikacji — otwarcie dokumentu wprost
z dysku blokuje pobranie bazy. Ograniczenie dotyczy wyłącznie pracy lokalnej.

Serwer z `tools/serve.js` obsługuje także zapis bazy z edytora (APPLICATION §7.1):

- zapis dotyczy wyłącznie pliku `data/database.json` i jest przyjmowany tylko z adresu
  pętli zwrotnej;
- serwer waliduje przesłaną bazę tym samym walidatorem co klient (§10) i odrzuca niezgodną,
  nie ruszając pliku;
- plik podmieniany jest atomowo — zapis do pliku tymczasowego i zmiana nazwy — więc przerwany
  zapis nie zostawia uszkodzonej bazy;
- edytor wykrywa brak obsługi zapisu (inny serwer statyczny, hosting) i wyłącza edycję.

---

## 5. Trwały zapis ustawień w przeglądarce

Aplikacja zapamiętuje parametry sesji między wizytami (APPLICATION §3.8), wyłącznie po
stronie przeglądarki: bez backendu, bazy scentralizowanej i konta użytkownika.

Wybrany mechanizm: **`localStorage`**, klucz `logopedium.params`, wartość JSON z polem `version`
(kształt zapisu, niezależny od wersji bazy). Zapisywana jest lista bloków; blok obejmujący całą
swoją kategorię w kolejności domyślnej pomija listę ćwiczeń, więc układ domyślny zajmuje ~2,3 kB.

| Mechanizm | Ocena |
|---|---|
| `localStorage` | **wybrany** — trwały, pojemny, synchroniczny, nie obciąża zapytań |
| `sessionStorage` | odrzucony — znika przy zamknięciu karty |
| ciasteczka | odrzucone — układ domyślny ma po zakodowaniu ~3,9 kB przy limicie ~4 kB na ciasteczko, a po podziale kategorii przekracza go wielokrotnie |
| IndexedDB | odrzucony — asynchroniczne API nieproporcjonalne do kilkuset bajtów ustawień |

Zasady:

- Niezgodna wersja zapisu powoduje odrzucenie całości i powrót do wartości domyślnych,
  nie migrację.
- Odczyt i zapis obudowane obsługą wyjątku — magazyn bywa niedostępny (tryb prywatny,
  blokada witryny, wyczerpany limit). Niedostępność nie przerywa startu i nie daje komunikatu.
- Odczytana wartość jest danymi z zewnątrz: podlega walidacji i przycięciu jak parametry z adresu.
- Zapis nie zawiera danych osobowych — wyłącznie identyfikatory kategorii i ćwiczeń oraz liczby.

---

## 6. Stan w adresie

Adres niesie komplet parametrów sesji, ziarno i numer kroku, np.

```
#/session/3?s=WzEsIjIuMCIsIjIwMjYtMDktMjIiLCIyMDI2LTA5LTIyIiw0LFtbMCw2LDIsMTAsMF0sLi4uXQ
```

- Adres jest jedynym nośnikiem stanu konkretnej sesji, który przeżywa przeładowanie
  i daje się przekazać dalej; `localStorage` niesie wyłącznie wartości początkowe formularza.
- Parametr `s` jest jednym, nieprzezroczystym składnikiem Base64URL. Wewnątrz znajduje się
  zwarta tablica JSON: wersja formatu, `schemaVersion`, `generated`, data, poziom, aktywne bloki
  oraz opcjonalne własne ziarno. Kodowanie nie jest szyfrowaniem.
- Kategorie i ćwiczenia zapisane są jako indeksy z aktualnej bazy. Bezpieczeństwo tej zwartej
  reprezentacji zapewnia powiązanie z dokładną wersją schematu i rewizją treści: stan jest
  odczytywany tylko przy obu zgodnych wartościach.
- Blok niesie liczbę ćwiczeń, `W`, `P`, tryb doboru i — tylko jeśli nie obejmuje całej kategorii
  w jej kolejności domyślnej — indeksy aktywnych ćwiczeń. Dwa bloki tej samej kategorii różnią
  się listą ćwiczeń, bo ćwiczenie należy do jednego bloku.
- Stan podlega ścisłej walidacji i ponownemu kodowaniu kontrolnemu. Uszkodzenie, obca rewizja
  bazy albo starsza wersja formatu odrzuca całość i uruchamia sesję z ustawieniami domyślnymi.
- Domyślny adres sesji ma około 200 znaków, zamiast wcześniejszych około 1,5 kB.
- Tryb przeglądania trzyma w adresie filtry i aktualizuje je przez `replaceState`,
  żeby nie zaśmiecać historii.

---

## 7. Publikacja

- Katalog aplikacji kopiowany na hosting statyczny w całości.
- Brak kroku budowania, zmiennych środowiskowych i konfiguracji serwera.
- Routing na fragmencie adresu nie wymaga przekierowań po stronie serwera.
- Każda publikowana zmiana treści aktualizuje rewizję `generated` (zapis z edytora robi to automatycznie).
  `schemaVersion` zmienia się przy zmianie struktury. Oba pola wchodzą do ziarna losowania.

---

## 8. Ograniczenia wynikające z braku backendu

| Ograniczenie | Konsekwencja |
|---|---|
| Brak kont użytkowników | brak rozróżnienia osób, także w tej samej przeglądarce |
| Brak synchronizacji | stan i ustawienia nie przenoszą się między urządzeniami |
| Zapis tylko lokalny | wyczyszczenie danych witryny kasuje ustawienia bezpowrotnie |
| Baza po stronie klienta | cała zawartość dostępna dla każdego, kto otworzy adres |
| Hosting statyczny nie przyjmuje zapisu | edycja bazy działa tylko na lokalnym serwerze projektu; wdrożenie polega na skopiowaniu katalogu |

---

## 9. Zaufanie do treści

Treść ćwiczeń zawiera znaczniki formatujące i jest renderowana jako kod, a nie czysty tekst.
Edytor nie przyjmuje dowolnego HTML: wpisana treść jest traktowana jak tekst, a pasek tworzy tylko
dozwolone tagi i klasy z DATA-SCHEMA. Podgląd i zapis korzystają z tej samej sanitacji;
niepoprawna treść blokuje zapis zamiast trafiać do renderera.

---

## 10. Wymagania wobec implementacji

**Powtarzalność losowania.** Generator z ziarnem zwraca tę samą sekwencję tylko przy tej samej
kolejności pobierania liczb. Kod budujący plan musi przetwarzać dane w porządku w pełni
określonym: kolejność z tablicy tam, gdzie niesie ją plik, sortowanie po identyfikatorze
wszędzie indziej, porównanie kodowe zamiast zależnego od ustawień językowych, brak odwołań
do wbudowanego generatora losowego, brak polegania na kolejności wstawiania do struktur
pomocniczych.

**Rozdzielenie faz.** Dobór ćwiczeń, dobór wariantów i dobór pozycji to osobne fazy
(APPLICATION §5.2). Faza wariantów i pozycji korzysta z ziarna pochodnego liczonego
z identyfikatora ćwiczenia, żeby zmiana limitów nie przesuwała sekwencji w pozostałych krokach.

**Walidacja bazy.** Wczytanie kończy się sprawdzeniem struktury; zbierane są wszystkie
niezgodności naraz, a aplikacja pokazuje ich listę zamiast pustego interfejsu. Walidowane są
pola wymagane, unikalność identyfikatorów, odwołania do kategorii, znane typy wariantów,
obecność treści i zakres poziomu. Pole informacyjne `readQuality` nie jest sprawdzane
słownikowo — jego rozszerzenie nie powinno blokować startu.
Ta sama walidacja obejmuje bazę po edycji i musi przejść przed zapisem — w edytorze i ponownie
na serwerze (§4). Moduł walidatora nie odwołuje się do API przeglądarki, więc serwer importuje go
bez zmian.

**Przeciąganie.** Płynne przenoszenie wierszy (APPLICATION §3.2) wymaga dwupoziomowej listy
z ruchomą przerwą, animacją sąsiadów, autoprzewijaniem i przytrzymaniem na dotyku. Do tego
wystarczy biblioteka przeciągania — frameworku interfejsu nie potrzeba, bo widoki pozostają
zwykłymi modułami. Wybrany jest **SortableJS** (MIT, bez zależności, wersja przypięta),
dołączony do `src/webapp/vendor/` jako pojedynczy moduł ES i nieprzerabiany; przypięcie wersji
i licencja opisane są w pliku obok. Wymagania wobec integracji:

- lista bloków i listy ćwiczeń w blokach to wzajemnie połączone listy; blok przyjmuje
  ćwiczenie tylko własnej kategorii, a lista bloków — ćwiczenie z dowolnego bloku (nowy blok);
- upuszczenie zmienia model bloków (`blocks.js`), a widok jest z niego odtwarzany — biblioteka
  nie jest źródłem prawdy o kolejności;
- opóźnienie aktywacji na dotyku pozostaje 350 ms (APPLICATION §3.2).

**Dostępność.** Nawigacja w sesji także strzałkami, fokus wracający na główny obszar po zmianie
stanu, nagłówek pierwszego poziomu w każdym stanie. Lista parametrów porządkowana jest
przeciąganiem. Uchwyt działa myszą, po przytrzymaniu dotykiem oraz klawiaturą — przejęcie
wiersza, przesunięcie strzałkami, upuszczenie lub wycofanie — a każdy ruch jest zapowiadany
tym samym komunikatem dla czytnika ekranu. Biblioteka nie obsługuje klawiatury, więc ta droga
pozostaje własnym kodem i korzysta z tych samych operacji na modelu co przeciąganie. Ruch palca
przed upływem czasu przytrzymania pozostaje gestem przewijania. Pasek edytora musi zachowywać zaznaczenie przy obsłudze klawiaturą,
a nazwa przycisku ma opisywać znaczenie nakładanej klasy.

---

## 11. Poza zakresem

- konta użytkowników i synchronizacja między urządzeniami,
- trwały zapis postępu w sesji oraz historia sesji,
- ograniczanie powtórek między dniami,
- statystyki historyczne,
- nagrywanie dźwięku i ocena wykonania,
- tryb offline.
