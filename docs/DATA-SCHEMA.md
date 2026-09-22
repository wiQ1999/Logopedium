# Schemat pliku `database.json`

Statyczna baza danych aplikacji: `src/webapp/data/database.json`, wczytywany raz przy starcie.
Wersja schematu: **1.1**. Rozmiar ~535 kB, ~64 kB po gzipie.

Zawartość: 30 kategorii, 70 ćwiczeń, 132 warianty, 735 pozycji.

## Struktura

```
schemaVersion, generated
categories[]          kolejność wyświetlania = kolejność w tablicy
exercises[]           jeden skan = jedno ćwiczenie
  variants[]          zadania w obrębie ćwiczenia
    items[]           pojedyncze pozycje do losowania
duplicates[]          rejestr audytowy
nonTextMaterials[]    skany bez zadań
```

## Pola

### korzeń

| Pole | Typ | Opis |
|---|---|---|
| `schemaVersion` | string | wersja schematu; podbijana przy zmianie kształtu struktury |
| `generated` | string | rewizja treści: data wygenerowania lub eksportu (ISO 8601), uwzględniana w ziarnie |

### `categories[]`

| Pole | Typ | Opis |
|---|---|---|
| `id` | string | klucz techniczny, referowany przez `exercises[].categoryId` |
| `name` | string | nazwa czytelna dla użytkownika |

Kolejność kategorii wynika z ich kolejności w tablicy — nie ma osobnego pola pozycji.

### `exercises[]`

| Pole | Typ | Opis |
|---|---|---|
| `id` | string | unikalny w pliku, stabilny — nie zmieniać po wydaniu |
| `title` | string | tytuł = pierwsze zadanie na skanie |
| `categoryId` | string | FK do `categories[].id` |
| `phonemes` | string[] | głoski / grupy docelowe; `[]` gdy ćwiczenie nie jest głoskowe |
| `positions` | string[] | pozycja w wyrazie (nagłos / śródgłos / wygłos / …); `[]` gdy nie dotyczy |
| `level` | number \| null | poziom trudności 1–4 wg oryginału; `null` gdy źródło nie podaje |
| `randomizable` | boolean | `true` → wolno wybrać podzbiór pozycji; `false` → materiał podaje się w całości |
| `readQuality` | string | `"pewny"` albo `"do_weryfikacji"` — zaufanie do odczytu ze skanu |
| `source` | object | pochodzenie, do audytu i ponownej korekty |
| `source.file` | string | nazwa pliku skanu |
| `source.kind` | string | `"zdjecie"` albo `"pdf_kontener"` |
| `source.publication` | string \| null | autor i tytuł publikacji; `null` gdy nieustalone |
| `notes` | string \| null | uwagi redakcyjne: co ucięte, co pominięte, jak czytać zapis fonetyczny. Nie do pokazywania ćwiczącemu |
| `headerHtml` | string \| null | nagłówek strony z oryginału |
| `contextHtml` | string \| null | materiał towarzyszący, nie zadanie: opis układu artykulatorów, komentarz metodyczny. Do pokazania przed ćwiczeniem |
| `instructionHtml` | string \| null | polecenie wspólne dla całego ćwiczenia; wariant może je nadpisać |
| `variants` | object[] | zawsze co najmniej jeden |

### `exercises[].variants[]`

| Pole | Typ | Opis |
|---|---|---|
| `id` | string | unikalny w pliku, stabilny |
| `label` | string \| null | nagłówek wariantu; `null` gdy ćwiczenie jest jednowariantowe |
| `type` | string | decyduje o renderowaniu, patrz niżej |
| `instructionHtml` | string \| null | polecenie wariantu; `null` → użyj `exercises[].instructionHtml` |
| `syllablesHtml` | string \| null | wiersz sylab treningowych przed pozycjami; wyświetlany raz, nie losowany |
| `textHtml` | string \| null | treść dla `type: "text"`; akapity `<p>`, łamania wersów `<br>` |
| `noteHtml` | string \| null | komentarz metodyczny wariantu |
| `examples` | string[] | przykłady wzorcowe z oryginału — podpowiedź, **nie** losowane |
| `items` | object[] | pozycje do losowania; puste dla `text`, `syllables`, `prompt` |

