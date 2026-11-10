// Helpers for linking Bot 2 by QR code: drawing the code as an SVG (with the
// QR generator inside qrcode-terminal, already a dependency) and checking the
// password that protects the /pair page. A QR code links whichever WhatsApp
// account scans it, so the page that shows it must not be public.
import { createHash, timingSafeEqual } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const QRCode = require('qrcode-terminal/vendor/QRCode');
const { L } = require('qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel');

export function qrSvg(text, { cell = 8, quiet = 4 } = {}) {
  const qr = new QRCode(-1, L);
  qr.addData(String(text));
  qr.make();
  const count = qr.getModuleCount();
  const size = (count + quiet * 2) * cell;
  let squares = '';
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) {
        squares += `<rect x="${(col + quiet) * cell}" y="${(row + quiet) * cell}" width="${cell}" height="${cell}"/>`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="WhatsApp link QR code"><rect width="${size}" height="${size}" fill="#fff"/><g fill="#000">${squares}</g></svg>`;
}

const digest = value => createHash('sha256').update(String(value)).digest();

// True when an "Authorization: Basic …" header carries the expected password
// (any user name). Compares hashes, so the check takes the same time either way.
export function pairPasswordMatches(authorizationHeader, password) {
  const expected = String(password || '').trim();
  if (!expected) return false;
  const match = /^Basic\s+([A-Za-z0-9+/=]+)\s*$/i.exec(String(authorizationHeader || ''));
  if (!match) return false;
  const decoded = Buffer.from(match[1], 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  if (separator < 0) return false;
  return timingSafeEqual(digest(decoded.slice(separator + 1)), digest(expected));
}
