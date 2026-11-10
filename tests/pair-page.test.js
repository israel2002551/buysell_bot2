import assert from 'node:assert/strict';
import test from 'node:test';
import { pairPasswordMatches, qrSvg } from '../pair-page.js';

const basic = (user, password) => `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;

test('a WhatsApp-sized link code draws as a square SVG QR code', () => {
  const svg = qrSvg(`2@${'A'.repeat(60)},${'B'.repeat(44)},${'C'.repeat(44)},${'D'.repeat(24)}`);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="(\d+)" height="\1"/);
  assert.ok((svg.match(/<rect /g) || []).length > 500, 'has the dark squares of a real code');
});

test('the /pair password is checked from the browser login, any user name', () => {
  assert.equal(pairPasswordMatches(basic('admin', 's3cret-pass'), 's3cret-pass'), true);
  assert.equal(pairPasswordMatches(basic('anything', 's3cret-pass'), 's3cret-pass'), true);
  assert.equal(pairPasswordMatches(basic('admin', 'wrong'), 's3cret-pass'), false);
  assert.equal(pairPasswordMatches(basic('admin', 's3cret-pass:extra'), 's3cret-pass'), false);
});

test('no password set, no header, or a malformed header never opens the page', () => {
  assert.equal(pairPasswordMatches(basic('admin', ''), ''), false);
  assert.equal(pairPasswordMatches('', 's3cret-pass'), false);
  assert.equal(pairPasswordMatches('Bearer s3cret-pass', 's3cret-pass'), false);
  assert.equal(pairPasswordMatches(`Basic ${Buffer.from('no-colon').toString('base64')}`, 's3cret-pass'), false);
});
