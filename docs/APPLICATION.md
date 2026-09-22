# Aplikacja — wymagania funkcjonalne

## 1. Przeznaczenie

Aplikacja układa i prowadzi sesję ćwiczeń logopedycznych na podstawie bazy zadań.
Dwa niezależne tryby pracy:

- **Sesja** — zestaw ćwiczeń dobrany losowo na dany dzień.
- **Przeglądanie** — wgląd w całą bazę, bez losowania i ograniczeń.

---

## 2. Stany interfejsu

| Stan | Zawartość |
|---|---|
| Parametry | konfiguracja sesji i jej start |
| Ćwiczenie | jedno ćwiczenie z instrukcją i nawigacją |
| Podsumowanie | zakończenie sesji |
| Lista bazy | wszystkie ćwiczenia, z wyszukiwaniem i filtrami |
| Podgląd ćwiczenia | pełna zawartość jednego ćwiczenia poza sesją, z trybem edycji |

Każdy stan ma własny adres.

---

## 3. Parametry sesji

### 3.1 Bloki

Parametry sesji to lista **bloków**. Blok to kategoria wraz z należącymi do niej ćwiczeniami
i własnym kompletem ustawień. Na starcie każda kategoria ma jeden blok obejmujący całą swoją
zawartość; kategorię można rozdzielić na kilka bloków (§3.2). Kolejność bloków na liście
wyznacza kolejność kroków w sesji.

| Pole | Znaczenie |
|---|---|
| Liczba ćwiczeń | ile ćwiczeń z bloku trafia do sesji; zero wyłącza blok |
| Liczba wariantów (`W`) | górny limit wariantów pokazywanych w jednym ćwiczeniu bloku |
| Liczba pozycji (`P`) | budżet pozycji na całe ćwiczenie, dzielony między pokazane warianty |
| Dobór | `kolejność` albo `losowo` — sposób brania wariantów i pozycji (§3.5) |

Pola `W` i `P` pojawiają się tylko tam, gdzie mają co ograniczać (§3.4).

- Liczba ćwiczeń równa zero oznacza blok nieaktywny; blok zachowuje pozycję na liście,
  a jego ustawienia pozostają zapamiętane.
- Maksimum liczby ćwiczeń to liczba aktywnych ćwiczeń bloku przy ustawionym poziomie,
  widoczna przy polu.
- Sterowanie liczbą ćwiczeń, nie czasem sesji — czasu wykonania ćwiczenia nie da się oszacować.
- Ustawienia bloku obowiązują wyłącznie jego ćwiczenia, a krańce `W` i `P` wynikają z jego
  zawartości — ta sama liczba w dwóch blokach znaczy co innego (§3.4).

### 3.2 Rozwinięcie bloku i podział kategorii

Blok daje się rozwinąć: pokazuje wtedy wszystkie swoje ćwiczenia, po jednym w wierszu. Każde
ćwiczenie ma własny przełącznik aktywności — wyłączone nie bierze udziału w losowaniu i nie
liczy się do krańców bloku. Blok bez aktywnych ćwiczeń zachowuje się jak wyłączony.

Wiersze — bloki i ćwiczenia — przestawia się przeciągnięciem; nie ma przycisków „góra”
i „dół”. Ćwiczenie wyciągnięte poza swój blok tworzy nowy blok tej samej kategorii,
zawierający tylko to ćwiczenie. Tak dzieli się jedną kategorię na kilka bloków o różnych
ustawieniach: część ćwiczeń z pełnym materiałem, część przycięta, każda część w swoim miejscu
sesji i we własnym trybie doboru.

- Ćwiczenie należy do dokładnie jednego bloku — przeciągnięcie przenosi je, nie kopiuje.
- Nowy blok staje pod źródłowym i dziedziczy jego tryb doboru; liczby wracają na krańce
  własnej zawartości.
- Blok przyjmuje wyłącznie ćwiczenia swojej kategorii; opróżniony ze wszystkich znika z listy.
- Wszystkie 7 kategorii obejmuje więcej niż jedno ćwiczenie, więc każdą można sensownie
  podzielić na mniejsze bloki.

### 3.3 Pozostałe parametry

