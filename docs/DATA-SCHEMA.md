# Schemat pliku `database.json`

`src/webapp/data/database.json` jest statyczną bazą ćwiczeń wczytywaną raz przy starcie
aplikacji. Wersja schematu: **2.0**.

Aktualna zawartość: 7 kategorii, 70 ćwiczeń, 132 warianty i 735 pozycji.

## Zakres bazy

Plik zawiera wyłącznie dane potrzebne do wyboru, prezentacji i edycji ćwiczeń:

```text
schemaVersion, generated
categories[]          kolejność wyświetlania = kolejność w tablicy
exercises[]
  variants[]
    items[]
```

Wersja 2.0 nie przechowuje metadanych materiałów źródłowych ani rejestrów skanów. Usunięte
zostały `source.file`, `source.kind`, `source.publication`, `notes`, `duplicates[]` oraz
`nonTextMaterials[]`. Usunięto również pola ćwiczenia `phonemes` i `positions` oraz pole
wariantu `noteHtml` wraz z jego treścią. Informacje audytowe powinny być utrzymywane poza bazą wykonawczą, jeśli
będą ponownie potrzebne.

## Kategorie

Kategorie opisują zastosowanie terapeutyczne, a nie pojedynczy skan, głoskę lub publikację.
Szczegółowy cel ćwiczenia wynika z jego tytułu, poleceń i treści.

| `id` | Nazwa | Ćwiczeń |
|---|---|---:|
| `motoryka-orofacjalna-i-polykanie` | motoryka orofacjalna i połykanie | 6 |
| `oddech-fonacja-i-rezonans` | oddech, fonacja i rezonans | 7 |
| `technika-mowy-i-glosu` | technika mowy i głosu | 4 |
| `samogloski` | samogłoski | 7 |
| `artykulacja-i-roznicowanie-glosek` | artykulacja i różnicowanie głosek | 21 |
| `wprawki-artykulacyjne` | wprawki artykulacyjne | 2 |
| `teksty-do-czytania-terapeutycznego` | teksty do czytania terapeutycznego | 23 |

Każda pozycja `categories[]` ma dwa pola:

| Pole | Typ | Opis |
|---|---|---|
| `id` | string | unikalny klucz techniczny, referowany przez `exercises[].categoryId` |
| `name` | string | nazwa wyświetlana użytkownikowi |

Kolejność kategorii wynika z kolejności w tablicy; nie ma osobnego pola pozycji.

## Pola korzenia

| Pole | Typ | Opis |
|---|---|---|
| `schemaVersion` | string | wersja kontraktu danych; zmiana niezgodna wstecz podbija część główną |
| `generated` | string | rewizja treści jako data lub znacznik czasu ISO 8601; składnik ziarna sesji |
| `categories` | object[] | uporządkowany słownik kategorii |
| `exercises` | object[] | komplet ćwiczeń |

## `exercises[]`

| Pole | Typ | Opis |
|---|---|---|
| `id` | string | unikalny, stabilny identyfikator ćwiczenia |
| `title` | string | tytuł ćwiczenia |
| `categoryId` | string | klucz obcy do `categories[].id` |
| `level` | number \| null | poziom trudności 1–4; `null`, gdy poziom nie został określony |
| `randomizable` | boolean | `true` pozwala ograniczać liczbę pozycji; `false` podaje cały materiał |
| `readQuality` | string | `"pewny"` albo `"do_weryfikacji"` — zaufanie do treści transkrypcji |
| `headerHtml` | string \| null | nagłówek materiału |
| `contextHtml` | string \| null | opis metodyczny lub materiał wprowadzający pokazywany przed zadaniem |
| `instructionHtml` | string \| null | wspólne polecenie; wariant może je nadpisać |
| `variants` | object[] | co najmniej jeden wariant |

## `exercises[].variants[]`

