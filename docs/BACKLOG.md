# Lista zadań

Zadania przyjęte do wykonania: co jest nie tak albo czego brakuje i po czym poznać,
że rzecz jest skończona. Plik prowadzony na bieżąco — zamknięte zadania zostają odznaczonym
wierszem, ich opisy znikają.

## Prowadzenie listy

- **Nowe zadanie** — kolejny numer z symbolem rodzaju, `N` (naprawa) albo `R` (rozbudowa):
  wiersz na liście poniżej i sekcja w §Szczegóły — błąd albo potrzeba, oczekiwany efekt.
- **Język opisu** — od strony użytkownika i materiału, nie od strony kodu. Rozwiązania,
  warianty techniczne i ślady w plikach nie należą do tej listy; powstają przy realizacji
  i trafiają do DECISIONS.
- **Zamknięcie** — odznacz wiersz, dopisz datę, a sekcję opisową usuń. Lista pokazuje,
  co zrobiono; szczegóły dotyczą pracy przed sobą.
- **Numeracja** — jedna, ciągła, niezależna od rodzaju zadania; numer opisuje miejsce
  na liście, więc po przestawieniu wierszy przelicz go razem z nagłówkami w §Szczegóły.
- **Trwały ślad** — rozstrzygnięcia idą do DECISIONS, wymagania do APPLICATION
  i ARCHITECTURE. Ta lista nie jest archiwum.

---

## Zadania

Wzór: `- [ ] **7 (N)** — tytuł zadania`, po zamknięciu `- [x] **7 (N)** — tytuł zadania · 2026-09-22`.

- [x] **1 (R)** — parametry sesji w adresie jako zakodowany składnik · 2026-09-22
- [x] **2 (N)** — ziarno sesji wracające do formularza parametrów · 2026-09-22
- [x] **3 (N)** — jedna baza dla wszystkich trybów po edycji · 2026-09-28
- [x] **4 (N)** — przenoszenie bloków i ćwiczeń na ekranie dotykowym · 2026-09-22
- [x] **5 (N)** — koszt walidacji przy pisaniu w edytorze · 2026-09-28
- [x] **6 (R)** — zapis bazy bez ręcznej podmiany pliku · 2026-09-28
- [x] **7 (R)** — płynne przeciąganie bloków i ćwiczeń w parametrach sesji · 2026-09-28
- [x] **8 (R)** — podział kategorii przez wyciągnięcie ćwiczenia poza kategorię · 2026-09-28
- [ ] **9 (R)** — pasek formatowania wbudowany w pole treści edytora
- [ ] **10 (N)** — dodawanie kategorii, ćwiczeń, wariantów i pozycji w edytorze

---

## Szczegóły

### 9 (R) — pasek formatowania wbudowany w pole treści edytora

**Potrzeba.** Oznaczenia treści (głoska docelowa, legato, zapis fonetyczny, miejsce wdechu…)
wybiera się z jednego wspólnego paska nad wszystkimi polami. Przyciski noszą same nazwy,
więc przed użyciem trzeba pamiętać, jak dane oznaczenie wygląda w materiale, a pasek jest
oddalony od poprawianego fragmentu. Pole ze zwykłym tekstem wygląda tak samo jak pole z treścią
formatowaną.

**Oczekiwany efekt.**

- Każde pole z treścią formatowaną ma własny pasek, wbudowany w ramkę pola jak w edytorze
  tekstu (Word, edytory HTML); pasek dotyczy tego pola, w którym trwa edycja.
- Przycisk pokazuje wygląd oznaczenia — próbkę tekstu w stylu, jaki nada zaznaczeniu
  (np. pogrubiona głoska, podkreślone legato) — a nazwa pozostaje w podpowiedzi i dla czytnika
  ekranu. Stan przycisku pokazuje, czy zaznaczenie ma już dane oznaczenie.
- Pasek i edycja w ramce dotyczą wyłącznie pól, które w pliku bazy przechowują treść HTML
  (DATA-SCHEMA: nagłówek, materiał wprowadzający, polecenia, sylaby, tekst, pozycje). Pola
  proste — tytuł, nazwa wariantu, jakość odczytu, wybory z listy — pozostają zwykłymi polami
  bez formatowania.
- Oznaczenia i dozwolone znaczniki pozostają te same co w DATA-SCHEMA; zapisana treść nie
  zawiera niczego spoza tej listy.
- Pasek działa myszą, dotykiem i klawiaturą, na telefonie mieści się w szerokości pola.

**Przed realizacją.** Przegląd bibliotek dostarczających pole edycji z wbudowanym paskiem,
które pozwalają zdefiniować własne oznaczenia zamiast standardowych stylów i dają się dołączyć
bez procesu budowania (ARCHITECTURE). Gdy żadna nie spełnia tych warunków, pole z paskiem
powstaje jako własny komponent interfejsu. Wynik przeglądu i wybór trafiają do DECISIONS.

**Do rozstrzygnięcia.** Przykłady wzorcowe (`examples`) schemat opisuje jako zwykły tekst,
a wszystkie obecne przykłady zawierają znaczniki — przy realizacji ustalić, czy to pole
z treścią HTML.

### 10 (N) — dodawanie kategorii, ćwiczeń, wariantów i pozycji w edytorze

**Błąd.** Edytor poprawia tylko to, co już jest w bazie. Brakuje przycisków dodania nowej
kategorii, nowego ćwiczenia, kolejnego wariantu w ćwiczeniu i kolejnej pozycji w wariancie.
Każdy nowy element trzeba dziś wprowadzać plikiem importu, nawet pojedynczą pozycję
dopisaną do istniejącego ćwiczenia.

**Oczekiwany efekt.**

- W przeglądaniu bazy da się dodać kategorię (nazwa) i ćwiczenie w wybranej kategorii;
  nowe ćwiczenie otwiera się w edytorze z jednym pustym wariantem.
- W edycji ćwiczenia da się dodać wariant, a w wariancie typu „Pozycje” — pozycję,
  na końcu listy.
- Nowy element dostaje identyfikator zgodny z konwencją z CONTENT, unikalny w całej bazie
  i niezmienny po zapisie.
- Nowe elementy przechodzą to samo sprawdzenie co poprawki: pusty lub niekompletny element
  jest wskazany przed zapisem, a baza niezgodna z DATA-SCHEMA nie zostaje zapisana.
- Do zapisu element istnieje tylko w edytorze — „Odrzuć zmiany” usuwa go bez śladu.
- Przyciski dodawania są dostępne wyłącznie tam, gdzie działa zapis do pliku (APPLICATION §7.1).