| Parametr | Zachowanie |
|---|---|
| Poziom trudności | górny limit; ćwiczenia bez zadeklarowanego poziomu przechodzą zawsze |
| Data | domyślnie bieżący dzień; podstawa losowania |

Te dwa parametry są wspólne dla całej sesji; wszystko pozostałe należy do bloku.

Daty wyświetlane są w formacie wynikającym z ustawień przeglądarki: pole daty korzysta
z kontrolki natywnej, pozostałe miejsca z ustawień regionalnych. `rrrr-mm-dd` pozostaje
formatem wewnętrznym — w adresie, ziarnie i zapisie ustawień.

### 3.4 Zakres materiału w bloku

Krańce `W` i `P` liczone są osobno dla każdego bloku, z jego aktywnych ćwiczeń po filtrze
poziomu. Przeliczają je: zmiana poziomu, przełączenie ćwiczenia i przeniesienie ćwiczenia
między blokami. Samo przestawianie wierszy nie zmienia niczego.

#### Zakres `W`

- **minimum** — 1.
- **maksimum** — najwyższa liczba wariantów wśród ćwiczeń bloku.

#### Zakres `P`

`P` zależy od `W` tego samego bloku i przelicza się przy każdej jego zmianie; wartość spoza
zakresu jest dociągana do krańca.

- **minimum** — `W`, czyli jedna pozycja na każdy wskazany wariant; w bloku uboższym
  w pozycje niż w warianty minimum schodzi do jego maksimum.
- **maksimum** — największa suma pozycji, jaką da się złożyć z `W` najbogatszych wariantów
  jednego ćwiczenia bloku.

Warianty bez pozycji (`text`, `syllables`, `prompt`) są w tym rachunku pomijane: `P` jest budżetem
pozycji, a one żadnej nie wnoszą. Do `W` liczą się normalnie, jak każdy inny wariant.

#### Bloki bez materiału do ograniczania

Pole pojawia się tylko wtedy, gdy jest z czego wybierać:

- blok o samych ćwiczeniach jednowariantowych nie dostaje pola `W` — przy blokach domyślnych
  dotyczy to „wprawek artykulacyjnych” i „tekstów do czytania terapeutycznego”;
- blok bez pozycji nie dostaje pola `P`, a jego materiał podawany jest w całości — przy blokach
  domyślnych dotyczy to „tekstów do czytania terapeutycznego” (23 ćwiczenia).

Przypadki są niezależne, więc wiersz niesie od jednej do trzech liczb. Ukryte pole zachowuje
swoją jedyną możliwą wartość — `W` = 1 albo `P` = 0 — i tyle wchodzi do planu sesji. Wyłączenie
ćwiczenia i podział kategorii mogą pole ukryć albo przywrócić, bo zmieniają zawartość bloku.

Krańce przy blokach domyślnych sięgają `W` = 6 i `P` = 58 („artykulacja i różnicowanie
głosek”), a najuboższy blok z pozycjami zatrzymuje się na `P` = 5.

#### Podział `P` między warianty

Budżet dzielony jest po zatwierdzeniu parametrów — wartością `P` z bloku ćwiczenia, między
wylosowane warianty **mające pozycje**. Kolejno:

1. Każdy taki wariant dostaje 2 pozycje, o ile budżet starcza i wariant tyle ma. Wariant
   z jedną pozycją dostaje jedną, a zaoszczędzona pozycja zasila pozostałe.
2. Gdy budżet nie pokrywa dwóch pozycji na wariant, każdy dostaje po jednej, a reszta trafia
   tam, gdzie starczy. Minimum `P` nie schodzi poniżej liczby wariantów z pozycjami, więc żaden
   z nich nie zostaje pusty.
3. Pozostały budżet rozdzielany jest losowo, nie proporcjonalnie — krótki i długi wariant mogą
   stanąć obok siebie zamiast równych porcji.
4. Przydział większy niż zasób wariantu jest przycinany, a nadwyżka wraca do podziału.

Ćwiczenie mające łącznie mniej pozycji niż `P` podaje je w całości. `randomizable: false`
oznacza wszystkie pozycje, bez podziału budżetu.

### 3.5 Dobór podzbioru