| Pole | Typ | Opis |
|---|---|---|
| `id` | string | unikalny, stabilny identyfikator wariantu |
| `label` | string \| null | nazwa wariantu; `null` przy ćwiczeniu jednowariantowym |
| `type` | string | sposób renderowania: `items`, `text`, `prompt` albo `syllables` |
| `instructionHtml` | string \| null | polecenie wariantu; `null` dziedziczy `exercises[].instructionHtml` |
| `syllablesHtml` | string \| null | wiersz sylab treningowych, wyświetlany w całości |
| `textHtml` | string \| null | treść ciągła dla `type: "text"` |
| `examples` | string[] | przykłady wzorcowe; są podpowiedzią, nie podlegają losowaniu |
| `items` | object[] | pozycje do losowania; puste dla `text`, `syllables` i `prompt` |

Kolejność wariantów wynika z kolejności w tablicy.

### Typy wariantów

| Wartość | Liczba | Renderowanie |
|---|---:|---|
| `items` | 91 | lista niezależnych pozycji |
| `text` | 28 | tekst ciągły lub wierszowany, czytany w całości |
| `prompt` | 11 | polecenie bez pozycji, np. zadanie długoterminowe |
| `syllables` | 2 | wiersz sylab treningowych |

## `exercises[].variants[].items[]`

| Pole | Typ | Opis |
|---|---|---|
| `id` | string | unikalny, stabilny identyfikator pozycji |
| `html` | string | treść pozycji z dozwolonymi znacznikami semantycznymi |

## Znaczniki w treści HTML

| Klasa | Znaczenie |
|---|---|
| `target` | głoska docelowa |
| `legato` | samogłoska przedłużana w technice legato |
| `phonetic` | zapis fonetyczny lub ortofoniczny |
| `uncertain` | fragment niepewny albo nieczytelny |
| `breath` | miejsce wdechu |
| `exhale` | fraza realizowana na jednym wydechu |
| `blank` | miejsce na odpowiedź ustną |
| `juncture` | granica zestroju akcentowego |

Treść może ponadto zawierać `<p>`, `<br>`, `<strong>` i `<em>`. Edytor dopuszcza tylko
wymienione tagi i klasy oraz atrybut `title` na `span`. Puste znaczniki są usuwane z wyjątkiem
samodzielnych oznaczeń `blank` i `exhale`.

Rozdzielenie `target` i `legato` pozwala przełączać trzy warstwy prezentacji:

```css
/* pełny  */ .target { font-weight: 700 } .legato { text-decoration: underline }
/* głoska */ .legato { text-decoration: none }
/* czysty */ .target { font-weight: inherit } .legato { text-decoration: none }
```

## Reguły i konsekwencje implementacyjne

- Plik nie przechowuje liczników ani pól pozycji. Liczby wynikają z długości tablic, a kolejność
  z kolejności elementów.
- `variants[].instructionHtml: null` oznacza użycie polecenia ćwiczenia; oba pola równe `null`
  oznaczają brak polecenia.
- `randomizable: false` wyłącza ograniczanie pozycji także dla wariantów `items`. Typy `text`,
  `syllables` i `prompt` zawsze są podawane w całości.
- `readQuality` pozostaje w bazie, ponieważ steruje ostrzeżeniem w interfejsie. Obecnie 9 z 70
  ćwiczeń wymaga weryfikacji.
- 54 ćwiczenia nie mają określonego poziomu. Poziomy 1–4 mają odpowiednio 1, 3, 4 i 8 ćwiczeń.
- 35 ćwiczeń ma `randomizable: false`.

Krańce parametrów sesji `W` (warianty) i `P` (pozycje), liczone dla ćwiczeń w kategorii:

| Kategoria | maks. `W` | maks. `P` |
|---|---:|---:|
| motoryka orofacjalna i połykanie | 2 | 10 |
| oddech, fonacja i rezonans | 4 | 23 |
| technika mowy i głosu | 4 | 21 |
| samogłoski | 2 | 5 |
| artykulacja i różnicowanie głosek | 6 | 58 |
| wprawki artykulacyjne | 1 | 8 |
| teksty do czytania terapeutycznego | 1 | 0 |

Wartość `W = 1` albo `P = 0` oznacza, że formularz nie pokazuje danego ograniczenia.

## Odpowiedzialność za prawa do materiałów

Usunięcie metadanych źródłowych z pliku wykonawczego nie zmienia statusu prawnego treści.
Przed udostępnieniem aplikacji poza dozwolonym zakresem właściciel projektu powinien osobno
zweryfikować prawa i licencje do materiałów.
