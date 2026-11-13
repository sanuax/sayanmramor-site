// tests/phone-field.test.js
//
// js/phone-field.js: the request form's phone field -- the countries, what a client types or
// pastes, what is said when a number is short (docs/superpowers/specs/2026-11-13-phone-field-design.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const P = require('../js/phone-field.js');
const shown = t => { const r = P.parse(t); return P.display(r.country, r.national) + ' ' + r.country.iso; };

test('parse: what a Russian client types or pastes', () => {
  assert.equal(shown('89991234567'), '+7 999 123 45 67 RU');
  assert.equal(shown('79991234567'), '+7 999 123 45 67 RU');
  assert.equal(shown('9991234567'), '+7 999 123 45 67 RU');
  assert.equal(shown('8 (812) 234-56-78'), '+7 812 234 56 78 RU');   // a city code stays
  assert.equal(shown('8122345678'), '+7 812 234 56 78 RU');
});

test('parse: autofill and other countries', () => {
  assert.equal(shown('+79991234567'), '+7 999 123 45 67 RU');
  assert.equal(shown('+7 (999) 123-45-67'), '+7 999 123 45 67 RU');
  assert.equal(shown('+77011234567'), '+7 701 123 45 67 KZ');
  assert.equal(shown('+375 29 123-45-67'), '+375 29 123 45 67 BY');
  assert.equal(shown('+90 532 123 45 67'), '+90 532 123 45 67 TR');
  assert.equal(shown('+1 201 555 0123'), '+1 201 555 0123 US');
});

test('parse: old drafts come back whole', () => {
  ['8 (999) 123-45-67', '+7 999 123-45-67', '+375291234567'].forEach(t => assert.equal(P.problemOf(t), '', t));
});

test('parse: an empty field is Russia with no number', () => {
  const r = P.parse('');
  assert.equal(r.country.iso, 'RU');
  assert.equal(r.national, '');
  assert.equal(P.display(r.country, r.national), '');
});

test('a number does not grow past its country', () => {
  assert.equal(P.clean(P.byIso.RU, '999123456789').national, '9991234567');
});

test('problem: how many digits are missing, in Russian', () => {
  assert.equal(P.problemOf('+7 999 12'), 'В номере не хватает 5 цифр.');
  assert.equal(P.problemOf('+7 999 123 45 6'), 'В номере не хватает 1 цифры.');
  assert.equal(P.problemOf('+7 999 123 4'), 'В номере не хватает 3 цифр.');
  assert.equal(P.problemOf(''), '');
});

test('countries: popular first, codes prefix-free, one entry per iso, +7 for Russia and Kazakhstan', () => {
  assert.deepEqual(P.POPULAR.map(c => c.iso), ['RU', 'KZ', 'BY', 'UZ', 'AM', 'KG', 'TJ', 'AZ', 'GE']);
  const codes = P.COUNTRIES.map(c => c.code);
  assert.ok(P.COUNTRIES.length >= 190, 'about two hundred countries, got ' + P.COUNTRIES.length);
  assert.equal(codes.filter(c => c === '7').length, 2);
  const unique = [...new Set(codes)];
  unique.forEach(a => unique.forEach(b => assert.ok(a === b || !b.startsWith(a), a + ' / ' + b)));
  assert.equal(new Set(P.COUNTRIES.map(c => c.iso)).size, P.COUNTRIES.length);
  P.COUNTRIES.forEach(c => assert.ok(!/—/.test(c.name), c.name));
  assert.deepEqual(P.ALL.map(c => c.name), P.ALL.map(c => c.name).slice().sort((a, b) => a.localeCompare(b, 'ru')));
});

test('skipSeparators: backspace right after a space deletes the digit before it', () => {
  const input = { value: '999 123', selectionStart: 4, selectionEnd: 4, setSelectionRange(a) { this.selectionStart = this.selectionEnd = a; } };
  const e = { inputType: 'deleteContentBackward', preventDefault() { this.prevented = true; } };
  assert.equal(P.skipSeparators(input, e), true);
  assert.equal(input.value, '99 123');
  assert.equal(input.selectionStart, 2);
  assert.ok(e.prevented);
});

test('the field and its country list exist, with their styles in site.css', () => {
  assert.equal(typeof P.mount, 'function');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'site.css'), 'utf8');
  ['.phf-country', '.phf-box:focus-within', '.pk.is-sheet', '.pk.is-pop', '.pk-row'].forEach(sel => assert.ok(css.includes(sel + ' '), sel));
  assert.match(css, /@media \(max-width: 560px\) \{ \.phf \{ --phf-h: 56px; \} \}/, 'a phone: 56 px, as the other fields');
  assert.match(css, /\.phf \{[^}]*--phf-h: 64px;/, 'a computer: 64 px, as the other fields');
  const block = phoneBlock(css);
  assert.doesNotMatch(block, /—/, 'no long dash');
  // A three-digit code (+375) or a long number (Germany, China) must fit the narrow answer column on a computer:
  // the field turns compact (js/phone-field.js toggles .is-compact for such a country).
  assert.match(block, /\.phf\.is-compact \.phf-input, \.phf\.is-compact \.phf-ghost \{ font-size: 17px;/);
  assert.match(block, /\.phf\.is-compact \.phf-country \{/);
  const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'phone-field.js'), 'utf8');
  assert.match(code, /classList\.toggle\('is-compact', country\.code\.length >= 3 \|\| Math\.max\(\.\.\.country\.lens\) >= 11\)/);
});

