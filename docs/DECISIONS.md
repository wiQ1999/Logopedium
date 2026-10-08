# Dziennik decyzji

Chronologiczny zapis rozstrzygnięć. Wymagania opisują APPLICATION i ARCHITECTURE — tutaj
trafia tylko decyzja i jej uzasadnienie.

---

## 2026-10-08 — porządki w treści bazy

Przegląd ćwiczeń ze skanów: niekompletne fragmenty usunięte lub uzupełnione, duplikaty scalone.

- **Ćwiczenia z głoską m scalone w „Rezonatory — głoska m”** (kategoria: oddech, fonacja
  i rezonans). Rezonatory miały polecenie czytania sekwencji wyrazów bez wyrazów; „mamrotliwa
  marmolada” to ta sekwencja, a nagłos nosowy to dalsze zadania. Krańce kategorii rosną
  do `W` = 7 i `P` = 67.
- **Duplikaty „Ewentualnie ezoteryczne ewolucje” i „Arogancki aligator ambitnie adoruje”
  usunięte** — te same zdania są zadaniem 1 ćwiczeń „Samogłoska „e”” i „Samogłoska „a””.
- **Urwany tekst kończy się „[…]”** zamiast opisu braku strony — czytający widzi przerwę,
  a nie uwagę redakcyjną.
- **„Mowa legato” rozdzielona na dwa ćwiczenia** (sylaby; dni tygodnia i miesiące), oba z zasadami
  techniki we wstępie — dopiero osobne ćwiczenia da się osobno włączyć w parametrach sesji.
- **Polecenia ucięte na skanie odtworzone tylko z czytelnej części** (np. „…warcie” → „Zwarcie”);
  polecenie bez czytelnej treści usunięte albo zastąpione opisem tego, co widać w ćwiczeniu.
- **Polskie cudzysłowy „…” w całej treści**, także w nazwach zadań — wcześniej mieszane z prostymi.
- **Głoska docelowa oznaczana tylko na swojej literze** — pogrubione pierwsze litery zdań w tekstach
  na inną głoskę były błędem przeniesienia ze skanu.
- **Identyfikatory wariantów scalonego ćwiczenia przenumerowane** według konwencji z CONTENT;
  usunięte ćwiczenia znikają z zapisanych parametrów sesji przy najbliższym wczytaniu.

---

## 2026-10-06 — układ na pełne okno

Realizacja zadania BACKLOG 12. Wymagania: APPLICATION §2 „Szerokość ekranu”.

- **Zmienna `--gutter` zamiast stałej szerokości 62rem.** Margines rośnie z oknem od 16 do 48 px,
  a do ok. 800 px zostaje 16 px, więc telefon i tablet wyglądają co do piksela tak samo jak przedtem
  (porównanie pozycji wszystkich elementów 6 widoków przy 375 i 768 px).
- **Próg desktopu 1200 px.** Poniżej lista bloków obok kolumny ustawień zostałaby węższa niż
  wiersz bloku z trzema polami liczbowymi i doborem.
- **Kolumna parametrów to dwa obszary w kolejności dokumentu.** Ustawienia stoją przed blokami,
  a ziarno, legenda i start po nich, więc na telefonie kolejność się nie zmienia. Przyklejony jest
  tylko obszar ze startem (na desktopie podsumowanie idzie w nim na górę) — przyklejenie obu
  wymagałoby znajomości wysokości pierwszego.
- **Listy w siatce, tekst ciągły ograniczony do 75ch.** Lista bazy i podsumowanie to niezależne
  kafle, więc kolumny skracają przewijanie; akapit na 1800 px byłby nieczytelny przy głośnym czytaniu.
- **Pozycje ćwiczenia bez kolumn.** Czyta się je kolejno, z góry na dół — kolumny łamałyby ten porządek.

---

## 2026-09-28 — podgląd ćwiczenia w parametrach sesji

Realizacja zadania BACKLOG 11. Wymagania: APPLICATION §3.2 „Podgląd ćwiczenia”.

