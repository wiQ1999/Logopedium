# Dziennik decyzji

Chronologiczny zapis rozstrzygnięć. Wymagania opisują APPLICATION i ARCHITECTURE — tutaj
trafia tylko decyzja i jej uzasadnienie.

---

## 2026-09-21 — edycja bazy w podglądzie

Podgląd ćwiczenia dostaje tryb edycji ćwiczenia lub wariantu. Wymagania: APPLICATION §7;
ARCHITECTURE §2, §8–§10; DATA-SCHEMA „Znaczniki w treści HTML”.

- **Edycja działa na kopii bazy w pamięci, a zapis eksportuje cały `database.json`.** Statyczny
  hosting nie pozwala nadpisać wdrożonego pliku bez backendu; eksport zachowuje dotychczasową
  architekturę i daje artefakt gotowy do ponownej publikacji.
- **Pasek formatowania operuje na znaczeniu, nie na wyglądzie.** Przyciski nakładają istniejące
  klasy semantyczne na zaznaczony tekst, więc autor nie musi pisać HTML ani znać stylów CSS.
- **Podgląd aktualizuje się przy każdej zmianie i używa renderera karty ćwiczenia.** Autor widzi
  wynik przed zapisem, bez utrzymywania drugiej interpretacji znaczników.
- **Dowolny HTML pozostaje niedostępny.** Dozwolona lista tagów i klas oraz walidacja całej bazy
  przed eksportem ograniczają błędy struktury i wstrzyknięcie kodu.

Uściślenie implementacyjne (2026-09-22): eksport aktualizuje `generated` jako rewizję treści
uwzględnianą w ziarnie; `schemaVersion` nadal opisuje wyłącznie kształt struktury.

---

## 2026-09-15 — bloki zamiast kategorii w parametrach

Wiersz parametrów przestaje być kategorią, a staje się blokiem: kategorią z wybranym podzbiorem
jej ćwiczeń i własnym kompletem ustawień. Wymagania: APPLICATION §3.1–§3.5, §3.8, §4, §5.2;
ARCHITECTURE §5, §6, §10.

- **Ćwiczenia przełączane pojedynczo, w rozwiniętym bloku.** Liczba ćwiczeń mówi, ile ich wejdzie
  do sesji, ale nie które — w kategorii liczącej 23 teksty to za mało, żeby pokierować ćwiczeniem.
- **Wyciągnięcie ćwiczenia poza blok tworzy nowy blok tej samej kategorii.** Różne części jednej
  kategorii dostają wtedy różne ustawienia i różne miejsca w sesji, bez rozbijania kategorii
  w bazie — podział jest sprawą sesji, nie danych. Dotyczy 8 kategorii z 30; reszta ma po jednym
  ćwiczeniu.
- **Tryb doboru schodzi z sesji do bloku.** Odwrócenie decyzji z 2026-09-13: rozmiar podzbioru
  istotnie nie zależy od trybu, ale sposób brania już tak, a tekst czytany po kolei i wyrazy
  do przetasowania trafiają do jednej sesji.
- **Przeciąganie zastępuje przyciski „góra” i „dół”.** Dwa poziomy listy i przenoszenie ćwiczeń
  między blokami wymagają wskazania celu, czego para przycisków nie wyraża. Uchwyt musi działać
  także z klawiatury, bo przyciski były dotąd jedyną dostępną drogą porządkowania (ARCHITECTURE §10).
- **Blok w adresie to `id:ćwiczenia:W:P:tryb`, a lista ćwiczeń jest szóstym składnikiem.**
  Dopisuje ją tylko blok węższy od swojej kategorii — inaczej adres domyślnej sesji urósłby
  o komplet 70 identyfikatorów zamiast zatrzymać się na ~1,5 kB. Identyfikatory, nie indeksy,
  zgodnie z regułą z 2026-09-13.
- **Aktywne ćwiczenia bloku wchodzą do ziarna, jego kolejność i tryb nie.** Wyłączenie ćwiczenia
  zmienia pulę, więc musi przetasować losowanie; przestawienie wiersza zmienia tylko układ kroków.
- **Wersja zapisu ustawień podniesiona do 3.** Wpisy kategorii ustąpiły blokom, więc stare zapisy
  są odrzucane w całości, zgodnie z ARCHITECTURE §5.

---

