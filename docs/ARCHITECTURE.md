# Architektura i środowisko

## 1. Przeznaczenie

Dokument określa decyzje techniczne, strukturę projektu oraz warunki uruchomienia
i publikacji aplikacji do ćwiczeń logopedycznych.

---

## 2. Decyzje techniczne

| Obszar | Decyzja |
|---|---|
| Typ aplikacji | statyczna SPA, jeden dokument HTML, bez backendu |
| Technologie | HTML, CSS i JavaScript w modułach |
| Proces budowania | brak — kod publikowany w postaci, w jakiej jest pisany |
| Baza danych | jeden plik JSON, tylko do odczytu |
| Stan aplikacji | wyłącznie w pamięci przeglądarki, bez trwałego zapisu |
| Hosting | statyczny, bez konfiguracji serwera |

Konsekwencje:

- Brak gotowych mechanizmów zarządzania stanem i komponentami — akceptowalne przy obecnym
  zakresie, ograniczające przy rozbudowie o widoki współdzielące złożony stan.
- Aktualizacja treści wymaga ponownej publikacji całości.

---

## 3. Struktura projektu

```
logopedium/
├─ README.md                  # uruchomienie lokalne, publikacja, spis dokumentacji
│
├─ docs/
│  ├─ ARCHITECTURE.md         # decyzje techniczne i środowisko
│  ├─ APPLICATION.md          # wymagania funkcjonalne
│  └─ DATA-SCHEMA.md          # struktura bazy danych i notacja treści ćwiczeń
│
└─ src/
   └─ webapp/                 # katalog deployowalny — jego zawartość trafia na hosting
      ├─ index.html           # jedyny dokument HTML
      │
      ├─ css/
      │  ├─ base.css          # reset, zmienne, typografia
      │  ├─ layout.css        # układ interfejsu
      │  └─ marks.css         # oznaczenia w treści ćwiczeń
      │
      ├─ js/
      │  ├─ main.js           # start aplikacji, przełączanie stanów
      │  ├─ data.js           # wczytanie i walidacja bazy
      │  ├─ params.js         # obsługa parametrów
      │  ├─ rng.js            # losowanie z ziarnem
      │  ├─ picker.js         # budowa planu sesji
      │  ├─ session.js        # przechodzenie przez ćwiczenia
      │  ├─ browse.js         # przeglądanie bazy
      │  └─ render.js         # wyświetlanie treści
      │
      ├─ data/
      │  └─ database.json     # kompletna baza ćwiczeń
      │
      └─ assets/
         ├─ img/              # ilustracje towarzyszące ćwiczeniom
         └─ icons/
```

Zasady:

- README w katalogu głównym jako punkt wejścia, pozostała dokumentacja w `docs/`.
  Dokumentacja nie trafia na hosting.
- Katalog aplikacji jest samowystarczalny — publikacja polega na wskazaniu go w całości.
- Baza leży wewnątrz katalogu aplikacji, ponieważ jest pobierana zapytaniem sieciowym
  w czasie działania.
- Podział kodu według odpowiedzialności, nie według stanów interfejsu.

---

## 4. Uruchomienie lokalne

Wymagany lokalny serwer HTTP uruchomiony w katalogu aplikacji. Otwarcie dokumentu wprost
z dysku uniemożliwia pobranie bazy — przeglądarka blokuje takie zapytanie ze względów
bezpieczeństwa. Ograniczenie dotyczy wyłącznie pracy lokalnej.

---

## 5. Publikacja

- Katalog aplikacji kopiowany na hosting statyczny w całości.
- Brak kroku budowania, zmiennych środowiskowych i konfiguracji serwera.
- Nawigacja oparta na fragmencie adresu — nie wymaga przekierowań po stronie serwera,
  zachowuje działanie przycisku „wstecz" i pozwala na odnośniki do konkretnego stanu.
- Każda zmiana zawartości bazy musi podnieść jej numer wersji.

---

## 6. Ograniczenia wynikające z braku backendu

| Ograniczenie | Konsekwencja |
|---|---|
| Brak kont użytkowników | brak rozróżnienia osób korzystających z aplikacji |
| Brak synchronizacji | stan nie przenosi się między urządzeniami |
| Baza po stronie klienta | cała zawartość dostępna dla każdego, kto otworzy adres |

---

## 7. Zaufanie do treści

Treść ćwiczeń zawiera znaczniki formatujące i jest renderowana jako kod, a nie czysty tekst.
Jest to dopuszczalne wyłącznie dlatego, że źródło jest w pełni kontrolowane przez autora bazy.

Aplikacja nie renderuje treści pochodzącej od użytkownika ani ze źródeł zewnętrznych.
Wprowadzenie edycji bazy lub importu danych wymaga przeprojektowania mechanizmu wyświetlania.

---

## 8. Wymagania wobec implementacji

### Powtarzalność losowania

Generator z ziarnem zwraca tę samą sekwencję wyłącznie przy zachowaniu tej samej kolejności
pobierania liczb. Kod budujący plan sesji musi przetwarzać dane w porządku w pełni
określonym, niezależnym od kolejności zapisu w pliku i od kolejności kluczy w strukturach
pomocniczych.

Wymagane: sortowanie po jednoznacznym kryterium przed każdą iteracją, brak odwołań do
wbudowanego generatora losowego, brak polegania na kolejności wstawiania do struktur
pomocniczych.

### Walidacja bazy

Wczytanie bazy kończy się sprawdzeniem struktury. Niezgodność skutkuje czytelnym komunikatem
wskazującym przyczynę, nie pustym interfejsem.

---

## 9. Kolejność implementacji

1. Wczytanie i walidacja bazy.
2. Przeglądanie bazy — przed jakąkolwiek logiką losowania, jako weryfikacja poprawności
   danych i oznaczeń.
3. Losowanie z ziarnem wraz z testem powtarzalności.
4. Obsługa parametrów.
5. Budowa planu sesji.
6. Przechodzenie przez ćwiczenia.

---

## 10. Poza zakresem pierwszej wersji

- konta użytkowników i synchronizacja między urządzeniami,
- trwały zapis ustawień i postępu,
- edycja bazy z poziomu aplikacji,
- statystyki historyczne,
- nagrywanie dźwięku i ocena wykonania,
- tryb offline.
