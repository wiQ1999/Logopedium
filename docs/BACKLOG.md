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

- [ ] **1 (R)** — parametry sesji w adresie jako zakodowany składnik
- [ ] **2 (N)** — ziarno sesji wracające do formularza parametrów
- [ ] **3 (N)** — jedna baza dla wszystkich trybów po edycji
- [ ] **4 (N)** — przenoszenie bloków i ćwiczeń na ekranie dotykowym
- [ ] **5 (N)** — koszt walidacji przy pisaniu w edytorze
- [ ] **6 (R)** — zapis bazy bez ręcznej podmiany pliku

---

## Szczegóły

### 1 (R) — parametry sesji w adresie jako zakodowany składnik

**Potrzeba.** Adres sesji niesie komplet jej ustawień i dzięki temu przeżywa przeładowanie
oraz daje się przekazać dalej. Przy domyślnych ustawieniach rozrasta się do około 1500 znaków —
takiego adresu nie da się objąć wzrokiem, a komunikatory i pola formularzy tną go w połowie.
Przekazana sesja otwiera się wtedy z innym zestawem albo nie otwiera się wcale.

**Oczekiwany efekt.**

- [ ] Adres sesji da się wysłać i otworzyć bez obcięcia.
- [ ] Otwarty adres odtwarza dokładnie ten zestaw ćwiczeń, który miał odtworzyć.
- [ ] Adres uszkodzony albo pochodzący ze starszej wersji nie blokuje aplikacji — sesja
      startuje z ustawieniami domyślnymi.

### 2 (N) — ziarno sesji wracające do formularza parametrów

**Błąd.** Po wylosowaniu nowego zestawu na dany dzień i powrocie do parametrów pole z ziarnem
losowania jest puste. Zatwierdzenie formularza uruchamia wtedy inny zestaw niż oglądany przed
chwilą, bez ostrzeżenia — zestaw, do którego ćwiczący chciał wrócić, przepada.

**Oczekiwany efekt.**

- [ ] Powrót do parametrów pokazuje ziarno używane w trwającej sesji.
- [ ] Zatwierdzenie niezmienionego formularza prowadzi do tego samego zestawu.
- [ ] Wyczyszczenie pola daje zestaw domyślny dla danego dnia — świadomie, nie przypadkiem.

### 3 (N) — jedna baza dla wszystkich trybów po edycji

**Błąd.** Po zapisaniu poprawek w edytorze przeglądanie bazy pokazuje treść po zmianie,
a sesja prowadzi dalej po treści sprzed zmiany. W jednej karcie żyją dwie wersje materiału
i nic nie mówi, która jest oglądana; poprawiony błąd w tekście potrafi wrócić w ćwiczeniu.

**Oczekiwany efekt.**

- [ ] Po zapisie wszystkie widoki pokazują tę samą wersję materiału.
- [ ] Widać, z której wersji bazy korzysta aplikacja.
- [ ] Usunięcie ćwiczenia w edycji nie psuje startu sesji ułożonej wcześniej.

### 4 (N) — przenoszenie bloków i ćwiczeń na ekranie dotykowym

**Błąd.** Na telefonie i tablecie nie da się zmienić kolejności bloków ani przenieść ćwiczenia
do innego bloku — uchwyt wiersza nie reaguje na dotyk. Sesję da się ułożyć wyłącznie myszą
lub klawiaturą, choć aplikacja ma być używana z dowolnego urządzenia.

**Oczekiwany efekt.**

- [ ] Dotykiem da się zmienić kolejność bloków i ćwiczeń oraz przenieść ćwiczenie między blokami.
- [ ] Przewijanie listy palcem nie uruchamia przenoszenia przez przypadek.
- [ ] Obsługa myszą i klawiaturą działa jak dotąd, z tymi samymi komunikatami dla czytnika ekranu.

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

- [ ] Poprawka naniesiona w edytorze trafia do opublikowanej bazy bez kopiowania plików.
- [ ] Widać, że opublikowana baza jest nowsza od poprzedniej.
- [ ] Baza niezgodna ze strukturą nie może zostać opublikowana.
- [ ] Wprowadzanie nowych zadań ze skanów ma opisaną, powtarzalną drogę.
