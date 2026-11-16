# Переезд сайта на свой домен sayanmramor.ru

Сайт и конфигуратор переезжают с GitHub Pages (https://sanuax.github.io/sayanmramor-site/)
на хостинг reg.ru, где был старый сайт на Bitrix. Сайт открывается с корня домена,
конфигуратор открывается по адресу https://sayanmramor.ru/studio/.

## Как устроено

- Исходники не меняются, адреса GitHub Pages в них остаются. `scripts/build_domain.js`
  делает копию для домена:
  - переписывает адреса: `/sayanmramor-site/` → `/`, `/sayanmramor-calculator/…html` → `/studio/`;
  - убирает `noindex` тестового хостинга и ставит `canonical`;
  - добавляет `robots.txt`, `sitemap.xml`, `.htaccess` (из `deploy/htaccess`), `lead.php`,
    файл подтверждения Яндекса и `/favicon.ico`.
  - `deploy/` и `server/lead.php` берёт из этой папки, а не с GitHub: они нужны только хостингу.
- Защита:
  - в `.htaccess`: HSTS, запрет показа сайта в чужих рамках (X-Frame-Options,
    frame-ancestors), Permissions-Policy (камера и XR открыты для AR конфигуратора);
  - в `lead.php`: не больше 5 заявок с одного адреса за 10 минут и 30 со всех адресов
    за час.
- `scripts/deploy_regru.sh` берёт то, что ОПУБЛИКОВАНО на GitHub (сайт `origin/master`,
  конфигуратор `origin/rate-catalog-subcategories`), собирает это, загружает рядом с живой
  папкой и меняет папки местами.
  - `--build`: только собрать в `dist-domain/` и ничего не загружать.
  - `--rollback`: вернуть предыдущую версию.
- Доступ: SSH `u1248418@server93.hosting.reg.ru`, ключ `~/.ssh/sayanmramor_regru`. На этом
  аккаунте лежат и другие сайты владельца: трогать только `www/sayanmramor.ru*`.
- `.htaccess` делает следующее:
  - https и адрес без www;
  - 301 со старых разделов Bitrix (`/izdeliya-iz-kamnya/…`, `/catalog/…`, `/products/…`,
    `/contacts/`, `/qr/`…) на новые страницы;
  - кэш: HTML и JSON всегда свежие; CSS и JS с `?v=` хранятся год; фото хранятся месяц.

Публикация после переезда: как и раньше, сначала push на GitHub, затем
`bash scripts/deploy_regru.sh`.

## Сделано

- 2026-11-16: старый сайт сохранён в `D:\sayanmramor-old-site\` (файлы 16 ГБ + база,
  сверены с сервером). Поддомены bx. и modx. сохранены там же и удалены с хостинга.
- 2026-11-16: ПЕРЕЕЗД. Новый сайт работает на https://sayanmramor.ru, конфигуратор на /studio/.
  Bitrix лежит в `www/sayanmramor.ru.bitrix-old`.
  - Проверено: все страницы; заголовки; 301 со старых адресов; 404; `lead.php` (отказы
    без контакта, чужой сайт, ловушка, CORS); карта Яндекса; конфигуратор.
  - Веб-PHP 8.4 принимает файлы до 128 МБ.
  - Загрузка целиком занимает около 10 минут.

## В день переезда

1. `bash scripts/deploy_regru.sh`. Старый Bitrix уедет в `www/sayanmramor.ru.bitrix-old`.
2. Проверить на домене:
   - страницы, конфигуратор, шоурум, окно камня;
   - отправку заявки;
   - 301 со старых адресов;
   - `robots.txt` и `sitemap.xml`.
3. После проверки удалить `www/sayanmramor.ru.bitrix-old` и базу `u1248418_snmr21`. Их копия
   уже на компьютере.
4. **Копия на GitHub Pages.** Поставить с неё переадресацию на домен или выключить Pages,
   чтобы в поиске не было двух одинаковых сайтов.
5. **Яндекс.Вебмастер и Google Search Console.**
   - Сайт в Вебмастере уже подтверждён файлом `yandex_44acc4318d434144.html`, он перенесён.
   - Отправить `https://sayanmramor.ru/sitemap.xml`.
   - Посмотреть «Страницы в поиске» и при необходимости дополнить переадресации в
     `deploy/htaccess`.
6. **Карточки организации.** Адрес сайта в Яндекс Бизнесе (Яндекс.Картах), 2ГИС и ВКонтакте.
7. **Парсер камней** (`scripts/scrape_slabs.py` конфигуратора, Playwright) работает на
   компьютере владельца. После обновления данных нужен push конфигуратора, затем
   `bash scripts/deploy_regru.sh`.
