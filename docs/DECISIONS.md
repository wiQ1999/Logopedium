# Dziennik decyzji

Plik pamięci projektu. Zapisane są tu rozstrzygnięcia podjęte przy implementacji: miejsca,
w których dokumentacja dopuszczała więcej niż jedną interpretację, oraz elementy wykraczające
poza jej zakres, konieczne do ukończenia działającej aplikacji.

Stan na: wersja 1.0 aplikacji, baza `schemaVersion 1.0` (wygenerowana 2026-09-08).

---

## 1. Interpretacje wymagań

### 1.1 Ćwiczenia bez określonego poziomu trudności

`level: null` występuje w 38 z 54 ćwiczeń. Poziom jest **górnym limitem**, więc ćwiczenie bez
zadeklarowanego poziomu nie może go przekroczyć — takie ćwiczenia przechodzą filtr zawsze,
niezależnie od ustawienia.

Konsekwencja: przy poziomie 1 baza wciąż udostępnia materiał w każdej kategorii, a limity
przy polach liczbowych maleją tylko tam, gdzie ćwiczenia mają przypisany poziom
(np. „tekst do czytania terapeutycznego”: 23 → 8).

### 1.2 „Wylosowany zestaw wariantów” (APPLICATION §6.2)

Krok planu zawiera **wszystkie warianty ćwiczenia**, a losowanie działa na poziomie
pozycji (`variants[].items[]`).

Podstawa: APPLICATION §6.1 wymaga pokazywania wariantów razem na wspólnej karcie
(„krótkie fragmenty należące do jednej instrukcji”), a DATA-SCHEMA jednoznacznie wskazuje
pozycje jako jednostkę losowania (`items[]` — „pozycje do losowania”, `randomizable` —
„wolno wybrać podzbiór pozycji”). Losowanie samych wariantów rozbiłoby spójne ćwiczenie
(np. sześć grup samogłoskowych w jednym poleceniu).

### 1.3 Liczba losowanych pozycji

Stała `MAX_ITEMS_PER_VARIANT = 8` w `picker.js` (mediana liczby pozycji w bazie: 8; maksimum: 30).

Dokumentacja nie przewiduje parametru użytkownika sterującego liczbą pozycji, a §5.2 wylicza
zamknięty skład ziarna — dlatego jest to stała w kodzie, nie parametr sesji. Zmiana wartości
zmienia zawartość planów, ale nie wymaga zmiany ziarna, bo losowanie pozycji odbywa się
w osobnej, deterministycznej fazie.

Zasady szczegółowe:

- `randomizable: false` → wszystkie pozycje, niezależnie od limitu (materiał podaje się w całości).
- `type: "text" | "syllables" | "prompt"` → treść w całości, bez losowania.
- Liczba pozycji ≤ limit → wszystkie pozycje, bez pobierania liczb z generatora.
- Wylosowane pozycje wyświetlane są **w kolejności z bazy**, nie w kolejności losowania —
  zachowuje to progresje samogłoskowe (a / e / y / i / o / u) i układ oryginału.
- Karta informuje o cięciu („Wylosowano 8 z 15 pozycji.”) tylko wtedy, gdy podzbiór jest mniejszy
  od całości.

### 1.4 Wartości początkowe parametrów

- data: bieżący dzień w czasie lokalnym (nie UTC),
- poziom: 4 (brak ograniczenia),
- kategorie: wszystkie aktywne, po 1 ćwiczeniu, w kolejności `categories[].order` z bazy.

Wariant „wszystkie po jednym” daje 25 ćwiczeń — dużo jak na jedną sesję, ale jest jedynym
ustawieniem, które nie faworyzuje arbitralnie wybranych kategorii i pokazuje całą bazę od razu.
Licznik „25 ćwiczeń z 25 kategorii” nad przyciskiem startu sygnalizuje rozmiar sesji, żeby
przycięcie zestawu było oczywistym następnym krokiem.

### 1.5 Polecenie wspólne a polecenia wariantów

