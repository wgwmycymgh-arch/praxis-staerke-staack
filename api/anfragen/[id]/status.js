import { supabase, ANFRAGEN_TABLE } from '../../_lib/supabase.js';
import { guardAdmin } from '../../_lib/ratelimit.js';
import { text, serverError } from '../../_lib/validate.js';

const ALLOWED_ANFRAGE_STATUS = ['Neu', 'In Arbeit', 'Erledigt'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  if (!(await guardAdmin(req, res))) return;

  const status = text(req.body?.status);
  if (!ALLOWED_ANFRAGE_STATUS.includes(status)) {
    return res.status(400).json({ success: false, error: `status must be one of: ${ALLOWED_ANFRAGE_STATUS.join(', ')}` });
  }

  const { error } = await supabase.from(ANFRAGEN_TABLE).update({ status }).eq('id', req.query.id);
  if (error) return serverError(res, 'anfrage status:', error);
  res.json({ success: true });
}
