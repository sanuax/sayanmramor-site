# sayanmramor-site

Каталог продукции sayanmramor — отдельный статический сайт (без сборки,
без фреймворка), будущий поддомен основного сайта. Дизайн:
`docs/superpowers/specs/2026-09-16-sayanmramor-catalog-site-design.md`.

## Важно: этот сайт читает данные из D:\calculator

Этот проект не хранит данные о камне и не дублирует формулу цены — он
загружает `pricing.js`, `material-picker.js`, `product-types.js` и
`data/slabs.json` напрямую из `D:\calculator` (соседний проект,
который этот репозиторий никогда не изменяет).

## Локальный запуск

Поднимите один сервер из `D:\` (родитель и `calculator`, и
`sayanmramor-site`):

```
cd D:\
python -m http.server 8000
```

Откройте `http://localhost:8000/sayanmramor-site/index.html`.

Пути вида `/calculator/data/slabs.json` и
`/sayanmramor-site/css/site.css` работают только при таком запуске —
открытие файлов напрямую (`file://`) не работает, потому что `fetch()`
данных о камне требует http(s).

## `<base href="/calculator/">` на страницах категорий

Каждая страница `categories/*.html` подключает `material-picker.js` из
`D:\calculator` без изменений. Этот файл сам строит путь к картинке
камня как `'data/' + stone.image` — относительный путь, который
браузер обычно резолвил бы относительно адреса ТЕКУЩЕЙ страницы (то
есть `/sayanmramor-site/categories/...`), а не относительно
`/calculator/`. Тег `<base href="/calculator/">` в `<head>` каждой
такой страницы чинит это, не трогая `material-picker.js`. Из-за этого
на страницах категорий все ссылки/скрипты/стили, принадлежащие ЭТОМУ
проекту, обязаны быть абсолютными (`/sayanmramor-site/...`) — просто
`css/site.css` или `js/site.js` резолвился бы в `/calculator/css/...`
и не нашёлся бы. Не убирайте `<base>` и не меняйте абсолютные пути на
относительные на этих страницах.

## Тесты

```
node --test tests/site.test.js tests/category-calculator.test.js tests/catalog.test.js
```

Эти тесты используют реальные `D:\calculator\pricing.js` и
`D:\calculator\product-types.js` (через `require('../../calculator/...')`),
чтобы гарантировать, что урезанный калькулятор считает так же, как
основной.

## Готовые изделия и примеры работ

`data/products.json` и `data/portfolio.json` — обычные JSON-файлы,
правятся вручную текстовым редактором (формат описан в спеке).