Kolejność wariantów w ćwiczeniu wynika z ich kolejności w tablicy — nie ma osobnego pola pozycji.

#### wartości `type`

| Wartość | Ile | Renderowanie |
|---|---|---|
| `items` | 91 | lista niezależnych pozycji, z niej aplikacja losuje |
| `text` | 28 | tekst ciągły lub wierszowany, czytany w całości |
| `prompt` | 11 | samo polecenie, bez materiału do losowania (zadanie długoterminowe) |
| `syllables` | 2 | wiersz sylab treningowych |

### `exercises[].variants[].items[]`

| Pole | Typ | Opis |
|---|---|---|
| `id` | string | unikalny w pliku, stabilny |
| `html` | string | treść pozycji ze znacznikami |

### `duplicates[]`

Skany powielające inny materiał. Rejestr audytowy, nie ćwiczenia —
żeby nikt nie dodał ich powtórnie.

| Pole | Typ | Opis |
|---|---|---|
| `file` | string | nazwa pliku skanu |
| `duplicateOf` | string | nazwa pliku oryginału |
| `material` | string | opis powielonego materiału |

### `nonTextMaterials[]`

Skany bez zadań (np. schemat artykulacyjny) — kandydaci na ilustracje instruktażowe.

| Pole | Typ | Opis |
|---|---|---|
| `file` | string | nazwa pliku skanu |
| `content` | string | co przedstawia |
| `use` | string | proponowane zastosowanie w aplikacji |

## Znaczniki w treści HTML

Klasy niosą znaczenie, nie wygląd — CSS jest ich konsekwencją.
Sześć z ośmiu nie ma odpowiednika wśród standardowych tagów HTML.

| Klasa | Znaczenie | Sugerowany styl |
|---|---|---|
| `target` | głoska docelowa (pogrubienie w oryginale) | `font-weight: 700` |
| `legato` | samogłoska przedłużana w technice legato (podkreślenie) | `text-decoration: underline` |
| `phonetic` | zapis fonetyczny / ortofoniczny z oryginału | `font-style: italic` |
| `uncertain` | fragment ucięty lub nieczytelny na skanie | wyszarzenie, nawiasy |
| `breath` | miejsce wdechu (czerwone V w oryginale) | akcent kolorem |
| `exhale` | fraza realizowana na jednym wydechu | strzałka lub linia pod frazą |
| `blank` | miejsce na odpowiedź w oryginale (ćwiczący odpowiada ustnie) | linia lub kropki |
| `juncture` | granica zestroju akcentowego | cienka kreska pionowa |

Poza tym w treści występują `<p>`, `<br>`, `<strong>` (wyróżnienie typograficzne
w nagłówkach — **nie** głoska docelowa) oraz `<em>` (kursywa z oryginału).

### Zasady edytora

Pasek formatowania w podglądzie odwzorowuje każdą klasę z tabeli na przycisk i zapisuje
zaznaczenie jako `<span class="nazwa-klasy">…</span>`. Edytor dopuszcza wyłącznie wymienione
tagi i klasy oraz opisowy atrybut `title` na `span`. Usuwa puste znaczniki z wyjątkiem
samodzielnych oznaczeń `blank` i `exhale`; nie zmienia tekstu poza zaznaczeniem. Te same
reguły obowiązują podgląd na żywo i eksport pliku.

### Przełączanie warstw

Rozdzielenie `target` i `legato` daje trzy tryby wyświetlania jednego tekstu
bez trzymania trzech wersji treści:

```css
/* pełny  */ .target { font-weight: 700 } .legato { text-decoration: underline }
/* głoska */ .legato { text-decoration: none }
/* czysty */ .target { font-weight: inherit } .legato { text-decoration: none }
```

