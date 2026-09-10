# Schemat pliku `cwiczenia-logopedyczne.json`

Statyczna baza danych dla aplikacji SPA. Jeden plik, wczytywany raz przy starcie.
Wersja schematu: **1.0**

## Rozmiary

| Plik | Rozmiar | Zastosowanie |
|---|---|---|
| `cwiczenia-logopedyczne.json` | ~486 kB | wersja czytelna, do przeglądania i edycji |
| `cwiczenia-logopedyczne.min.json` | ~425 kB | produkcja |
| po gzipie | ~53 kB | faktyczny transfer, przy `Content-Encoding: gzip` |

## Struktura

```
schemaVersion, generated
categories[]          kolejność wyświetlania (order)
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
| `generated` | string | data wygenerowania (ISO 8601), przydatna do cache-bustingu |

### `categories[]`

Kolejność kategorii w sesji jest stała. Ćwiczenia z tej samej kategorii
wyświetlane są obok siebie.

| Pole | Typ | Opis |
|---|---|---|
| `id` | string | klucz techniczny, referowany przez `exercises[].categoryId` |
| `name` | string | nazwa czytelna dla użytkownika |
| `order` | number | pozycja w sesji, unikalna, od 1; niższa = wcześniej |

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
| `order` | number | kolejność w obrębie ćwiczenia, od 1 |
| `type` | string | decyduje o renderowaniu, patrz niżej |
| `instructionHtml` | string \| null | polecenie wariantu; `null` → użyj `exercises[].instructionHtml` |
| `syllablesHtml` | string \| null | wiersz sylab treningowych przed pozycjami; wyświetlany raz, nie losowany |
| `textHtml` | string \| null | treść dla `type: "text"`; akapity `<p>`, łamania wersów `<br>` |
| `noteHtml` | string \| null | komentarz metodyczny wariantu |
| `examples` | string[] | przykłady wzorcowe z oryginału — podpowiedź, **nie** losowane |
| `items` | object[] | pozycje do losowania; puste dla `text`, `syllables`, `prompt` |

#### wartości `type`

| Wartość | Ile | Renderowanie |
|---|---|---|
| `items` | 64 | lista niezależnych pozycji, z niej aplikacja losuje |
| `text` | 28 | tekst ciągły lub wierszowany, czytany w całości |
| `syllables` | 2 | wiersz sylab treningowych |
| `prompt` | 3 | samo polecenie, bez materiału do losowania (zadanie długoterminowe) |

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

### Przełączanie warstw

Rozdzielenie `target` i `legato` daje trzy tryby wyświetlania jednego tekstu
bez trzymania trzech wersji treści:

```css
/* pełny  */ .target { font-weight: 700 } .legato { text-decoration: underline }
/* głoska */ .legato { text-decoration: none }
/* czysty */ .target { font-weight: inherit } .legato { text-decoration: none }
```

## Uwagi dla implementacji

**Liczniki.** Plik nie zawiera żadnych pól z liczbą elementów — aplikacja liczy
je sama (`variants.length`, `items.length`). Licznik zapisany w danych mógłby
rozjechać się z rzeczywistością po ręcznej edycji.

**Dziedziczenie polecenia.** Gdy `variants[].instructionHtml` jest `null`,
użyj `exercises[].instructionHtml`. Gdy oba są `null`, wariant nie ma polecenia.

**Rozkład kategorii jest nierówny.** Kategoria „tekst do czytania terapeutycznego"
obejmuje 23 z 54 ćwiczeń. Przy losowaniu po jednym z kategorii zdominuje sesję —
rozważ rozbicie jej po głosce docelowej albo ważenie.

**`randomizable` a `type`.** Pole `randomizable` jest wskazówką na poziomie
ćwiczenia; rozstrzygający jest `variants[].type` — `text` nigdy się nie dzieli,
`items` zawsze można ciąć.

**Materiał do korekty.** 12 ćwiczeń ma `readQuality: "do_weryfikacji"` (skan
ucięty albo gęsty zapis półfonetyczny). Dodatkowo 10 ćwiczeń ma w `notes`
adnotację, że warstwa legato jest miejscami przybliżona — warstwa głoski
docelowej pozostaje w nich wierna.

## Prawa autorskie

Materiał pochodzi z publikacji chronionych prawem autorskim: Wydawnictwo Harmonia /
SCTJ Wodzisław Śląski (seria „Teksty do czytania terapeutycznego"),
A. Walencik-Topiłko „Głos jako narzędzie", ćwiczenia w konwencji B. Toczyskiej,
oraz materiał autorski terapeuty. Pliki są transkrypcją skanów właściciela projektu.
Przed udostępnieniem aplikacji poza użytek własny należy uregulować licencje.