## 2026-09-13 — limity `W` i `P` per kategoria

Korekta decyzji z tego samego dnia: limity przestają być wspólne dla sesji i stają się polami
wiersza kategorii. Wymagania: APPLICATION §3.1–§3.3, §3.5; ARCHITECTURE §6.

- **`W` i `P` ustawiane osobno w każdej kategorii.** Jedna para liczb dla całej sesji zrównywała
  materiał nieporównywalny: 23 jednowariantowe teksty do czytania z trzywariantowymi opozycjami
  fonologicznymi.
- **Krańce liczone z zawartości samej kategorii**, nie z całej bazy. Argument za niezależnością
  od aktywnych kategorii odpada — kraniec należy teraz do kategorii, więc zmienia go wyłącznie poziom.
- **Pole `W` albo `P` znika z wiersza, gdy nie ma czego ograniczać**, zamiast być nieaktywne:
  licznik o jednej możliwej wartości niczym nie steruje, a zajmuje miejsce i sugeruje wybór.
  W obecnej bazie 7 kategorii traci `W`, a 2 tracą `P`.
- **`Dobór` zostaje jeden na sesję** — rozstrzyga sposób brania podzbioru, nie jego rozmiar,
  więc nie ma czego różnicować między kategoriami.
- **Limity wędrują do parametru `c` jako `id:ćwiczenia:W:P`** zamiast osobnych `w` i `p`.
  Trzymane przy identyfikatorze kategorii nie rozjadą się z listą po zmianie bazy. Adres zawsze
  niesie obie liczby, także ukryte: skracanie wpisu wymagałoby rozstrzygania, którego pola
  zabrakło, bo `W` i `P` znikają niezależnie od siebie.
- **Formularz rośnie do trzech pól w wierszu**, mniej tam, gdzie nie ma czego ograniczać.
  Przyjęte świadomie: wartości domyślne wypełniają je same, a zmienia się tylko te kategorie,
  które tego wymagają. Adres domyślnej sesji ma przy tym ~1,2 kB.
- **Wersja zapisu ustawień podniesiona do 2.** Limity zeszły z korzenia zapisu do wpisów
  kategorii, więc stare zapisy są odrzucane w całości, zgodnie z ARCHITECTURE §5.

---

## 2026-09-13 — wdrożenie zmian założeń

Kod dogoniony do APPLICATION §3 i §5 oraz ARCHITECTURE §5. Walidator i sortowanie w `data.js`
nie wymagają już pola `order`, więc baza 1.1 się wczytuje.

- **Ziarno pochodne to `<ziarno sesji>|<id ćwiczenia>`.** Każdy krok dostaje własny generator,
  więc zmiana `W`, `P` albo trybu doboru nie przesuwa sekwencji w pozostałych krokach.
- **Reszta budżetu rozdawana losowymi porcjami**, nie po jednej pozycji: przydzielanie
  pojedynczo zbiegałoby do równych porcji, czyli do rozkładu, który został odrzucony.
- **Włączenie kategorii przełącznikiem ustawia wszystkie dostępne ćwiczenia**, tak samo jak
  wartości początkowe — przełącznik przywraca stan domyślny kategorii, nie wymyśla własnego.
- **Brak limitu albo trybu doboru w adresie oznacza kraniec, nie zapis z przeglądarki.** Adres
  pozostaje jedynym nośnikiem stanu konkretnej sesji. *(Parametry `w` i `p` zastąpione tego
  samego dnia przez składniki wpisu `c`.)*
- **Kategoria w adresie bez dwukropka i liczby oznacza wszystkie dostępne ćwiczenia.**
- **Adres domyślnej sesji wymienia wszystkie 30 aktywnych kategorii.** Skracanie go odrzucone:
  indeksy zamiast identyfikatorów rozjechałyby się po zmianie bazy.
- **Przycisk „Przywróć domyślne” czyści zapis i formularz naraz** — jedno działanie, zgodnie
  z APPLICATION §3.7.

---

## 2026-09-13 — baza `schemaVersion` 1.1

Wgrana nowa zawartość `database.json`: 30 kategorii i 70 ćwiczeń wobec 25 i 54, nic nie usunięto.
Nowe kategorie to `rozgrzewka`, `terapia-miofunkcjonalna-polykanie`,
`technika-legato-cwiczenia-bazowe`, `sygmatyzm-miedzyzebowy-cwiczenia-ze-szpatulka`
i `gloski-dziaslowe-wywolanie-i-roznicowanie`.