## Uwagi dla implementacji

**Brak pól redundantnych.** Plik nie zawiera ani liczników (`variants.length`, `items.length`
liczy aplikacja), ani pól pozycji — kolejność niesie sama tablica. Jedno i drugie mogłoby
rozjechać się z rzeczywistością po ręcznej edycji.

**Dziedziczenie polecenia.** `variants[].instructionHtml` równe `null` oznacza użycie
`exercises[].instructionHtml`; oba `null` — wariant bez polecenia.

**`randomizable` a `type`.** `randomizable` jest wskazówką na poziomie ćwiczenia;
rozstrzyga `variants[].type` — `text`, `syllables` i `prompt` nigdy się nie dzielą,
`items` zawsze można ciąć.

**Rozkład kategorii jest nierówny.** „Tekst do czytania terapeutycznego” obejmuje 23 z 70
ćwiczeń, „rozgrzewka” kolejnych 10, a 22 kategorie mają po jednym ćwiczeniu. Ważenie kategorii
nie zostało wprowadzone — steruje tym liczba ćwiczeń w parametrach, a w kategoriach obszerniejszych
także wybór i podział ćwiczeń na bloki (APPLICATION §3.2).

**Rozkład wariantów.** 42 z 70 ćwiczeń ma jeden wariant, pozostałe 2, 3, 4 albo 6. 27 ćwiczeń
nie ma w ogóle pozycji (same `text`, `syllables`, `prompt`), a 6 wariantów ma po jednej pozycji.

**Poziom trudności bywa nieokreślony.** 54 z 70 ćwiczeń ma `level: null`; poziomy 1–4 mają
kolejno 1, 3, 4 i 8 ćwiczeń. 35 ćwiczeń ma `randomizable: false`.

**Krańce parametrów sesji.** `W` i `P` (APPLICATION §3.4) liczone są osobno dla każdego
bloku, z jego własnych ćwiczeń. Rozpiętość przy blokach domyślnych, czyli po jednym na kategorię:

| | najwyżej | najniżej |
|---|---|---|
| maks. `W` | 6 — `sygmatyzm-miedzyzebowy-cwiczenia-ze-szpatulka`, `gloski-nosowe-wzmocnienie-naglosu` | 1 — 7 kategorii jednowariantowych |
| maks. `P` | 58 — `opozycje-fonologiczne` | 0 — 2 kategorie bez pozycji |

Maksimum 58 pochodzi z `opozycje-c-cz-w-jednym-wyrazie` (warianty 30 + 16 + 12 pozycji);
warianty bez pozycji nie wchodzą do rachunku `P`.

Kraniec równy 1 dla `W` albo 0 dla `P` oznacza blok, w którym nie ma czego ograniczać —
formularz nie pokazuje wtedy tego pola (APPLICATION §3.4). Bez pozycji są
`tekst-do-czytania-terapeutycznego` (23 ćwiczenia, same `text`) oraz
`terapia-miofunkcjonalna-polykanie` (`prompt`); ich materiał podawany jest w całości.

**Materiał do korekty.** 9 ćwiczeń ma `readQuality: "do_weryfikacji"`. Kolejnych 20 ma
w `notes` adnotację, że warstwa legato jest miejscami przybliżona; warstwa głoski docelowej
pozostaje wierna.

## Prawa autorskie

Materiał pochodzi z publikacji chronionych prawem autorskim: Wydawnictwo Harmonia /
SCTJ Wodzisław Śląski (seria „Teksty do czytania terapeutycznego”),
A. Walencik-Topiłko „Głos jako narzędzie”, ćwiczenia w konwencji B. Toczyskiej,
oraz materiał autorski terapeuty. Pliki są transkrypcją skanów właściciela projektu.
Przed udostępnieniem aplikacji poza użytek własny należy uregulować licencje.