Parametr `Dobór` rozstrzyga, **które** elementy trafiają do kroku, gdy brany jest podzbiór —
wariantów z ćwiczenia i pozycji z wariantu:

- **kolejność** — losowany jest punkt startowy z zakresu `0 … liczba elementów − N`,
  brane jest N kolejnych elementów w kolejności z bazy;
- **losowo** — losowanych jest N elementów, wyświetlanych w kolejności losowania.

Tryb `losowo` tasuje kolejność także wtedy, gdy limit nie tnie zbioru. Tryb `kolejność`
przy limicie ustawionym na maksimum oddaje zbiór w kolejności z bazy.

Tryb należy do bloku: tekst czytany po kolei i zestaw wyrazów do przetasowania mogą wtedy
trafić do jednej sesji, każdy we właściwym sobie porządku.

### 3.6 Wartości początkowe

Brak zapisu w przeglądarce (§3.8) oznacza sesję nieograniczoną: jeden blok na kategorię,
wszystkie ćwiczenia aktywne, najwyższy poziom, w każdym bloku tyle ćwiczeń, ile jest
dostępnych, a `W` i `P` na maksimach bloku, więc nic nie zostaje przycięte. Dobór `kolejność`,
data bieżąca. Aplikacja nie ma predefiniowanego zestawu startowego — wartości domyślne wynikają
wprost z zawartości bazy.

### 3.7 Zmiana parametrów

Zatwierdzenie parametrów tworzy nowy plan sesji i rozpoczyna ją od początku. Postęp
poprzedniej sesji nie jest przenoszony.

### 3.8 Zapamiętywanie między wizytami

Ustawienia przeżywają zamknięcie przeglądarki i wracają przy kolejnym otwarciu, także po
kilku dniach. Zapamiętywane są wszystkie parametry z §3.1–§3.3 poza datą, wraz z podziałem
kategorii na bloki i aktywnością poszczególnych ćwiczeń; poza zapisem zostają ziarno, postęp
w sesji i tryb oznaczeń (§6.4).

- Zapis następuje przy zatwierdzeniu parametrów, nie przy każdej zmianie pola.
- Odczyt podlega tej samej walidacji co parametry z adresu: wartości spoza zakresu są
  przycinane, nieznane kategorie i ćwiczenia pomijane, nowe dopisywane z wartością domyślną —
  nowe ćwiczenie trafia do pierwszego bloku swojej kategorii.
- Zapis uszkodzony lub w niezgodnej wersji jest odrzucany w całości; skutek jest ten sam
  co brak zapisu i nie jest zgłaszany jako błąd.
- Parametry z adresu mają pierwszeństwo przed zapisem.
- Formularz pozwala jednym działaniem przywrócić wartości domyślne i usunąć zapis.

Mechanizm zapisu opisuje ARCHITECTURE §5.

---

## 4. Dobór ćwiczeń

1. Odrzucenie ćwiczeń wyłączonych, należących do bloków nieaktywnych oraz przekraczających
   ustawiony poziom.
2. Losowanie z każdego aktywnego bloku tylu ćwiczeń, ile wskazano w parametrach.
3. Pobranie wariantów i pozycji według `W`, `P` i trybu doboru bloku, z którego pochodzi
   ćwiczenie (§3.4, §3.5).
4. Ułożenie kroków zgodnie z kolejnością bloków; ćwiczenia z jednego bloku zachowują jego
   kolejność.

W obrębie sesji ćwiczenia nie powtarzają się — każde należy do jednego bloku, a losowanie
odbywa się bez zwracania. Między dniami brak ograniczania powtórek: to samo ćwiczenie może
wystąpić w kolejnych sesjach.

---

## 5. Losowanie z ziarnem

### 5.1 Wymaganie

Zestaw musi być powtarzalny w obrębie doby. Odświeżenie strony, powrót z innego stanu ani
zamknięcie przeglądarki nie podmieniają ćwiczeń. Ten sam dzień i te same parametry dają
zawsze ten sam plan.

### 5.2 Składniki ziarna

Data, wersja schematu i rewizja treści bazy (`generated`), poziom trudności oraz zestaw
aktywnych bloków: kategoria bloku, jego aktywne ćwiczenia i liczba ćwiczeń do wylosowania.