- **Pole `order` usunięte z `categories[]` i z `variants[]`; kolejność niesie tablica.** Pozycja
  zapisana obok kolejności w tablicy mogła się z nią rozjechać przy ręcznej edycji.
- **`schemaVersion` podniesiona do 1.1** — to zmiana kształtu struktury, a wersja wchodzi
  do ziarna losowania, więc sesje sprzed aktualizacji nie odtworzą się z tym samym zestawem.
- **Walidator i sortowanie w `data.js` wymagają zmiany**, zanim baza się wczyta: dziś twardo
  wymagają `order` i zgłaszają 162 niezgodności (30 kategorii + 132 warianty).
- **Krańce `W` i `P` bez zmian** (6 i 58) — nowe ćwiczenia są krótsze od dotychczasowego
  rekordzisty, więc parametry sesji nie wymagają korekty.

---

## 2026-09-13 — zmiana założeń

Wymagania: APPLICATION §3.2–§3.5, §3.7, §5.2, §6.2; ARCHITECTURE §5. Zmiany nie są jeszcze
wdrożone w kodzie.

- **Liczba wariantów staje się parametrem sesji.** Krok pokazywał wszystkie warianty ćwiczenia,
  a te w bazie noszą etykiety „Zadanie 1…4” — przy jednym wybranym ćwiczeniu na stronie
  wychodziły cztery zadania.
- **Limit wariantów obejmuje każde ćwiczenie z wariantami, bez wyjątków dla typów.** Reguła
  bez wyjątków jest sprawdzalna wzrokiem w parametrach.
- **Limit pozycji to budżet na całe ćwiczenie, nie na wariant.** Limit per wariant przy czterech
  wariantach dawał do 32 pozycji na stronie; zastępuje dotychczasową stałą
  `MAX_ITEMS_PER_VARIANT = 8`.
- **Zakres limitu pozycji zależy od limitu wariantów:** minimum `W`, maksimum równe
  najbogatszemu ćwiczeniu przy tylu wariantach. Minimum `2 × W` odrzucone — baza zawiera
  warianty z jedną pozycją, więc taki kraniec obiecywałby materiał, którego nie ma.
- **Maksimum liczone po filtrze poziomu, ale niezależnie od aktywnych kategorii**, żeby kraniec
  pola nie skakał przy każdym przełączeniu kategorii. *(Zastąpione tego samego dnia przez krańce
  liczone z zawartości pojedynczej kategorii.)*
- **Warianty bez pozycji pomijane przy liczeniu zakresu `P`**, zamiast liczone jako jedna pozycja.
  Obie reguły dają w obecnej bazie te same krańce, ale pominięcie nie wprowadza pozycji, która
  nigdy się nie wyświetli; do `W` warianty te liczą się normalnie.
- **Dwie pozycje na wariant to preferencja algorytmu podziału, nie kraniec parametru.** Reguła
  obowiązuje tam, gdzie wariant ma czym ją pokryć, a zaoszczędzone pozycje zasilają pozostałe warianty.
- **Reszta budżetu dzielona losowo, nie proporcjonalnie** — równe porcje spłaszczałyby różnice
  między krótkim a długim wariantem.
- **Jeden przełącznik `kolejność / losowo` dla wariantów i pozycji.** Tryb `kolejność` bierze
  N kolejnych elementów od losowego punktu startowego, więc zachowuje progresje z oryginału,
  nie zawężając materiału do początku zbioru.
- **Limity i tryb doboru nie wchodzą do ziarna, tylko do fazy na ziarnie pochodnym.** Inaczej
  zmiana limitu przelosowałaby również to, które ćwiczenia trafiają do sesji.
- **Parametry zapamiętywane w `localStorage`.** Jedyny mechanizm bez backendu, który jest
  trwały między dniami i mieści listę kategorii (ciasteczka nie mieszczą).
- **Wartości domyślne to sesja nieograniczona.** Brak predefiniowanego zestawu startowego —
  domyślne wynikają z zawartości bazy, co upraszcza logikę i nie faworyzuje żadnej kategorii.
