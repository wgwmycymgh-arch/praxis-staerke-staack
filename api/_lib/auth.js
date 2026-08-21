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

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}