Do ziarna nie wchodzą: kolejność bloków, limity `W` i `P` oraz tryb doboru.
Kolejność bloków zmienia tylko układ kroków. Pozostałe działają w osobnej fazie na
ziarnie pochodnym, liczonym z ziarna sesji i identyfikatora ćwiczenia — dzięki temu zmiana
limitu przekształca zawartość kroku, ale nie podmienia wylosowanych ćwiczeń.

### 5.3 Nadpisanie ziarna

Aplikacja przyjmuje ziarno przekazane w adresie, polem w formularzu parametrów oraz
przyciskiem ponownego losowania w podsumowaniu. Zastosowania: testy powtarzalności,
odtworzenie sesji z przeszłości, nowy zestaw na bieżący dzień.

---

## 6. Przebieg sesji

### 6.1 Plan sesji

Plan to lista kroków; jeden krok to jedno ćwiczenie wraz z pobranym zestawem wariantów
i pozycji. Plan powstaje raz, przy zatwierdzeniu parametrów, i nie zmienia się w trakcie sesji.

### 6.2 Zasady wyświetlania

- Jedno ćwiczenie na stronę.
- Warianty wybrane do kroku wyświetlane są razem, na wspólnej karcie ćwiczenia.
- Ćwiczenia z tej samej kategorii nie są łączone — każde stanowi osobny krok.
- Przejście dalej wymaga kliknięcia. Brak automatycznego przewijania i odliczania czasu.
- Powrót do ćwiczenia poprzedniego jest możliwy.
- Karta informuje o przycięciu materiału, gdy pokazany zestaw jest mniejszy od całości.

### 6.3 Karta ćwiczenia

Nazwa kategorii, tytuł, polecenie, treść wariantów, wskaźnik postępu i nawigacja.

Polecenie wariantu nadpisuje polecenie ćwiczenia. Gdy wszystkie pokazane warianty mają
identyczne polecenie skuteczne, wyświetlane jest ono raz, nad wariantami; gdy się różnią —
każdy wariant pokazuje swoje.

### 6.4 Tryb oznaczeń

Przełącznik `pełne / głoska / czysty` zmienia widoczność oznaczeń w treści. Wybór utrzymuje
się między krokami i stanami interfejsu do końca wizyty, bez trwałego zapisu.

### 6.5 Postęp

Miejsce w sesji jest zapamiętywane na czas jej trwania. Zmiana daty lub zatwierdzenie nowych
parametrów unieważnia postęp.

---

## 7. Przeglądanie i edycja bazy

Tryb niezależny od sesji, obejmujący całą zawartość bazy — bez losowania i bez limitów
sesyjnych. Ćwiczenia pokazywane są ze wszystkimi wariantami i pozycjami.

- lista wszystkich ćwiczeń, pogrupowana po kategoriach,
- podgląd pojedynczego ćwiczenia oraz podgląd jego surowych danych z bazy,
- wyszukiwanie tekstowe po tytule, instrukcji i treści,
- filtrowanie po kategorii oraz po poziomie — tu filtr **dokładny**, nie górny limit,
  z dodatkową opcją „bez określonego poziomu”.

### 7.1 Tryb edycji

Z podglądu można przejść do edycji całego ćwiczenia albo wybranego wariantu. Formularz
udostępnia odpowiadające im pola z `database.json`; identyfikatory pozostają niezmienne.

Pola z treścią HTML mają pasek formatowania. Przycisk nakłada na zaznaczenie właściwą klasę
semantyczną opisaną w DATA-SCHEMA, bez ręcznego wpisywania znaczników. Każda zmiana tekstu
lub formatowania jest od razu widoczna w podglądzie renderowanym tak samo jak karta ćwiczenia.

Edycja zmienia roboczą kopię bazy w pamięci przeglądarki. Zapis jest dostępny dopiero po
walidacji całości i eksportuje kompletny plik `database.json`; opublikowana baza zmienia się
po zastąpieniu nim pliku aplikacji i ponownym wdrożeniu. Wyjście z niezapisanymi zmianami
wymaga potwierdzenia.

Wyeksportowana kopia pozostaje dostępna w przeglądaniu do odświeżenia strony. Nie zmienia
planu sesji ani bazy używanej do losowania przed ponowną publikacją.
