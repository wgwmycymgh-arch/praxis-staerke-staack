import { guardAdmin } from './_lib/ratelimit.js';

// Prüft nur, ob der Schlüssel stimmt. Der Client merkt sich ihn danach in der
// sessionStorage und schickt ihn bei jedem weiteren Aufruf mit.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  if (!(await guardAdmin(req, res))) return;
  res.json({ success: true });
}