- **Próbka o stałych limitach, nie cały materiał.** 2 warianty × 3 pozycje, tekst ok. 220 znaków
  i 3 wierszy, pozycja ok. 90 znaków i 2 wierszy. Na bazie z repozytorium najwyższy podgląd
  ma ok. 560 px przy 1280 px szerokości (mediana ok. 250 px), więc mieści się na jednym ekranie.
- **Skracanie na HTML po sanitacji, z liczeniem wierszy.** Wiele tekstów w bazie to wiersze
  łamane `<br>` — sam limit znaków zostawiłby kilkanaście krótkich linii. Cięcie na granicy
  słowa z zamknięciem otwartych znaczników zachowuje oznaczenia, a wynik nadal przechodzi
  sanitację.
- **Tytuł ćwiczenia stał się przyciskiem podglądu, a pole wyboru dostało własną nazwę.**
  Wcześniej cały tytuł był etykietą pola wyboru, więc kliknięcie tytułu wyłączało ćwiczenie.
- **Podgląd rysowany tylko dla otwartego ćwiczenia** i nie zapamiętywany — jest pomocą przy
  doborze, nie częścią parametrów.

---

## 2026-09-28 — pasek oznaczeń w polu i dodawanie materiału w edytorze

Realizacja zadań BACKLOG 9 i 10. Wymagania: APPLICATION §7.1, §7.2; ARCHITECTURE §10;
DATA-SCHEMA; CONTENT.

- **Własny komponent zamiast biblioteki edytora.** Przegląd: Quill 2 i Squire dają własne
  formaty z klasą, ale przepisują treść na model „każdy wiersz w akapicie” — zmieniłyby `<br>`
  w tekstach i pozycje bez akapitu w całej bazie. Tiptap/ProseMirror wymaga bundlera (łamie
  „bez budowania”), Trix nie nadaje klas, Jodit i Pell stoją na `execCommand` i stylach
  wbudowanych, Wysi nie ma własnych klas. Kod nakładania oznaczeń już istniał; pasek w polu,
  zdejmowanie i stan przycisków to ok. 140 wierszy bez nowej zależności.
- **Przycisk jest przełącznikiem.** Na zaznaczeniu w całości oznaczonym zdejmuje oznaczenie,
  inaczej je nakłada — jak pogrubienie w edytorze tekstu; bez tego nie było jak cofnąć
  oznaczenia inaczej niż przepisując tekst.
- **Krótsze próbki na przyciskach niż w legendzie** („ţs”, „[uc]”), żeby pasek zmieścił się
  w jednym wierszu na telefonie (375 px).
- **`examples` to pole HTML.** Walidacja i sanitacja już tak je traktowały, a wszystkie trzy
  przykłady w bazie mają znaczniki; DATA-SCHEMA opisywała je jako zwykły tekst.
- **Jakość odczytu jako lista wyboru.** Schemat zna dwie wartości; nieznana wartość z pliku
  pojawia się jako dodatkowa opcja, więc edycja jej nie gubi.
- **Nowa kategoria powstaje razem z pierwszym ćwiczeniem.** Kategoria bez ćwiczeń nie pojawia
  się w liście, parametrach ani sesji, a przez zapis bez treści powstawałby „martwy” wpis.
- **Nazwy kategorii muszą być unikalne** (bez względu na wielkość liter i odstępy). Kategorię
  nazywa teraz użytkownik, a dwie o tej samej nazwie byłyby nie do odróżnienia.
- **Identyfikator nowego elementu ustalany przy dodaniu, nie przy zapisie.** Zmiana tytułu przed
  zapisem go nie zmienia — ten sam identyfikator widać w edytorze od początku.
- **Usunąć można tylko elementy dodane w bieżącej edycji.** Usuwanie zapisanego materiału nie było
  częścią zadania, a zmienia rozkład losowania i stany sesji zapisane w adresach.
