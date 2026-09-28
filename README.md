# Ćwiczenia logopedyczne

Statyczna aplikacja SPA prowadząca codzienną sesję ćwiczeń logopedycznych. Zestaw zadań
na dany dzień dobierany jest losowo z bazy przygotowanej na podstawie materiału źródłowego,
a użytkownik przechodzi przez kolejne ćwiczenia, jedno po drugim.

Aplikacja działa w całości po stronie przeglądarki, bez backendu i bez konta użytkownika.
Baza ćwiczeń jest plikiem JSON publikowanym razem z kodem. Sesję układa się z bloków
o niezależnych ustawieniach, zapamiętywanych lokalnie między wizytami. Poza sesją można
przeglądać i edytować ćwiczenia oraz warianty z podglądem na żywo; zapis edycji trafia
bezpośrednio do pliku bazy (wymaga serwera z `npm start`).

## Uruchomienie

Aplikacja wymaga lokalnego serwera HTTP uruchomionego w katalogu `src/webapp/`. Otwarcie
pliku `index.html` bezpośrednio z dysku uniemożliwia wczytanie bazy.

Serwer dołączony do repozytorium (Node 20+, bez zależności):

```bash
npm start
```

Aplikacja nasłuchuje pod `http://localhost:4173/` (port zmienia zmienna `PORT`). Edycję bez
ruszania bazy repozytorium można wypróbować na kopii:

```bash
npm start -- --database kopia-bazy.json
```

Dowolny inny serwer statyczny pozwala przeglądać aplikację, ale nie obsługuje zapisu bazy,
więc edycja jest wtedy wyłączona. Na przykład:

```bash
python -m http.server 4173 --directory src/webapp
```

## Treść bazy

Poprawki i pojedyncze nowe ćwiczenia nanosi się w edytorze aplikacji, partie zadań ze skanów —
plikiem importu. Obie drogi opisuje [docs/CONTENT.md](docs/CONTENT.md).

```bash
npm run import -- zadania.json --dry-run
```

```bash
npm run validate
```

## Testy

```bash
npm test
```

Wbudowany `node --test`: dane, losowanie, wersjonowany stan sesji w adresie, bloki i ich
przeciąganie (SortableJS) oraz obsługa klawiaturą, zapis ustawień, bezpieczny HTML, serwer
z zapisem bazy i import, a także widoki, podgląd ćwiczeń w parametrach, edytor i trasy
na `jsdom`. Przed pierwszym
uruchomieniem testów wykonaj `npm ci`. Zależności deweloperskie to `jsdom` i `sortablejs`
(wzorzec do sprawdzenia dołączonej kopii). Jedyną zależnością produkcyjną jest ta kopia
biblioteki przeciągania w `src/webapp/vendor/`, bez kroku budowania.

## Publikacja

Katalog `src/webapp/` jest samowystarczalny — publikacja polega na skopiowaniu jego zawartości
na hosting statyczny. Poza nim znajdują się wyłącznie dokumentacja, testy i narzędzia
deweloperskie, które nie trafiają na hosting. Hosting statyczny nie przyjmuje zapisu, więc
opublikowana aplikacja pozwala przeglądać bazę, ale nie edytować jej.

## Dokumentacja

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — decyzje techniczne, struktura projektu,
  zapis stanu, uruchomienie i publikacja.
- **[docs/APPLICATION.md](docs/APPLICATION.md)** — wymagania funkcjonalne: parametry sesji,
  dobór i losowanie ćwiczeń, przebieg sesji, przeglądanie bazy.
- **[docs/DATA-SCHEMA.md](docs/DATA-SCHEMA.md)** — struktura bazy i notacja treści zadań.
- **[docs/CONTENT.md](docs/CONTENT.md)** — poprawki w edytorze i import zadań ze skanów.
- **[docs/DECISIONS.md](docs/DECISIONS.md)** — dziennik decyzji, chronologicznie.
- **[docs/BACKLOG.md](docs/BACKLOG.md)** — zadania przyjęte do wykonania.
