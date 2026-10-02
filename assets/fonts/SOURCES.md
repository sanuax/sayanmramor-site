# Шрифты сайта — источники и проверка

Два шрифта, оба под лицензией SIL Open Font License 1.1 (тексты лицензий лежат рядом:
`LICENSE-source-serif-4.txt`, `LICENSE-golos-text.txt`). Подключены локально, без Google
Fonts CDN и без других внешних запросов.

| Роль | Шрифт | Файлы | Правообладатель |
|---|---|---|---|
| Заголовки (display) | Source Serif 4, переменный: `wght` 200–900, `opsz` 8–60 | `source-serif-4-cyrillic-opsz-normal.woff2`, `source-serif-4-latin-opsz-normal.woff2` | © 2014–2021 Adobe Systems Incorporated, Reserved Font Name «Source» |
| Текст и интерфейс | Golos Text, переменный: `wght` 400–900 | `golos-text-cyrillic-wght-normal.woff2`, `golos-text-latin-wght-normal.woff2`, `golos-text-latin-ext-wght-normal.woff2` | © 2019 The Golos Text Project Authors (ParaType) |

## Откуда файлы

Готовые подмножества (subsets) шрифтов Google Fonts в формате woff2 из пакетов Fontsource
версии 5.3.0 (`@fontsource-variable/source-serif-4`, `@fontsource-variable/golos-text`),
скачаны с `cdn.jsdelivr.net/npm/...@5.3.0/files/` 2026-10-01. Сами файлы не изменялись.
Диапазоны `unicode-range` в `css/site.css` — те же, что в `wght.css` / `opsz.css` этих пакетов.

## Что подключено и зачем

- `cyrillic` — весь русский алфавит, Ё/ё, №. Грузится на каждой странице (предзагрузка в `<head>`).
- `latin` — пробел, цифры, знаки препинания, кавычки «», тире –—, многоточие, латиница. Тоже
  нужен всегда: пробел и цифры лежат в этом подмножестве.
- `latin-ext` у Golos Text — знак рубля **₽** (U+20BD). Браузер скачивает его только там, где
  ₽ есть на странице (каталог готовых изделий).
- Не подключены: `cyrillic-ext`, `greek`, `vietnamese`, `latin-ext` у Source Serif 4 (в
  заголовках нет этих символов и ₽); курсив (не используется; `font-synthesis: none`).

## Проверка (по самим файлам, таблица `cmap` читалась из woff2)

| Символы | Source Serif 4 | Golos Text |
|---|---|---|
| А–Я, а–я | есть (cyrillic) | есть (cyrillic) |
| Ё U+0401, ё U+0451 | есть (cyrillic) | есть (cyrillic) |
| № U+2116 | есть (cyrillic) | есть (cyrillic) |
| « » U+00AB, U+00BB | есть (latin) | есть (latin) |
| — – „ " " … | есть (latin) | есть (latin) |
| 0–9, A–Z, a–z | есть (latin) | есть (latin) |
| ₽ U+20BD | есть, но только в latin-ext (файл не подключён) | есть в latin-ext (подключён) |

Начертания: Source Serif 4 — любой вес 200–900 и оптический размер 8–60 (браузер подбирает
`opsz` по размеру текста: у крупных заголовков тоньше и контрастнее, чем у мелкого текста);
Golos Text — 400–900. Используются 400–700.

## Размер

Критичное для первого экрана (cyrillic + latin обоих шрифтов): 93 440 + 122 360 + 22 032 +
37 916 = 275 748 байт; latin-ext Golos — ещё 19 180 байт, только при наличии ₽.

## SHA-256

```
e553fa829fd9ae0900931584f73c6b894539558b598d5ee7c4907140a1f29f05  source-serif-4-cyrillic-opsz-normal.woff2
f2ea9c12d2fe9bd3a9589b02ad2c0909da88f30938c91adc838c4f4098f9f9e0  source-serif-4-latin-opsz-normal.woff2
17d048ca05cb1218af3c0d6dcdf882989e6d1cc5dcb598ea50eaf54850ff7229  golos-text-cyrillic-wght-normal.woff2
9a69d0aa4734c4022224c002a3d944a702e0204972a49d892789f5668b922c2a  golos-text-latin-wght-normal.woff2
05befabe4813f41238ce6ea4f5ecd6b758591e9ef2f303a9932bff68ba66dc66  golos-text-latin-ext-wght-normal.woff2
```
