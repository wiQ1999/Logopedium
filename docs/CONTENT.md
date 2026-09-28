# Wprowadzanie treści

Dwie drogi zmiany bazy `src/webapp/data/database.json`. Obie działają na komputerze z repozytorium,
sprawdzają całą bazę według DATA-SCHEMA i podnoszą rewizję `generated`. Baza niezgodna ze schematem
nie zostaje zapisana.

| Zmiana | Droga |
|---|---|
| poprawka istniejącego ćwiczenia (literówka, oznaczenia, poziom) | edytor w aplikacji (APPLICATION §7.1) |
| nowe zadania ze skanu | plik importu i `npm run import` |

## Poprawka w edytorze

1. `npm start`, otwórz `http://localhost:4173/`, znajdź ćwiczenie w „Przeglądaj bazę”.
2. „Edytuj ćwiczenie” albo „Edytuj wariant”, popraw treść, oznacz fragmenty paskiem formatowania.
3. „Zapisz w pliku bazy” — zmiana trafia od razu do pliku; komunikat podaje nową rewizję.
4. Zatwierdź plik w repozytorium i opublikuj katalog `src/webapp/`.

Do próby bez ruszania bazy: `npm start -- --database <kopia.json>`.

## Nowe zadania ze skanu

1. **Plik importu.** Skopiuj `tools/templates/import.json` poza katalog aplikacji. Plik zawiera
   `exercises` (wymagane) i `categories` (tylko nowe kategorie; zwykle puste).
2. **Transkrypcja.** Jedno zadanie ze skanu to jedno ćwiczenie; podpunkty „Zadanie 1…n” to warianty.
   - Identyfikatory: `id` ćwiczenia z tytułu, małe litery bez znaków diakrytycznych, słowa
     rozdzielone `-`; wariant `<id>-w1`, pozycja `<id>-w1-p01`. Muszą być nowe — import nie
     nadpisuje istniejących.
   - `categoryId` — jedna z kategorii z DATA-SCHEMA.
   - `type` wariantu według układu na skanie: lista pozycji `items`, tekst ciągły `text`,
     samo polecenie `prompt`, wiersz sylab `syllables`.
   - Oznaczenia wyłącznie klasami z DATA-SCHEMA (`target`, `legato`, `uncertain`…); fragment
     nieczytelny oznacz `uncertain`, a nie domysłem.
   - `readQuality: "do_weryfikacji"`, dopóki treści nie porówna ze skanem druga osoba lub drugi
     odczyt.
3. **Próba.** `npm run import -- <plik.json> --dry-run` sprawdza plik razem z bazą i niczego
   nie zapisuje. Lista niezgodności wskazuje pole do poprawy.
4. **Import.** `npm run import -- <plik.json>` dopisuje ćwiczenia na końcu bazy i podaje nową rewizję.
5. **Weryfikacja.** W aplikacji porównaj podgląd ze skanem, popraw w edytorze, a po sprawdzeniu
   ustaw `readQuality` na `pewny`.
6. **Publikacja.** `npm run validate`, zatwierdzenie pliku bazy, publikacja katalogu `src/webapp/`.

Pliku bazy nie edytuje się ręcznie. Gdyby to było konieczne, `npm run validate` musi przejść
przed zatwierdzeniem, a `generated` trzeba podnieść samodzielnie.
