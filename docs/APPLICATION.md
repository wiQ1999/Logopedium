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
| Podgląd ćwiczenia | pełna zawartość jednego ćwiczenia poza sesją |

Każdy stan ma własny adres.

---

## 3. Parametry sesji

### 3.1 Kategorie

Jedna lista obsługująca trzy funkcje: aktywność kategorii, liczbę ćwiczeń oraz kolejność
w sesji wyznaczaną pozycją na liście.

- Liczba ćwiczeń równa zero oznacza kategorię nieaktywną; kategoria zachowuje pozycję.
- Maksimum to liczba ćwiczeń dostępnych w kategorii przy ustawionym poziomie, widoczna przy polu.
- Sterowanie liczbą ćwiczeń, nie czasem sesji — czasu wykonania ćwiczenia nie da się oszacować.

### 3.2 Pozostałe parametry

| Parametr | Zachowanie |
|---|---|
| Poziom trudności | górny limit; ćwiczenia bez zadeklarowanego poziomu przechodzą zawsze |
| Data | domyślnie bieżący dzień; podstawa losowania |
| Liczba wariantów (`W`) | górny limit wariantów pokazywanych w jednym ćwiczeniu; dotyczy każdego ćwiczenia z więcej niż jednym wariantem, bez wyjątków dla typów wariantu |
| Liczba pozycji (`P`) | łączna liczba pozycji pobieranych z wylosowanych wariantów jednego ćwiczenia — budżet na całe ćwiczenie, nie na pojedynczy wariant |
| Dobór | `kolejność` albo `losowo`, wspólnie dla wariantów i pozycji (§3.4) |

Oba limity są globalne dla sesji — ustawianie ich osobno dla kategorii, ćwiczenia czy wariantu
dałoby więcej pól, niż da się sensownie wypełnić.

Daty wyświetlane są w formacie wynikającym z ustawień przeglądarki: pole daty korzysta
z kontrolki natywnej, pozostałe miejsca z ustawień regionalnych. `rrrr-mm-dd` pozostaje
formatem wewnętrznym — w adresie, ziarnie i zapisie ustawień.

### 3.3 Liczba wariantów i liczba pozycji

#### Zakres `P`

`P` zależy od `W` i przelicza się przy każdej jego zmianie; wartość spoza zakresu jest dociągana
do krańca.

- **minimum** — `W`, czyli jedna pozycja na każdy wskazany wariant.
- **maksimum** — największa suma pozycji, jaką da się złożyć z `W` najbogatszych wariantów
  jednego ćwiczenia. Liczone po filtrze poziomu, niezależnie od tego, które kategorie są aktywne —
  inaczej kraniec skakałby przy każdym przełączeniu kategorii.

Warianty bez pozycji (`text`, `syllables`, `prompt`) są w tym rachunku pomijane: `P` jest budżetem
pozycji, a one żadnej nie wnoszą. Do `W` liczą się normalnie, jak każdy inny wariant.

W obecnej bazie: `W` = 1 → `P` od 1 do 30, `W` = 2 → 2…46, `W` = 3 i więcej → `W`…58
(najbogatsze ćwiczenie ma trzy warianty z pozycjami).

#### Podział `P` między warianty

Budżet dzielony jest po zatwierdzeniu parametrów, między wylosowane warianty **mające pozycje**.
Kolejno:

1. Każdy taki wariant dostaje 2 pozycje, o ile budżet starcza i wariant tyle ma. Wariant
   z jedną pozycją dostaje jedną, a zaoszczędzona pozycja zasila pozostałe.
2. Gdy budżet nie pokrywa dwóch pozycji na wariant, każdy dostaje po jednej, a reszta trafia
   tam, gdzie starczy. Ponieważ `P ≥ W`, żaden wylosowany wariant nie zostaje pusty.
3. Pozostały budżet rozdzielany jest losowo, nie proporcjonalnie — krótki i długi wariant mogą
   stanąć obok siebie zamiast równych porcji.
4. Przydział większy niż zasób wariantu jest przycinany, a nadwyżka wraca do podziału.

Ćwiczenie mające łącznie mniej pozycji niż `P` podaje je w całości. `randomizable: false`
oznacza wszystkie pozycje, bez podziału budżetu.

### 3.4 Dobór podzbioru

Parametr `Dobór` rozstrzyga, **które** elementy trafiają do kroku, gdy brany jest podzbiór —
wariantów z ćwiczenia i pozycji z wariantu:

- **kolejność** — losowany jest punkt startowy z zakresu `0 … liczba elementów − N`,
  brane jest N kolejnych elementów w kolejności z bazy;
- **losowo** — losowanych jest N elementów, wyświetlanych w kolejności losowania.

