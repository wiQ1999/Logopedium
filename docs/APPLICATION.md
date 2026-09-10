# Aplikacja — wymagania funkcjonalne

## 1. Przeznaczenie

Aplikacja układa i prowadzi sesję ćwiczeń logopedycznych na podstawie bazy zadań.
Użytkownik ustala parametry, zatwierdza je i przechodzi przez kolejne ćwiczenia.

Dwa niezależne tryby pracy:

- **Sesja** — zestaw ćwiczeń dobrany losowo na dany dzień.
- **Przeglądanie** — wgląd w całą bazę, bez losowania i ograniczeń.

---

## 2. Stany interfejsu

Aplikacja działa w jednym widoku, którego zawartość zmienia się w zależności od stanu.

| Stan | Zawartość |
|---|---|
| Parametry | konfiguracja kategorii, poziom trudności, start sesji |
| Ćwiczenie | pojedyncze ćwiczenie z instrukcją i nawigacją |
| Podsumowanie | zakończenie sesji |
| Lista bazy | wszystkie ćwiczenia, z wyszukiwaniem i filtrami |
| Podgląd ćwiczenia | pełna zawartość jednego ćwiczenia poza sesją |

---

## 3. Parametry sesji

### 3.1 Konfiguracja kategorii

Jedna lista obsługująca trzy funkcje jednocześnie:

- **aktywność** — włączenie lub wyłączenie kategorii z sesji,
- **liczba ćwiczeń** — ile ćwiczeń z danej kategorii trafi do sesji,
- **kolejność** — przestawianie pozycji na liście wyznacza kolejność w sesji.

Sterowanie liczbą ćwiczeń zamiast czasem sesji: czas wykonania pojedynczego ćwiczenia jest
zbyt trudny do oszacowania, by opierać na nim dobór materiału.

Zasady:

- Liczba ćwiczeń równa zero oznacza kategorię nieaktywną.
- Kategoria nieaktywna zachowuje pozycję na liście.
- Maksymalna dopuszczalna wartość to liczba ćwiczeń dostępnych w danej kategorii w bazie.
  Limit uwzględnia ustawiony poziom trudności i jest widoczny przy polu.
- Kategorie mogą być pomijane — sesja nie musi obejmować wszystkich kategorii z bazy.

### 3.2 Pozostałe parametry

| Parametr | Zachowanie |
|---|---|
| Poziom trudności | górny limit; ćwiczenia o wyższym poziomie są odrzucane |
| Data | wskazywana przez użytkownika, domyślnie bieżący dzień; podstawa losowania |

### 3.3 Wartości początkowe

Parametry startowe są zapisane na stałe w kodzie. Aplikacja nie zapamiętuje ustawień między
wizytami — każde otwarcie zaczyna od wartości domyślnych.

### 3.4 Zmiana parametrów

Zatwierdzenie parametrów tworzy nowy plan sesji i rozpoczyna ją od początku. Postęp
poprzedniej sesji nie jest przenoszony.

---

## 4. Dobór ćwiczeń

1. Odrzucenie ćwiczeń z kategorii nieaktywnych i przekraczających ustawiony poziom trudności.
2. Losowanie z każdej aktywnej kategorii tylu ćwiczeń, ile wskazano w parametrach.
3. Ułożenie wyniku zgodnie z kolejnością kategorii z listy parametrów.

W obrębie jednej sesji ćwiczenia nie powtarzają się — losowanie odbywa się bez zwracania.
Między dniami brak mechanizmu ograniczania powtórek: to samo ćwiczenie może wystąpić
w kolejnych sesjach.

---

## 5. Losowanie z ziarnem

### 5.1 Wymaganie

Zestaw ćwiczeń musi być powtarzalny w obrębie doby. Odświeżenie strony, powrót z innego
stanu ani zamknięcie przeglądarki nie mogą podmienić ćwiczeń w trakcie sesji. Ten sam dzień
i te same parametry dają zawsze ten sam plan.

### 5.2 Składniki ziarna

- wskazana data,
- wersja bazy,
- poziom trudności,
- zestaw aktywnych kategorii wraz z liczbą ćwiczeń.

Kolejność kategorii nie wchodzi do ziarna — przestawienie listy zmienia kolejność
wyświetlania, nie dobór materiału.

### 5.3 Nadpisanie ziarna

Aplikacja przyjmuje ziarno przekazane w adresie. Zastosowania: testy powtarzalności,
odtworzenie sesji z przeszłości, ponowne wylosowanie zestawu na bieżący dzień.

---

## 6. Przebieg sesji

### 6.1 Zasady wyświetlania

- Jedno ćwiczenie na raz.
- **Warianty tego samego ćwiczenia wyświetlane są razem**, na wspólnej karcie. Są to krótkie
  fragmenty należące do jednej instrukcji — rozbicie ich na osobne kroki oznaczałoby
  powtarzanie tej samej instrukcji i przerywanie ciągu wykonania.
- Ćwiczenia z tej samej kategorii nie są łączone — każde stanowi osobny krok.
- Przejście dalej wymaga kliknięcia przycisku. Brak automatycznego przewijania i odliczania
  czasu.
- Powrót do ćwiczenia poprzedniego jest możliwy.

### 6.2 Plan sesji

Plan to lista kroków, gdzie jeden krok odpowiada jednemu ćwiczeniu wraz z wylosowanym
zestawem jego wariantów. Plan powstaje raz, przy zatwierdzeniu parametrów, i nie zmienia się
w trakcie sesji.

### 6.3 Karta ćwiczenia

Zawiera nazwę kategorii, tytuł ćwiczenia, instrukcję wykonania, treść wariantów, wskaźnik
postępu oraz przyciski nawigacji.

### 6.4 Postęp

Miejsce w sesji jest zapamiętywane na czas jej trwania. Zmiana daty lub zatwierdzenie nowych
parametrów unieważnia postęp.

---

## 7. Przeglądanie bazy

Tryb niezależny od sesji, obejmujący całą zawartość bazy — bez losowania i bez filtrów
sesyjnych.

- lista wszystkich ćwiczeń, pogrupowana po kategoriach,
- podgląd pojedynczego ćwiczenia ze wszystkimi wariantami,
- wyszukiwanie tekstowe po tytule, instrukcji i treści,
- filtrowanie po kategorii i poziomie trudności,
- podgląd surowych danych ćwiczenia w postaci zapisanej w bazie, bez formatowania.