- **Data nie jest zapamiętywana ani formatowana własnym zapisem.** Data z poprzedniej wizyty
  wskazywałaby przeszłość, a format wyświetlania zostaje po stronie ustawień przeglądarki.
- **Tryb oznaczeń nie jest zapamiętywany trwale.**
- **Tryb przeglądania bez zmian** — pokazuje całą zawartość bazy, bez limitów sesyjnych.

Odrzucone: zmiana opisu architektury na wielostronicową — wiele stanów pod własnymi adresami
w jednym dokumencie HTML to definicja SPA, nie odstępstwo od niej.

---

## 2026-09-10 — wersja 1.0

Pierwsza działająca aplikacja. Baza `schemaVersion 1.0`, wygenerowana 2026-09-08.

**Interpretacje wymagań**

- **`level: null` przechodzi filtr poziomu zawsze** (wtedy 38 z 54 ćwiczeń). Poziom jest górnym
  limitem, więc brak zadeklarowanego poziomu nie może go przekroczyć.
- **Polecenie identyczne we wszystkich wariantach wyświetlane raz.** Baza duplikuje je
  w każdym wariancie — bez tej reguły jedno ćwiczenie powtarzało polecenie sześć razy.
- **Wylosowane pozycje wyświetlane w kolejności z bazy**, nie w kolejności losowania —
  zachowuje progresje samogłoskowe i układ oryginału. *(Zastąpione 2026-09-13 przez
  parametr `Dobór`.)*
- **`randomizable: false` oraz typy `text`, `syllables`, `prompt` podawane w całości.**
- **Uwagi redakcyjne ukryte w sesji, widoczne w przeglądaniu** — schemat opisuje je jako
  nieprzeznaczone dla ćwiczącego, a przeglądanie służy pracy z bazą.
- **Filtr poziomu w przeglądaniu jest dokładny, nie górny** — pozwala dotrzeć do materiału,
  którego limit górny nie wyodrębnia.

**Rozstrzygnięcia techniczne**

- **Komplet parametrów w adresie**, bo tylko adres przeżywa przeładowanie i daje się przekazać.
- **Ziarno `logopedium|v=…|d=…|l=…|c=…`** z kategoriami posortowanymi po `id`, żeby
  przestawienie listy nie zmieniało doboru materiału.
- **mulberry32 z ziarnem FNV-1a, losowanie częściowym tasowaniem Fishera–Yatesa**; sortowanie
  porównaniem kodowym, nie `localeCompare`, bo kolejność zależna od lokalizacji łamie powtarzalność.
- **Nowe ziarno z `crypto.getRandomValues`** — nie jest elementem budowy planu, więc nie narusza
  zakazu użycia wbudowanego generatora losowego.
- **Walidacja zbiera wszystkie niezgodności naraz** i pokazuje je zamiast pustego interfejsu.
- **Znaczniki inline usuwane bez wstawiania spacji** przy wydobywaniu tekstu do wyszukiwania —
  baza wstawia `<span>` wewnątrz wyrazów, więc spacja rozbijała „aptekarzem” na sylaby.
- **Przełączanie warstw oznaczeń w CSS**, atrybutem na karcie, bez ponownego renderowania.
- **Motyw jasny i ciemny wg `prefers-color-scheme`** — materiał czyta się długo, a oba warianty
  wynikają z tego samego zestawu zmiennych CSS.

**Elementy spoza dokumentacji**

- **Plik bazy nazywa się `database.json`**, wbrew nazwie `cwiczenia-logopedyczne.json`
  z DATA-SCHEMA; wersja zminifikowana nie powstaje, bo nie ma kroku budowania.
- **Narzędzia deweloperskie poza katalogiem aplikacji** (`package.json`, `tools/serve.js`,
  `tests/`, `jsdom`), żeby katalog publikowany pozostał bez zależności.
- **`assets/img/` pusty** — baza nie odwołuje się do grafiki.

**Świadome ograniczenia**

- Dominująca kategoria „tekst do czytania terapeutycznego” (23 ćwiczenia) nie została
  rozbita w danych — ten sam cel realizuje liczba ćwiczeń w kategorii, bez ingerencji w bazę.
- `phonemes` i `positions` są widoczne w metryce ćwiczenia, ale nie służą jako filtry.
- Miejsca na odpowiedź renderowane jako linia, bez mechaniki odsłaniania.