Tryb `losowo` tasuje kolejność także wtedy, gdy limit nie tnie zbioru. Tryb `kolejność`
przy limicie ustawionym na maksimum oddaje zbiór w kolejności z bazy.

### 3.5 Wartości początkowe

Brak zapisu w przeglądarce (§3.7) oznacza sesję nieograniczoną: najwyższy poziom, w każdej
kategorii tyle ćwiczeń, ile jest dostępnych, `W` i `P` na swoich maksimach (w obecnej bazie
6 i 58, co nie tnie żadnego ćwiczenia), dobór `kolejność`, data bieżąca. Aplikacja nie ma
predefiniowanego zestawu startowego — wartości domyślne wynikają wprost z zawartości bazy.

### 3.6 Zmiana parametrów

Zatwierdzenie parametrów tworzy nowy plan sesji i rozpoczyna ją od początku. Postęp
poprzedniej sesji nie jest przenoszony.

### 3.7 Zapamiętywanie między wizytami

Ustawienia przeżywają zamknięcie przeglądarki i wracają przy kolejnym otwarciu, także po
kilku dniach. Zapamiętywane są wszystkie parametry z §3.1 i §3.2 poza datą.

Nie są zapamiętywane: data sesji, ziarno, postęp w sesji, tryb oznaczeń (§6.4).

- Zapis następuje przy zatwierdzeniu parametrów, nie przy każdej zmianie pola.
- Odczyt podlega tej samej walidacji co parametry z adresu: wartości spoza zakresu są
  przycinane, nieznane kategorie pomijane, nowe kategorie dopisywane z wartością domyślną.
- Zapis uszkodzony lub w niezgodnej wersji jest odrzucany w całości; skutek jest ten sam
  co brak zapisu i nie jest zgłaszany jako błąd.
- Parametry z adresu mają pierwszeństwo przed zapisem.
- Formularz pozwala jednym działaniem przywrócić wartości domyślne i usunąć zapis.

Mechanizm zapisu opisuje ARCHITECTURE §5.

---

## 4. Dobór ćwiczeń

1. Odrzucenie ćwiczeń z kategorii nieaktywnych i przekraczających ustawiony poziom.
2. Losowanie z każdej aktywnej kategorii tylu ćwiczeń, ile wskazano w parametrach.
3. Pobranie wariantów i pozycji zgodnie z §3.3 i §3.4.
4. Ułożenie kroków zgodnie z kolejnością kategorii z listy parametrów.

W obrębie sesji ćwiczenia nie powtarzają się — losowanie bez zwracania. Między dniami brak
ograniczania powtórek: to samo ćwiczenie może wystąpić w kolejnych sesjach.

---

## 5. Losowanie z ziarnem

### 5.1 Wymaganie

Zestaw musi być powtarzalny w obrębie doby. Odświeżenie strony, powrót z innego stanu ani
zamknięcie przeglądarki nie podmieniają ćwiczeń. Ten sam dzień i te same parametry dają
zawsze ten sam plan.

### 5.2 Składniki ziarna

Data, wersja bazy, poziom trudności oraz zestaw aktywnych kategorii wraz z liczbą ćwiczeń.

Do ziarna nie wchodzą: kolejność kategorii, limity wariantów i pozycji oraz tryb doboru.
Kolejność kategorii zmienia tylko układ kroków. Pozostałe działają w osobnej fazie na
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

Uwagi redakcyjne (`notes`) nie są pokazywane w sesji.

### 6.4 Tryb oznaczeń

Przełącznik `pełne / głoska / czysty` zmienia widoczność oznaczeń w treści. Wybór utrzymuje
się między krokami i stanami interfejsu do końca wizyty, bez trwałego zapisu.

### 6.5 Postęp

Miejsce w sesji jest zapamiętywane na czas jej trwania. Zmiana daty lub zatwierdzenie nowych
parametrów unieważnia postęp.

---

## 7. Przeglądanie bazy

Tryb niezależny od sesji, obejmujący całą zawartość bazy — bez losowania i bez limitów
sesyjnych. Ćwiczenia pokazywane są ze wszystkimi wariantami i pozycjami.

- lista wszystkich ćwiczeń, pogrupowana po kategoriach,
- podgląd pojedynczego ćwiczenia oraz podgląd jego surowych danych z bazy,
- wyszukiwanie tekstowe po tytule, instrukcji i treści,
- filtrowanie po kategorii oraz po poziomie — tu filtr **dokładny**, nie górny limit,
  z dodatkową opcją „bez określonego poziomu”,
- uwagi redakcyjne widoczne jako osobny blok oznaczony jako nieprzeznaczony dla ćwiczącego,
- rejestr audytowy bazy (`duplicates`, `nonTextMaterials`) w zwiniętej sekcji na końcu listy.
