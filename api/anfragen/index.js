import { supabase, ANFRAGEN_TABLE } from '../_lib/supabase.js';
import { guardAdmin } from '../_lib/ratelimit.js';
import { serverError } from '../_lib/validate.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  if (!(await guardAdmin(req, res))) return;

  const { data, error } = await supabase
    .from(ANFRAGEN_TABLE)
    .select('id, vorname, nachname, email, telefon, anliegen, nachricht, status, created_at')
    .order('created_at', { ascending: false });
  if (error) return serverError(res, 'anfragen list:', error);
  res.json({ success: true, anfragen: data });
}
