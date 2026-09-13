# Dziennik decyzji

Chronologiczny zapis rozstrzygnięć. Wymagania opisują APPLICATION i ARCHITECTURE — tutaj
trafia tylko decyzja i jej uzasadnienie.

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
  pola nie skakał przy każdym przełączeniu kategorii.
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
  trwały między dniami i mieści listę 25 kategorii (ciasteczka nie mieszczą).
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

- **`level: null` przechodzi filtr poziomu zawsze** (38 z 54 ćwiczeń). Poziom jest górnym
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

- Dominująca kategoria „tekst do czytania terapeutycznego” (23 z 54 ćwiczeń) nie została
  rozbita w danych — ten sam cel realizuje liczba ćwiczeń w kategorii, bez ingerencji w bazę.
- `phonemes` i `positions` są widoczne w metryce ćwiczenia, ale nie służą jako filtry.
- Miejsca na odpowiedź renderowane jako linia, bez mechaniki odsłaniania.