- **Dodanie lub usunięcie przebudowuje formularz z bufora.** Wiązania pól są indeksami; odtworzenie
  całości jest prostsze i pewniejsze niż wstawianie fragmentów, a przewinięcie jest zachowane.

---

## 2026-09-28 — wdrożenie zapisu do pliku i płynnego przeciągania

Realizacja zadań BACKLOG 3, 5, 6, 7 i 8. Wymagania: APPLICATION §3.2, §7.1; ARCHITECTURE §4, §10;
CONTENT.

- **Rewizję `generated` nadaje serwer, nie przeglądarka.** Zegar klienta bywa cofnięty, a rewizja
  musi rosnąć, bo wchodzi do ziarna i do stanu sesji w adresie.
- **Zapis niesie rewizję, na której go oparto; niezgodna daje 409.** Dwie karty z edytorem nie
  nadpiszą sobie zmian po cichu — blokada optymistyczna wystarcza przy jednym autorze.
- **Obsługę zapisu ogłasza nagłówek odpowiedzi z bazą**, a nie osobne zapytanie. Hosting
  statyczny nie wyśle nagłówka, nawet jeśli na nieznane adresy odpowiada stroną aplikacji.
- **Zapis wymaga pętli zwrotnej, lokalnego `Host` i zgodnego `Origin`.** Serwer słucha na wszystkich
  interfejsach, a obca strona w przeglądarce autora albo DNS rebinding nie może zmienić bazy.
- **Bufor edytora to jedno ćwiczenie.** Kopia całej bazy była drugą wersją materiału (BACKLOG 3),
  a jej serializacja przy każdym znaku — częścią kosztu pisania (BACKLOG 5).
- **Sprawdzanie przy pisaniu obejmuje tylko edytowane ćwiczenie i czeka 150 ms bez zmian.**
  Sama walidacja całej bazy przy każdym znaku kosztowała ok. 31 ms na komputerze; obsługa znaku
  w najdłuższym ćwiczeniu kosztuje teraz ok. 2,6 ms. Pełna walidacja przy zapisie zachowuje
  dotychczasową gwarancję.
- **Po zapisie baza jest wczytywana z pliku, a parametry dopasowywane do niej.** Formularz pokazuje
  treść po normalizacji serwera, a ćwiczenie przeniesione do innej kategorii nie znika z sesji.
- **Import ze skanów tylko dopisuje.** Istniejący identyfikator przerywa import — poprawki należą
  do edytora, gdzie widać podgląd przed zapisem.
- **Mysz też przeciąga w trybie `forceFallback`.** Natywne przeciąganie HTML samo obsługuje Esc,
  ale nie pozwala odróżnić przerwania od upuszczenia i inaczej rysuje przenoszony wiersz.
- **„Poza listą” liczone geometrycznie, nie przez trafienie w element.** Przy autoprzewijaniu palec
  spoczywa na przyklejonym nagłówku, a upuszczenie tam musiało trafiać w widoczną przerwę.
- **Zwinięty blok nie przyjmuje ćwiczenia wskaźnikiem.** Jego lista jest ukryta, więc przerwa
  nie ma gdzie się otworzyć; rozwinięcie wymuszone w trakcie ruchu przesuwałoby wiersze pod palcem.
  Klawiatura (strzałka w prawo) nadal przenosi ćwiczenie do następnego bloku kategorii.
- **Blok zwija się już przy przejęciu, nie przy starcie ruchu.** Pływająca kopia wiersza powstaje
  przed zdarzeniem startu i miałaby wysokość rozwiniętego bloku.

---

## 2026-09-28 — zapis bezpośrednio do pliku, płynne przeciąganie, podział kategorii

Zmiana założeń, wdrożona tego samego dnia (wpis wyżej). Wymagania: APPLICATION §3.2, §7.1;
ARCHITECTURE §2, §4, §10. Zadania BACKLOG 3 i 6 domykają część zapisu, 7 i 8 — przeciąganie.