Polecenie skuteczne wariantu = `variants[].instructionHtml ?? exercises[].instructionHtml`
(dziedziczenie z DATA-SCHEMA). Dodatkowo:

- gdy wszystkie warianty mają **identyczne** polecenie skuteczne → wyświetlane jest **raz**,
  nad wariantami,
- gdy polecenia się różnią → każdy wariant pokazuje swoje.

Bez tej reguły ćwiczenie `uderz-mocnym-dzwiekiem-nosowym` powtarzałoby to samo polecenie
sześć razy (baza duplikuje je w każdym wariancie), czyli dokładnie to, czemu przeciwdziała
APPLICATION §6.1.

### 1.6 Uwagi redakcyjne

`notes` opisane są w schemacie jako „nie do pokazywania ćwiczącemu”, więc nie pojawiają się
w sesji. W trybie przeglądania są widoczne jako wyraźnie oznaczony blok „Uwagi redakcyjne
(nie dla ćwiczącego)” — tryb ten służy pracy z bazą, nie ćwiczeniu.

### 1.7 Filtr poziomu w trybie przeglądania

W sesji poziom jest górnym limitem, w przeglądaniu — **filtrem dokładnym** (`poziom 2` pokazuje
tylko ćwiczenia poziomu 2), z dodatkową opcją „bez określonego poziomu”. Przeglądanie ma dawać
wgląd w całą bazę „bez filtrów sesyjnych” (APPLICATION §7), a filtr dokładny pozwala dotrzeć
do materiału, którego limit górny by nie wyodrębnił.

---

## 2. Rozstrzygnięcia techniczne

### 2.1 Parametry sesji w adresie

Adres sesji niesie komplet parametrów:

```
#/session/3?d=2026-09-10&l=4&c=gloska-dz:1,tekst-do-czytania-terapeutycznego:2&seed=...
```

Powód: APPLICATION §5.1 wymaga, żeby odświeżenie strony nie podmieniło ćwiczeń, a ARCHITECTURE
zakazuje trwałego zapisu stanu (bez `localStorage`, bez konta). Adres jest jedynym nośnikiem
stanu, który przeżywa przeładowanie, a przy okazji spełnia zapowiedź z ARCHITECTURE §5
o „odnośnikach do konkretnego stanu”.

Szczegóły:

- `c` wymienia wyłącznie kategorie aktywne, w kolejności wyświetlania; nieaktywne wracają na swoje
  domyślne pozycje przy odczycie adresu,
- identyfikatory kategorii zamiast indeksów — są stabilne z definicji schematu, indeks rozjechałby
  się po zmianie bazy,
- adres bywa długi (25 kategorii ≈ 1,1 kB) i jest to świadomy koszt czytelności i stabilności,
- wartości spoza zakresu (błędna data, poziom, nieznana kategoria, liczba ponad limit) są
  przycinane przy odczycie, więc ręcznie zmodyfikowany adres nie psuje aplikacji,
- tryb przeglądania trzyma w adresie filtry (`q`, `cat`, `level`) — wpisywanie w polu wyszukiwania
  aktualizuje adres przez `replaceState`, żeby nie zaśmiecać historii.

### 2.2 Ziarno losowania

Postać ziarna:

```
logopedium|v=<schemaVersion>|d=<data>|l=<poziom>|c=<id:liczba,... posortowane rosnąco po id>
```

Zawiera dokładnie składniki z APPLICATION §5.2. Sortowanie po identyfikatorze sprawia, że
przestawienie kategorii na liście nie zmienia ziarna — zmienia wyłącznie kolejność kroków.

Nadpisanie ziarna (`§5.3`) dostępne jest w trzech miejscach: parametr `seed` w adresie, pole
„Własne ziarno” w formularzu parametrów oraz przycisk „Wylosuj nowy zestaw na ten dzień”
w podsumowaniu. Nowe ziarno powstaje z `crypto.getRandomValues`; nie jest to element budowy
planu, więc nie narusza zakazu użycia wbudowanego generatora losowego.

### 2.3 Determinizm budowy planu

