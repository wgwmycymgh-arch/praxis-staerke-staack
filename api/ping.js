import { supabase } from './_lib/supabase.js';

// Täglicher Cron (vercel.json). Zwei Aufgaben:
// 1. Supabase Free pausiert Projekte nach 7 Tagen ohne Zugriff und löscht sie
//    danach — genau so ist die erste Datenbank verschwunden.
// 2. Abgelaufene Rate-Limit-Zeilen wegräumen, sonst wächst die Tabelle ewig.
export default async function handler(req, res) {
  const { count, error } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true });
  if (error) {
    console.error('ping failed:', error.message);
    return res.status(500).json({ ok: false });
  }

  const { data: pruned, error: pruneError } = await supabase.rpc('prune_rate_limits');
  if (pruneError) console.error('prune failed:', pruneError.message);

  res.json({ ok: true, posts: count ?? 0, pruned: pruned ?? null });
}