// The price filter (js/price-filter.js) owns the class names pf, pf-input, ... (2026-11-13: the first
// version of the phone field reused them and turned the price filter's inputs into 64 px dark boxes).
function phoneBlock(css) {
  const a = css.indexOf('/* ---- The phone:'), b = css.indexOf('/* ---- Footer');
  assert.ok(a > 0 && b > a, 'the phone block of site.css');
  return css.slice(a, b);
}
test('the phone field shares no class name with the price filter', () => {
  const filter = fs.readFileSync(path.join(__dirname, '..', 'js', 'price-filter.js'), 'utf8');
  const theirs = [...new Set([...filter.matchAll(/'(pf(?:-[a-z-]+)?)'/g)].map(m => m[1]))];
  assert.ok(theirs.includes('pf') && theirs.includes('pf-input'), 'the filter\'s classes are found: ' + theirs.join(' '));
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'site.css'), 'utf8');
  const mine = phoneBlock(css).replace(/\/\*[\s\S]*?\*\//g, '');
  theirs.forEach(c => assert.doesNotMatch(mine, new RegExp('\.' + c + '(?![\w-])'), 'the phone block styles .' + c));
  const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'phone-field.js'), 'utf8');
  theirs.forEach(c => assert.doesNotMatch(code, new RegExp('class="[^"]*\b' + c + '(?![\w-])'), 'phone-field.js makes .' + c));
});

test('reading: a plus typed by hand stays until it is a country code', () => {
  const RU = P.byIso.RU;
  assert.deepEqual(P.reading(RU, '+', 1, 'insertText'), { country: RU, national: '', caretDigits: 0, pending: '+' });
  assert.equal(P.reading(RU, '+3', 2, 'insertText').pending, '+3');
  assert.equal(P.reading(RU, '+37', 3, 'insertText').pending, '+37');
  const by = P.reading(RU, '+375', 4, 'insertText');
  assert.equal(by.country.iso, 'BY');
  assert.equal(by.national, '');
  assert.equal(by.pending, '');
  const full = P.reading(RU, '+375291234567', 13, 'insertText');
  assert.deepEqual([full.country.iso, full.national], ['BY', '291234567']);
});

test('reading: a number pasted with its plus replaces what stood in the field', () => {
  const RU = P.byIso.RU;
  const a = P.reading(RU, '12+375291234567', 15, 'insertFromPaste');
  assert.deepEqual([a.country.iso, a.national], ['BY', '291234567']);
  const b = P.reading(RU, '999+7 999 123 45 67', 19, 'insertFromPaste');
  assert.deepEqual([b.country.iso, b.national], ['RU', '9991234567']);
});

test('reading: autofill of a whole Russian number into another country follows the number, typing does not', () => {
  const BY = P.byIso.BY;
  const filled = P.reading(BY, '8 (999) 123-45-67', 17, 'insertReplacementText');
  assert.deepEqual([filled.country.iso, filled.national], ['RU', '9991234567']);
  const pasted = P.reading(BY, '89991234567', 11, 'insertFromPaste');
  assert.deepEqual([pasted.country.iso, pasted.national], ['RU', '9991234567']);
  const typed = P.reading(BY, '899912345', 9, 'insertText');
  assert.deepEqual([typed.country.iso, typed.national], ['BY', '899912345']);
  const short = P.reading(BY, '291234567', 9, 'insertFromPaste');
  assert.deepEqual([short.country.iso, short.national], ['BY', '291234567'], 'a number that fits the country stays in it');
});

test('reading: a Kazakh client typing the habit «8 7xx» stays in Kazakhstan, and a 77x number keeps its 7', () => {
  const KZ = P.byIso.KZ;
  assert.equal(P.clean(KZ, '87011234567').national, '7011234567');
  const mid = P.reading(KZ, '8701123456', 10, 'insertText');
  assert.deepEqual([mid.country.iso, mid.national], ['KZ', '701123456']);
  const x = P.reading(KZ, '7771234567', 10, 'insertText');
  assert.deepEqual([x.country.iso, x.national], ['KZ', '7771234567']);
  assert.equal(P.clean(P.byIso.RU, '8122345678').national, '8122345678', 'a St Petersburg number «812» keeps its 8');
});