Generator: mulberry32 z ziarnem policzonym funkcją FNV-1a (32-bitową). Losowanie bez zwracania
to częściowe tasowanie Fishera–Yatesa pobierające dokładnie tyle liczb, ile elementów wybiera.

Kolejność pobierania liczb jest w pełni określona:

1. kategorie aktywne posortowane po `id` (nie po kolejności wyświetlania),
2. w kategorii — kandydaci posortowani po `id`, po odrzuceniu ćwiczeń ponad poziom,
3. następnie, w osobnej fazie, wszystkie wylosowane ćwiczenia posortowane po `id` — dla każdego
   losowane są pozycje w wariantach (warianty w kolejności `order`).

Rozdzielenie faz gwarantuje, że dobór pozycji nie zależy od tego, ile kategorii jest aktywnych
ani jak są ustawione. Do sortowania używane jest porównanie kodowe (`a < b`), nie `localeCompare` —
kolejność zależna od ustawień językowych środowiska łamałaby powtarzalność.

Kroki układane są dopiero na końcu, zgodnie z kolejnością kategorii z parametrów; ćwiczenia
w obrębie kategorii zachowują kolejność losowania.

### 2.4 Walidacja bazy

`validateDatabase` zbiera **wszystkie** niezgodności, `buildDatabase` zgłasza je jako `DatabaseError`
z listą przyczyn (maksymalnie 25 pozycji, reszta zliczona), a aplikacja wyświetla je zamiast
pustego interfejsu (ARCHITECTURE §8).

Twarde błędy: brak lub zły typ pól wymaganych, powtórzone identyfikatory (wspólna przestrzeń
nazw ćwiczeń, wariantów i pozycji), odwołanie do nieistniejącej kategorii, nieznany `type` wariantu
(decyduje o renderowaniu), pusta lista pozycji przy `type: "items"`, brak treści przy `text`
i `syllables`, poziom spoza 1–4, powtórzona kolejność wariantów w ćwiczeniu, niezgodna wersja
główna schematu.

Świadomie **nie** są walidowane słownikowo: `readQuality`, `source.kind`, `phonemes`, `positions` —
to pola informacyjne, ich rozszerzenie nie powinno blokować startu aplikacji. `duplicates`
i `nonTextMaterials` są opcjonalne.

### 2.5 Wydobywanie tekstu do wyszukiwania i zapowiedzi

Znaczniki inline (`span`, `strong`, `em`) usuwane są **bez** wstawiania spacji, blokowe
(`p`, `br`, `div`, `li`, `h1`–`h6`) — ze spacją. Baza wstawia `<span>` wewnątrz wyrazów
(oznaczenia głosek i legato), więc zamiana każdego znacznika na spację rozbijałaby wyrazy —
„aptekarzem” stawało się „a pt e k a rz e m” i nie dawało się wyszukać.

Zapytanie i tekst ćwiczenia normalizowane są przez usunięcie znaków diakrytycznych (NFD +
usunięcie znaków łączących, `ł` → `l`) i zmianę na małe litery. Wszystkie słowa zapytania muszą
wystąpić w tekście (koniunkcja). Zapowiedź na liście budowana jest z treści bez tytułu, żeby
nie powtarzać nagłówka pozycji.

### 2.6 Przełączanie warstw oznaczeń

Karta ćwiczenia ma przełącznik `pełne / głoska / czysty`, realizujący trzy tryby opisane
w DATA-SCHEMA („Przełączanie warstw”). Tryb jest atrybutem `data-marks` na karcie, przełączanie
odbywa się w CSS, bez ponownego renderowania treści. Wybór utrzymuje się między krokami sesji
i między stanami interfejsu (stan w pamięci, zgodnie z ARCHITECTURE).

### 2.7 Rejestr audytowy w trybie przeglądania

`duplicates[]` i `nonTextMaterials[]` pokazywane są na dole listy bazy w zwiniętej sekcji
„Rejestr audytowy bazy”. Tryb przeglądania ma dawać wgląd w **całą** zawartość bazy, a te dwie
tablice są jej częścią; zwinięcie oddziela materiał audytowy od ćwiczeń.

