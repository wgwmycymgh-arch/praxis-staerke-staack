import { supabase } from './supabase.js';
import { clientIp, isValidAdminKey } from './auth.js';

// Login streng (Brute-Force-Schutz), alles Authentifizierte großzügig —
// sonst sperrt sich die Praxis beim normalen Arbeiten selbst aus.
const LIMITS = {
  auth: { max: 10, window: 15 * 60 },
  admin: { max: 200, window: 15 * 60 },
  contact: { max: 5, window: 15 * 60 },
};

// Serverless-Instanzen teilen keinen Speicher, deshalb zählt Postgres.
// check_rate_limit() ist atomar (INSERT ... ON CONFLICT DO UPDATE RETURNING).
async function allow(req, bucket) {
  const { max, window } = LIMITS[bucket];
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_key: `${bucket}:${clientIp(req)}`,
    p_max: max,
    p_window_seconds: window,
  });
  // Ein kaputter Zähler darf die Praxis nicht aussperren: im Zweifel durchlassen.
  if (error) {
    console.error('rate limit check failed:', error.message);
    return true;
  }
  return data === true;
}

function tooMany(res) {
  res.status(429).json({ success: false, error: 'Zu viele Anfragen. Bitte in 15 Minuten erneut versuchen.' });
  return false;
}

// Ein einziger Türsteher für alle Admin-Routen. Fehlversuche zählen gegen den
// strengen auth-Zähler — sonst könnte man den Schlüssel über /api/posts oder
// /api/anfragen unbegrenzt durchprobieren und /api/auth einfach umgehen.
export async function guardAdmin(req, res) {
  if (!isValidAdminKey(req.headers['x-admin-key'])) {
    if (!(await allow(req, 'auth'))) return tooMany(res);
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return false;
  }
  if (!(await allow(req, 'admin'))) return tooMany(res);
  return true;
}

// Für offene Routen (Kontaktformular, Login-Endpunkt).
export async function guardPublic(req, res, bucket) {
  if (!(await allow(req, bucket))) return tooMany(res);
  return true;
}
