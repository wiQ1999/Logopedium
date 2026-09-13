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
| Baza danych | jeden plik JSON, tylko do odczytu |
| Stan sesji | w pamięci przeglądarki i w adresie; plan sesji nie jest zapisywany trwale |
| Ustawienia użytkownika | trwały zapis po stronie przeglądarki, bez backendu i bez konta |
| Hosting | statyczny, bez konfiguracji serwera |

Konsekwencje:

- Brak gotowych mechanizmów zarządzania stanem i komponentami — ograniczające przy rozbudowie
  o widoki współdzielące złożony stan.
- Aktualizacja treści wymaga ponownej publikacji całości.
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

Aplikacja zapamiętuje parametry sesji między wizytami (APPLICATION §3.7), wyłącznie po
stronie przeglądarki: bez backendu, bazy scentralizowanej i konta użytkownika.

Wybrany mechanizm: **`localStorage`**, klucz `logopedium.params`, wartość JSON z polem `version`
(kształt zapisu, niezależny od wersji bazy).

| Mechanizm | Ocena |
|---|---|
| `localStorage` | **wybrany** — trwały, pojemny, synchroniczny, nie obciąża zapytań |
| `sessionStorage` | odrzucony — znika przy zamknięciu karty |
| ciasteczka | odrzucone — limit ~4 kB nie mieści listy 30 kategorii, doklejane do każdego zapytania |
| IndexedDB | odrzucony — asynchroniczne API nieproporcjonalne do kilkuset bajtów ustawień |

Zasady:

- Niezgodna wersja zapisu powoduje odrzucenie całości i powrót do wartości domyślnych,
  nie migrację.
- Odczyt i zapis obudowane obsługą wyjątku — magazyn bywa niedostępny (tryb prywatny,
  blokada witryny, wyczerpany limit). Niedostępność nie przerywa startu i nie daje komunikatu.
- Odczytana wartość jest danymi z zewnątrz: podlega walidacji i przycięciu jak parametry z adresu.
- Zapis nie zawiera danych osobowych — wyłącznie identyfikatory kategorii i liczby.

---

## 6. Stan w adresie

Adres niesie komplet parametrów sesji, ziarno i numer kroku, np.

```
#/session/3?d=2026-09-10&l=4&c=gloska-dz:1:2:12,tekst-do-czytania:2:1:0&o=kolejnosc&seed=...
```

- Adres jest jedynym nośnikiem stanu konkretnej sesji, który przeżywa przeładowanie
  i daje się przekazać dalej; `localStorage` niesie wyłącznie wartości początkowe formularza.
- Kategorie identyfikowane po `id`, nie po indeksie — indeks rozjechałby się po zmianie bazy.
- `c` wymienia tylko kategorie aktywne, w kolejności wyświetlania; nieaktywne wracają
  na pozycje domyślne. Każdy wpis to `id:ćwiczenia:W:P` — komplet, także gdy formularz ukrył
  pole `W` albo `P` (APPLICATION §3.3); adres niesie wartości obowiązujące, nie stan interfejsu.
  Składniki urwane przy ręcznej edycji przyjmują krańce swojej kategorii.
- Wartości spoza zakresu są przycinane przy odczycie — ręcznie zmieniony adres nie psuje aplikacji.
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

---

## 9. Zaufanie do treści

Treść ćwiczeń zawiera znaczniki formatujące i jest renderowana jako kod, a nie czysty tekst.
Dopuszczalne wyłącznie dlatego, że źródło jest w pełni kontrolowane przez autora bazy.
Wprowadzenie edycji bazy lub importu danych wymaga przeprojektowania mechanizmu wyświetlania.

---

## 10. Wymagania wobec implementacji

**Powtarzalność losowania.** Generator z ziarnem zwraca tę samą sekwencję tylko przy tej samej
kolejności pobierania liczb. Kod budujący plan musi przetwarzać dane w porządku w pełni
określonym: sortowanie po jednoznacznym kryterium przed każdą iteracją, porównanie kodowe
zamiast zależnego od ustawień językowych, brak odwołań do wbudowanego generatora losowego,
brak polegania na kolejności wstawiania do struktur pomocniczych.

**Rozdzielenie faz.** Dobór ćwiczeń, dobór wariantów i dobór pozycji to osobne fazy
(APPLICATION §5.2). Faza wariantów i pozycji korzysta z ziarna pochodnego liczonego
z identyfikatora ćwiczenia, żeby zmiana limitów nie przesuwała sekwencji w pozostałych krokach.

**Walidacja bazy.** Wczytanie kończy się sprawdzeniem struktury; zbierane są wszystkie
niezgodności naraz, a aplikacja pokazuje ich listę zamiast pustego interfejsu. Walidowane są
pola wymagane, unikalność identyfikatorów, odwołania do kategorii, znane typy wariantów,
obecność treści i zakres poziomu. Pola informacyjne (`readQuality`, `source.kind`, `phonemes`,
`positions`) nie są sprawdzane słownikowo — ich rozszerzenie nie powinno blokować startu.

**Dostępność.** Nawigacja w sesji także strzałkami, fokus wracający na główny obszar po zmianie
stanu, nagłówek pierwszego poziomu w każdym stanie, przestawianie kategorii przyciskami
zamiast przeciągania.

---

## 11. Poza zakresem

- konta użytkowników i synchronizacja między urządzeniami,
- trwały zapis postępu w sesji oraz historia sesji,
- ograniczanie powtórek między dniami,
- edycja bazy z poziomu aplikacji,
- statystyki historyczne,
- nagrywanie dźwięku i ocena wykonania,
- tryb offline.
