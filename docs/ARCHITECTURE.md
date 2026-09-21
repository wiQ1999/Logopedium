# Architektura i środowisko

## 1. Przeznaczenie

Decyzje techniczne, struktura projektu oraz warunki uruchomienia i publikacji.

---

## 2. Decyzje techniczne

| Obszar | Decyzja |
|---|---|
| Typ aplikacji | statyczna SPA, jeden dokument HTML, routing na fragmencie adresu, bez backendu |
| Technologie | HTML, CSS i JavaScript w modułach, bez zależności produkcyjnych |
| Proces budowania | brak — kod publikowany w postaci, w jakiej jest pisany |
| Baza danych | jeden plik JSON; odczyt przy starcie, edycja kopii w pamięci i eksport całości |
| Stan sesji | w pamięci przeglądarki i w adresie; plan sesji nie jest zapisywany trwale |
| Ustawienia użytkownika | trwały zapis po stronie przeglądarki, bez backendu i bez konta |
| Hosting | statyczny, bez konfiguracji serwera |

Konsekwencje:

- Brak gotowych mechanizmów zarządzania stanem i komponentami — ograniczające przy rozbudowie
  o widoki współdzielące złożony stan.
- Aktualizacja wdrożonej treści wymaga zastąpienia pliku bazy i ponownej publikacji.
- Trwały zapis ustawień jest lokalny dla przeglądarki i urządzenia (§5).

---

## 3. Struktura projektu

```
logopedium/
├─ README.md                  # uruchomienie lokalne, publikacja, spis dokumentacji
├─ package.json               # type: module, skrypty start i test
│
├─ docs/                      # ARCHITECTURE, APPLICATION, DATA-SCHEMA, DECISIONS
├─ tools/serve.js             # lokalny serwer HTTP bez zależności
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
      │  ├─ params.js         # obsługa parametrów
      │  ├─ rng.js            # losowanie z ziarnem
      │  ├─ picker.js         # budowa planu sesji
      │  ├─ session.js        # przechodzenie przez ćwiczenia
      │  ├─ browse.js         # przeglądanie bazy
      │  ├─ editor.js         # edycja, podgląd i eksport bazy
      │  ├─ settings.js       # trwały zapis ustawień w przeglądarce
      │  └─ render.js         # wyświetlanie treści
      │
      ├─ data/database.json   # kompletna baza ćwiczeń
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

---

## 5. Trwały zapis ustawień w przeglądarce

Aplikacja zapamiętuje parametry sesji między wizytami (APPLICATION §3.8), wyłącznie po
stronie przeglądarki: bez backendu, bazy scentralizowanej i konta użytkownika.

Wybrany mechanizm: **`localStorage`**, klucz `logopedium.params`, wartość JSON z polem `version`
(kształt zapisu, niezależny od wersji bazy). Zapisywana jest lista bloków; blok obejmujący całą
swoją kategorię pomija listę ćwiczeń, więc układ domyślny zajmuje ~2,3 kB.

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
#/session/3?d=2026-09-10&l=4&c=gloska-dz:1:2:12:kolejnosc,opozycje-fonologiczne:1:2:7:losowo:opozycje-c-cz-w-jednym-wyrazie&seed=...
```

- Adres jest jedynym nośnikiem stanu konkretnej sesji, który przeżywa przeładowanie
  i daje się przekazać dalej; `localStorage` niesie wyłącznie wartości początkowe formularza.
- Kategorie i ćwiczenia identyfikowane po `id`, nie po indeksie — indeks rozjechałby się
  po zmianie bazy.
- `c` wymienia bloki aktywne, w kolejności wyświetlania; kategoria bez aktywnego bloku wraca
  na pozycję domyślną.
- Wpis to `id:ćwiczenia:W:P:tryb`, zawsze komplet — także gdy formularz ukrył pole `W` albo `P`
  (APPLICATION §3.4), bo adres niesie wartości obowiązujące, nie stan interfejsu. Składniki
  urwane przy ręcznej edycji przyjmują krańce swojego bloku.
- Blok węższy od swojej kategorii — po podziale albo wyłączeniu ćwiczeń — dopisuje szósty
  składnik: identyfikatory swoich ćwiczeń złączone `+`, w kolejności bloku. Blok obejmujący
  kategorię w całości listę pomija, więc adres domyślnej sesji ma ~1,5 kB.
- Dwa bloki tej samej kategorii różnią się listą ćwiczeń, bo ćwiczenie należy do jednego bloku.
- Wartości spoza zakresu są przycinane przy odczycie, ćwiczenia nieznane i powtórzone pomijane —
  ręcznie zmieniony adres nie psuje aplikacji.
- Tryb przeglądania trzyma w adresie filtry i aktualizuje je przez `replaceState`,
  żeby nie zaśmiecać historii.

---

## 7. Publikacja

- Katalog aplikacji kopiowany na hosting statyczny w całości.
- Brak kroku budowania, zmiennych środowiskowych i konfiguracji serwera.
- Routing na fragmencie adresu nie wymaga przekierowań po stronie serwera.
- Każda zmiana zawartości bazy musi podnieść jej numer wersji.

---

## 8. Ograniczenia wynikające z braku backendu

| Ograniczenie | Konsekwencja |
|---|---|
| Brak kont użytkowników | brak rozróżnienia osób, także w tej samej przeglądarce |
| Brak synchronizacji | stan i ustawienia nie przenoszą się między urządzeniami |
| Zapis tylko lokalny | wyczyszczenie danych witryny kasuje ustawienia bezpowrotnie |
| Baza po stronie klienta | cała zawartość dostępna dla każdego, kto otworzy adres |
| Brak zapisu na serwerze | edytor pobiera nowy `database.json`; wdrożenie wymaga zastąpienia pliku |

---

## 9. Zaufanie do treści

Treść ćwiczeń zawiera znaczniki formatujące i jest renderowana jako kod, a nie czysty tekst.
Edytor nie przyjmuje dowolnego HTML: wpisana treść jest traktowana jak tekst, a pasek tworzy tylko
dozwolone tagi i klasy z DATA-SCHEMA. Podgląd i eksport korzystają z tej samej sanitacji;
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
obecność treści i zakres poziomu. Pola informacyjne (`readQuality`, `source.kind`, `phonemes`,
`positions`) nie są sprawdzane słownikowo — ich rozszerzenie nie powinno blokować startu.
Ta sama walidacja obejmuje roboczą kopię po edycji i musi przejść przed eksportem.

**Dostępność.** Nawigacja w sesji także strzałkami, fokus wracający na główny obszar po zmianie
stanu, nagłówek pierwszego poziomu w każdym stanie. Lista parametrów porządkowana jest
przeciąganiem, więc uchwyt wiersza musi działać także z klawiatury — przejęcie wiersza,
przesunięcie strzałkami, upuszczenie lub wycofanie — a każdy ruch musi być zapowiadany
komunikatem dla czytnika ekranu. Pasek edytora musi zachowywać zaznaczenie przy obsłudze
klawiaturą, a nazwa przycisku ma opisywać znaczenie nakładanej klasy.

---

## 11. Poza zakresem

- konta użytkowników i synchronizacja między urządzeniami,
- trwały zapis postępu w sesji oraz historia sesji,
- ograniczanie powtórek między dniami,
- statystyki historyczne,
- nagrywanie dźwięku i ocena wykonania,
- tryb offline.
