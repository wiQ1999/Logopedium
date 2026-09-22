# Ćwiczenia logopedyczne

Statyczna aplikacja SPA prowadząca codzienną sesję ćwiczeń logopedycznych. Zestaw zadań
na dany dzień dobierany jest losowo z bazy przygotowanej na podstawie materiału źródłowego,
a użytkownik przechodzi przez kolejne ćwiczenia, jedno po drugim.

Aplikacja działa w całości po stronie przeglądarki, bez backendu i bez konta użytkownika.
Baza ćwiczeń jest plikiem JSON publikowanym razem z kodem. Sesję układa się z bloków
o niezależnych ustawieniach, zapamiętywanych lokalnie między wizytami. Poza sesją można
przeglądać i edytować ćwiczenia oraz warianty z podglądem na żywo i eksportem całej bazy.

## Uruchomienie

Aplikacja wymaga lokalnego serwera HTTP uruchomionego w katalogu `src/webapp/`. Otwarcie
pliku `index.html` bezpośrednio z dysku uniemożliwia wczytanie bazy.

Serwer dołączony do repozytorium (Node 20+, bez zależności):

```bash
npm start
```

Aplikacja nasłuchuje pod `http://localhost:4173/` (port zmienia zmienna `PORT`).

Dowolny inny serwer statyczny działa tak samo, na przykład:

```bash
python -m http.server 4173 --directory src/webapp
```

## Testy

```bash
npm test
```

Wbudowany `node --test`: dane, losowanie, bloki, zapis ustawień, bezpieczny HTML i eksport JSON,
a także widoki, edytor i trasy na `jsdom` — jedynej zależności deweloperskiej. Przed pierwszym
uruchomieniem testów wykonaj `npm ci`. Aplikacja nie ma zależności produkcyjnych.

## Publikacja

Katalog `src/webapp/` jest samowystarczalny — publikacja polega na skopiowaniu jego zawartości
na hosting statyczny. Poza nim znajdują się wyłącznie dokumentacja, testy i narzędzia
deweloperskie, które nie trafiają na hosting.

## Dokumentacja

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — decyzje techniczne, struktura projektu,
  zapis stanu, uruchomienie i publikacja.
- **[docs/APPLICATION.md](docs/APPLICATION.md)** — wymagania funkcjonalne: parametry sesji,
  dobór i losowanie ćwiczeń, przebieg sesji, przeglądanie bazy.
- **[docs/DATA-SCHEMA.md](docs/DATA-SCHEMA.md)** — struktura bazy i notacja treści zadań.
- **[docs/DECISIONS.md](docs/DECISIONS.md)** — dziennik decyzji, chronologicznie.