- **Edytor zapisuje bazę bezpośrednio do `database.json` przez lokalny serwer.** Eksport pliku
  i ręczna podmiana były kosztem nieproporcjonalnym do literówki. Statyczny hosting zapisu nie
  przyjmie, więc edycja jest pracą lokalną, a publikacja nadal kopiuje katalog. Odrzucone:
  File System Access API — tylko Chromium i wskazywanie pliku przy każdej sesji.
- **Bez kopii pośredniej; po zapisie widoki wczytują bazę z pliku.** Dwie wersje materiału
  w jednej karcie (BACKLOG 3) znikają, bo źródłem prawdy jest plik.
- **Walidacja zarówno w edytorze, jak i na serwerze tym samym modułem.** Zapisu nie da się
  obejść ani pomylić z drugą implementacją reguł.
- **Zapis unieważnia plan trwającej sesji.** Podniesiona rewizja `generated` i tak odrzuciłaby
  adres sesji; jawne unieważnienie usuwa pokazywanie starej treści.
- **Przeciąganie wykonuje biblioteka SortableJS, dołączona do repozytorium.** Płynna przerwa,
  animacja sąsiadów, autoprzewijanie i przytrzymanie na dotyku to gotowe rozwiązanie
  zagnieżdżonych, połączonych list — własny kod (obecny) tego nie daje bez odtwarzania biblioteki.
  Frameworku interfejsu nie dodajemy: brakuje silnika przeciągania, nie zarządzania widokami.
  To pierwsza zależność produkcyjna; nie wymaga budowania. Odrzucone: dnd-kit (tylko React),
  Pragmatic drag and drop (sortowanie i animacje do własnoręcznego dopisania), Dragula (bez
  wydania od 2022).
- **Klawiatura zostaje własnym kodem.** Biblioteka jej nie obsługuje, a wymaganie dostępności
  z 2026-09-15 nie ustępuje.
- **Nowy blok staje w miejscu upuszczenia, a nie pod źródłowym.** Przerwa podąża za wskaźnikiem,
  więc wymuszenie miejsca pod źródłem łamałoby zasadę „ląduje tam, gdzie pokazuje przerwa”.
- **Wyciągnięte ćwiczenie tworzy kopię kategorii, nie kopię ćwiczenia.** Ćwiczenie nadal ma jeden
  blok, więc losowanie bez zwracania i ziarno (APPLICATION §4, §5.2) zostają bez zmian.

---

## 2026-09-22 — zwarty stan sesji i dotykowe przenoszenie

Realizacja zadań BACKLOG 1, 2 i 4. Wymagania: APPLICATION §3.2, §3.7, §5.3;
ARCHITECTURE §6, §10.

- **Cały stan sesji trafia do jednego, wersjonowanego parametru `s` w Base64URL.** Zwarta tablica
  JSON skraca domyślny adres z około 1,5 kB do około 200 znaków bez zależności produkcyjnej
  i bez asynchronicznej kompresji.
- **Kategorie i ćwiczenia są indeksami wyłącznie w obrębie dokładnej rewizji bazy.** Do stanu
  wchodzą `schemaVersion` i `generated`; niezgodność, stary format lub uszkodzenie odrzuca całość.
  Dzięki temu indeks nie może po cichu wskazać innego materiału po publikacji nowej bazy.
- **Odrzucony stan uruchamia parametry domyślne.** Częściowe odzyskiwanie nie daje pewności,
  że przekazany adres odtworzył zamierzony zestaw.
- **Powrót do parametrów czyta własne ziarno z aktywnego planu.** Pole puste nadal jednoznacznie
  oznacza zestaw dzienny; ręczne wyczyszczenie usuwa nadpisanie.
- **Dotyk wymaga przytrzymania uchwytu przez 350 ms.** Ruch przed aktywacją anuluje przenoszenie
  i pozostawia przewijanie przeglądarce; po aktywacji cel upuszczenia korzysta z tych samych
  operacji i komunikatów co mysz i klawiatura.

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
