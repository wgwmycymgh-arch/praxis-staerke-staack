import { supabase } from '../_lib/supabase.js';
import { guardAdmin } from '../_lib/ratelimit.js';
import { text, serverError } from '../_lib/validate.js';

const ALLOWED_POST_TYPES = ['neuigkeit', 'urlaub', 'info'];

export default async function handler(req, res) {
  if (req.method === 'GET') return listPosts(res);
  if (req.method === 'POST') return createPost(req, res);
  res.status(405).json({ success: false, error: 'Method not allowed' });
}

// Öffentlich: aktuelles.html rendert daraus die Beitragsliste.
async function listPosts(res) {
  const { data, error } = await supabase
    .from('posts')
    .select('id, type, title, content, date')
    .order('date', { ascending: false });
  if (error) return serverError(res, 'posts list:', error);
  res.json({ success: true, posts: data });
}

async function createPost(req, res) {
  if (!(await guardAdmin(req, res))) return;

  const type = text(req.body?.type);
  const title = text(req.body?.title);
  const content = text(req.body?.content);

  if (!type || !title || !content) {
    return res.status(400).json({ success: false, error: 'type, title, content required' });
  }
  if (!ALLOWED_POST_TYPES.includes(type)) {
    return res.status(400).json({ success: false, error: `type must be one of: ${ALLOWED_POST_TYPES.join(', ')}` });
  }
  if (title.length > 200) {
    return res.status(400).json({ success: false, error: 'title max 200 characters' });
  }
  if (content.length > 5000) {
    return res.status(400).json({ success: false, error: 'content max 5000 characters' });
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({ type, title, content })
    .select()
    .single();
  if (error) return serverError(res, 'post insert:', error);
  res.json({ success: true, post: data });
}
