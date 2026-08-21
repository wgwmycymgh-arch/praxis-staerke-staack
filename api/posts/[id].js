import { supabase } from '../_lib/supabase.js';
import { guardAdmin } from '../_lib/ratelimit.js';
import { serverError } from '../_lib/validate.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  if (!(await guardAdmin(req, res))) return;

  const { error } = await supabase.from('posts').delete().eq('id', req.query.id);
  if (error) return serverError(res, 'post delete:', error);
  res.json({ success: true });
}
