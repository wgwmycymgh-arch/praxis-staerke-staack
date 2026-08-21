// Temporaer. Wie health.js, aber MIT dem Supabase-Import — zeigt, ob der
// Paket-Import selbst der Ausloeser ist.
import { createClient } from '@supabase/supabase-js';

export default function handler(req, res) {
  res.json({ ok: true, supabaseImport: typeof createClient });
}
