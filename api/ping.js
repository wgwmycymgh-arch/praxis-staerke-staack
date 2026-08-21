import { supabase } from './_lib/supabase.js';

// Wöchentlicher Cron-Aufruf. Supabase Free pausiert Projekte nach 7 Tagen ohne
// Zugriff und löscht sie danach — genau so ist die erste Datenbank verschwunden.
export default async function handler(req, res) {
  const { count, error } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true });
  if (error) {
    console.error('ping failed:', error.message);
    return res.status(500).json({ ok: false });
  }
  res.json({ ok: true, posts: count ?? 0 });
}
