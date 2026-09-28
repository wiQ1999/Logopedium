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
- [ ] **3 (N)** — jedna baza dla wszystkich trybów po edycji
- [x] **4 (N)** — przenoszenie bloków i ćwiczeń na ekranie dotykowym · 2026-09-22
- [ ] **5 (N)** — koszt walidacji przy pisaniu w edytorze
- [ ] **6 (R)** — zapis bazy bez ręcznej podmiany pliku
- [ ] **7 (R)** — płynne przeciąganie bloków i ćwiczeń w parametrach sesji
- [ ] **8 (R)** — podział kategorii przez wyciągnięcie ćwiczenia poza kategorię

---

## Szczegóły

### 3 (N) — jedna baza dla wszystkich trybów po edycji

**Błąd.** Po zapisaniu poprawek w edytorze przeglądanie bazy pokazuje treść po zmianie,
a sesja prowadzi dalej po treści sprzed zmiany. W jednej karcie żyją dwie wersje materiału
i nic nie mówi, która jest oglądana; poprawiony błąd w tekście potrafi wrócić w ćwiczeniu.

**Oczekiwany efekt.**

- [ ] Po zapisie wszystkie widoki pokazują tę samą wersję materiału.
- [ ] Widać, z której wersji bazy korzysta aplikacja.
- [ ] Usunięcie ćwiczenia w edycji nie psuje startu sesji ułożonej wcześniej.

### 5 (N) — koszt walidacji przy pisaniu w edytorze

**Błąd.** Pisanie w polach treści edytora zacina się — tym mocniej, im dłuższe ćwiczenie
i im słabszy sprzęt. Poprawianie odczytów ze skanów, czynność z natury drobna i częsta,
staje się męczące i zniechęca do nanoszenia poprawek.

**Oczekiwany efekt.**

- [ ] Pisanie w najdłuższym ćwiczeniu bazy jest płynne, także na telefonie.
- [ ] Błąd we wprowadzanej treści nadal jest sygnalizowany i wstrzymuje zapis.
- [ ] Zapisywana baza jest sprawdzana w całości, tak jak dotąd.

### 6 (R) — zapis bazy bez ręcznej podmiany pliku

**Potrzeba.** Zapis poprawki z edytora kończy się pobraniem pliku bazy, ręcznym zastąpieniem
nim pliku aplikacji i ponowną publikacją. Koszt naniesienia literówki jest nieproporcjonalny
do jej wagi, więc poprawki się odkładają, a baza rozjeżdża się z materiałem źródłowym.
Osobno brakuje drogi wejścia: zadania ze skanów trafiają do bazy ręcznie, bez powtarzalnego
przebiegu, choć odczyt ze skanów jest jednym z filarów projektu.

**Oczekiwany efekt.**

- [ ] Poprawka naniesiona w edytorze trafia od razu do pliku bazy, bez pobierania i kopiowania plików.
- [ ] Nie powstaje pośrednia kopia bazy do ręcznej podmiany.
- [ ] Widać, że zapisana baza jest nowsza od poprzedniej.
- [ ] Baza niezgodna ze strukturą nie może zostać zapisana, a plik zostaje bez zmian.
- [ ] Wprowadzanie nowych zadań ze skanów ma opisaną, powtarzalną drogę.

### 7 (R) — płynne przeciąganie bloków i ćwiczeń w parametrach sesji

**Potrzeba.** Przenoszenie wiersza wskazuje cel dopiero w chwili upuszczenia, więc trudno
przewidzieć, gdzie wiersz stanie — szczególnie przy długiej liście rozwiniętych bloków.
Układ sesji poprawia się więc metodą prób i cofania.

**Oczekiwany efekt.**

- [ ] W trakcie przeciągania widać miejsce, w którym wiersz wyląduje, i przesuwa się ono
  razem z wierszem.
- [ ] Sąsiednie wiersze rozsuwają się płynnie, także na telefonie.
- [ ] Lista przewija się sama, gdy wiersz zbliża się do krawędzi ekranu.
- [ ] Przerwanie przeciągania przywraca poprzedni układ.
- [ ] Przeciąganie klawiaturą działa jak dotąd.

### 8 (R) — podział kategorii przez wyciągnięcie ćwiczenia poza kategorię

**Potrzeba.** Kategorię dzieli się na części o różnych ustawieniach, ale nie widać, że
służy do tego wyciągnięcie ćwiczenia z bloku, ani gdzie nowa część stanie.

**Oczekiwany efekt.**

- [ ] Ćwiczenie wyciągnięte z bloku na poziom bloków tworzy kopię jego kategorii z osobną
  pulą ćwiczeń.
- [ ] Nowy blok staje w miejscu upuszczenia, a przed upuszczeniem widać go jako przerwę.
- [ ] Blok innej kategorii nie przyjmuje ćwiczenia.
