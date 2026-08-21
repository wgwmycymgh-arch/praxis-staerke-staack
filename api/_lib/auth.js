import crypto from 'node:crypto';

// HMAC beider Seiten erzwingt gleiche Länge, damit timingSafeEqual nicht wirft
// und die Schlüssellänge nicht über die Laufzeit verraten wird.
export function isValidAdminKey(key) {
  const expected = process.env.ADMIN_KEY || '';
  if (!expected) return false;
  const given = typeof key === 'string' ? key : '';
  const ha = crypto.createHmac('sha256', 'praxis-key-check').update(given).digest();
  const hb = crypto.createHmac('sha256', 'praxis-key-check').update(expected).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function header(req, name) {
  const v = req.headers[name];
  return typeof v === 'string' && v ? v.split(',')[0].trim() : '';
}

// Nur Header nehmen, die Vercels Proxy selbst setzt und dabei überschreibt.
// x-forwarded-for ist absichtlich NICHT dabei: die darf jeder Client frei
// mitschicken. Wer sie pro Anfrage variiert, bekommt sonst jedes Mal einen
// frischen Rate-Limit-Zähler und kann den Admin-Schlüssel unbegrenzt
// durchprobieren — die Sperre in guardAdmin() wäre wirkungslos.
export function clientIp(req) {
  return header(req, 'x-vercel-forwarded-for')
    || header(req, 'x-real-ip')
    || req.socket?.remoteAddress
    || 'unknown';
}
