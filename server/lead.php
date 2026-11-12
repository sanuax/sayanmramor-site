<?php
// Заявки с сайта на почту (2026-11-12, владелец).
//
// Этот файл кладётся на хостинг старого сайта, рядом с его index.php:
//   https://sayanmramor.ru/lead.php
// Новый сайт (GitHub Pages) своего сервера не имеет; форма «Получить расчёт» (js/offer-form.js)
// шлёт сюда заявку, а этот файл отправляет её письмом через почту хостинга -- так же, как
// это делал старый сайт. Данные никуда за границу не уходят (политика конфиденциальности, п. 7.1).
//
// Что приходит (multipart/form-data): direction, name, phone, email, piece, picks, page,
// consent = '1', website (ловушка для ботов, должно быть пустым), attachment (файл
// клиента, необязательно), passport (PDF из калькулятора, необязательно).
// Ответ -- JSON: {"ok": true} или {"ok": false, "error": "..."}.

const TO = 'sayan-mramor@yandex.ru';
// Отправитель -- адрес на домене хостинга, иначе почта Яндекса примет письмо за подделку.
const FROM = 'noreply@sayanmramor.ru';
const ALLOWED_ORIGINS = ['https://sanuax.github.io', 'https://sayanmramor.ru', 'https://www.sayanmramor.ru'];
const MAX_FILE = 15 * 1024 * 1024;          // один файл, байт
const RATE_LIMIT = 5;                        // заявок с одного адреса
const RATE_WINDOW = 600;                     // за столько секунд

date_default_timezone_set('Europe/Moscow');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, ALLOWED_ORIGINS, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

function answer($code, $data) { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }
function field($key, $max = 500) {
    $v = isset($_POST[$key]) ? trim((string) $_POST[$key]) : '';
    $v = (string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v);   // не UTF-8 -- пусто
    return function_exists('mb_substr') ? mb_substr($v, 0, $max, 'UTF-8') : substr($v, 0, $max);
}
function oneLine($v) { return trim(preg_replace('/[\r\n]+/', ' ', $v)); }
function mimeWord($text) { return '=?UTF-8?B?' . base64_encode($text) . '?='; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') answer(405, ['ok' => false, 'error' => 'method']);
if (!in_array($origin, ALLOWED_ORIGINS, true)) answer(403, ['ok' => false, 'error' => 'origin']);
if (field('website') !== '') answer(200, ['ok' => true]);   // бот заполнил ловушку: молча «принято»

$direction = oneLine(field('direction', 120));
$name      = oneLine(field('name', 120));
$phone     = oneLine(field('phone', 40));
$email     = oneLine(field('email', 160));
$piece     = field('piece', 1500);
$picks     = oneLine(field('picks', 1000));
$page      = oneLine(field('page', 300));

$phoneOk = strlen(preg_replace('/\D/', '', $phone)) >= 10;
$emailOk = $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL);
if (!$phoneOk && !$emailOk) answer(422, ['ok' => false, 'error' => 'contact']);
if (field('consent') !== '1') answer(422, ['ok' => false, 'error' => 'consent']);

// Не больше RATE_LIMIT заявок с одного адреса за RATE_WINDOW секунд.
$ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
$stamps = sys_get_temp_dir() . '/sayan-lead-' . md5($ip);
$now = time();
$recent = array_filter(@file($stamps, FILE_IGNORE_NEW_LINES) ?: [], function ($t) use ($now) { return (int) $t > $now - RATE_WINDOW; });
if (count($recent) >= RATE_LIMIT) answer(429, ['ok' => false, 'error' => 'rate']);
$recent[] = $now;
@file_put_contents($stamps, implode("\n", $recent));

// Файлы: файл клиента и паспорт изделия из калькулятора.
$files = [];
foreach (['attachment' => 'Файл клиента', 'passport' => 'Паспорт изделия'] as $key => $label) {
    if (empty($_FILES[$key]) || $_FILES[$key]['error'] === UPLOAD_ERR_NO_FILE) continue;
    $f = $_FILES[$key];
    if ($f['error'] !== UPLOAD_ERR_OK || $f['size'] > MAX_FILE || !is_uploaded_file($f['tmp_name'])) {
        $files[] = ['skipped' => $label . ': не приложен (слишком большой или ошибка загрузки)'];
        continue;
    }
    $fileName = preg_replace('/[\r\n"\\\\\/]+/', '_', basename($f['name'])) ?: $key;
    $files[] = ['name' => $fileName, 'type' => $f['type'] ?: 'application/octet-stream', 'data' => file_get_contents($f['tmp_name']), 'label' => $label];
}

$lines = [
    'Заявка с сайта «Саянмрамор»',
    '',
    'Направление: ' . ($direction !== '' ? $direction : '-'),
    'Имя: ' . ($name !== '' ? $name : 'не указано'),
    'Телефон: ' . ($phone !== '' ? $phone : 'не указан'),
    'Почта: ' . ($email !== '' ? $email : 'не указана'),
];
if ($piece !== '') { $lines[] = ''; $lines[] = 'Изделие:'; $lines[] = $piece; }
if ($picks !== '') { $lines[] = ''; $lines[] = 'Подборка клиента: ' . $picks; }
foreach ($files as $f) {
    $lines[] = '';
    $lines[] = isset($f['skipped']) ? $f['skipped'] : $f['label'] . ': во вложении (' . $f['name'] . ')';
}
$lines[] = '';
$lines[] = 'Страница: ' . ($page !== '' ? $page : '-');
$lines[] = 'Отправлено: ' . date('d.m.Y H:i');
$text = implode("\r\n", $lines);

$subjectWho = $name !== '' ? $name : ($phone !== '' ? $phone : $email);
$subject = mimeWord('Заявка с сайта: ' . ($direction !== '' ? $direction : 'без направления') . ' - ' . $subjectWho);

$headers = [
    'From: ' . mimeWord('Сайт Саянмрамор') . ' <' . FROM . '>',
    'MIME-Version: 1.0',
];
if ($emailOk) $headers[] = 'Reply-To: ' . $email;   // «Ответить» в почте пишет клиенту

$attachments = array_filter($files, function ($f) { return !isset($f['skipped']); });
if (!$attachments) {
    $headers[] = 'Content-Type: text/plain; charset=UTF-8';
    $headers[] = 'Content-Transfer-Encoding: base64';
    $body = chunk_split(base64_encode($text));
} else {
    $boundary = 'sayan-' . bin2hex(random_bytes(12));
    $headers[] = 'Content-Type: multipart/mixed; boundary="' . $boundary . '"';
    $body = "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($text));
    foreach ($attachments as $f) {
        $body .= "--$boundary\r\nContent-Type: " . oneLine($f['type']) . '; name="' . mimeWord($f['name']) . "\"\r\n"
            . 'Content-Disposition: attachment; filename="' . mimeWord($f['name']) . "\"\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($f['data']));
    }
    $body .= "--$boundary--\r\n";
}

$sent = @mail(TO, $subject, $body, implode("\r\n", $headers), '-f' . FROM);
if (!$sent) answer(500, ['ok' => false, 'error' => 'mail']);
answer(200, ['ok' => true]);