### 2.8 Dostępność i sterowanie

- Nawigacja w sesji także strzałkami ← →, z pominięciem pól formularza.
- Po zmianie stanu interfejsu fokus wraca na `#app-main` (poza pierwszym renderowaniem).
- Każdy stan ma nagłówek pierwszego poziomu; w sesji i w podglądzie ćwiczenia jest on ukryty
  wizualnie (`.visually-hidden`), żeby nie dublować tytułu karty.
- Przestawianie kategorii przyciskami (nie „przeciągnij i upuść”) — działa z klawiatury
  i na dotyku; po przestawieniu fokus wraca na ten sam przycisk.
- Kolejność kategorii to lista `<ol>`; wyłączona kategoria pozostaje na swojej pozycji
  (APPLICATION §3.1).

---

## 3. Elementy spoza dokumentacji

### 3.1 Nazwa pliku bazy

DATA-SCHEMA opisuje plik `cwiczenia-logopedyczne.json`, ARCHITECTURE §3 wskazuje
`src/webapp/data/database.json` i taki plik jest w repozytorium — aplikacja czyta
`data/database.json`. Wersja zminifikowana (`*.min.json`) nie jest używana; nie ma kroku
budowania, który mógłby ją wytworzyć.

### 3.2 Narzędzia deweloperskie poza katalogiem aplikacji

Katalog `src/webapp/` pozostaje samowystarczalny i pozbawiony zależności — publikacja to nadal
skopiowanie go w całości. Poza nim dodane zostały:

- `package.json` — `type: module` (potrzebne, by Node wykonywał moduły aplikacji w testach),
  skrypty `start` i `test`,
- `tools/serve.js` — lokalny serwer HTTP bez zależności (wymóg z ARCHITECTURE §4 dotyczy
  uruchomienia, nie sposobu jego realizacji); blokuje wyjście poza katalog aplikacji,
- `tests/` — testy uruchamiane wbudowanym `node --test`,
- `jsdom` jako jedyna zależność deweloperska — pozwala testować warstwę widoków (formularz
  parametrów, przebieg sesji, przeglądanie) bez przeglądarki. Aplikacja nie ma zależności
  produkcyjnych.

### 3.3 Katalogi zasobów

`assets/icons/favicon.svg` — ikona strony, żeby uniknąć zapytania zakończonego błędem 404.
`assets/img/` pozostaje pusty (poza plikiem `README.txt` wyjaśniającym przeznaczenie): baza
w obecnej wersji nie odwołuje się do żadnej grafiki, a jedyny materiał nietekstowy figuruje
w `nonTextMaterials[]` jako kandydat na ilustrację.

### 3.4 Motyw jasny i ciemny

Interfejs respektuje `prefers-color-scheme`. Dokumentacja tego nie wymaga, ale materiał czyta się
na ekranie długo, a oba warianty kolorystyczne wynikają z tego samego zestawu zmiennych CSS —
koszt jest jednorazowy.

---

## 4. Świadome ograniczenia

- Brak mechanizmu ograniczania powtórek między dniami — zgodnie z APPLICATION §4.
- Brak zapamiętywania ustawień i postępu poza adresem — zgodnie z ARCHITECTURE §2 i §10.
- Pola `phonemes` i `positions` są widoczne w metryce ćwiczenia, ale nie służą jako filtry;
  dokumentacja przewiduje filtrowanie tylko po kategorii i poziomie.
- Sugestia z DATA-SCHEMA, by rozbić dominującą kategorię „tekst do czytania terapeutycznego”
  (23 z 54 ćwiczeń) albo ją ważyć, nie została zrealizowana w danych — sterowanie liczbą ćwiczeń
  w kategorii realizuje ten sam cel po stronie parametrów, bez ingerencji w bazę.
- Uwaga redakcyjna przy ćwiczeniu `swiderki-nitki-rurki` sugeruje tryb „odsłoń” dla miejsc na
  odpowiedź. Miejsca te renderowane są jako linia (`.blank`), bez mechaniki odsłaniania —
  wykracza poza opisany zakres pierwszej wersji.
