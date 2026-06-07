const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json());

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5500',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-Admin-Key'],
}));

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Zu viele Anfragen. Bitte versuche es in 15 Minuten erneut.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Zu viele Anfragen.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const ALLOWED_POST_TYPES = ['neuigkeit', 'urlaub', 'info'];

function isValidAdminKey(key) {
  const expected = process.env.ADMIN_KEY;
  if (!key || !expected || key.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(key), Buffer.from(expected));
}

app.get('/api/posts', async (req, res) => {
  const { data, error } = await supabase
    .from('posts')
    .select('id, type, title, content, date')
    .order('date', { ascending: false });
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, posts: data });
});

app.post('/api/auth', adminLimiter, (req, res) => {
  if (!isValidAdminKey(req.headers['x-admin-key'])) {
    return res.status(401).json({ success: false });
  }
  res.json({ success: true });
});

app.post('/api/posts', adminLimiter, async (req, res) => {
  if (!isValidAdminKey(req.headers['x-admin-key'])) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  const type = req.body.type?.trim();
  const title = req.body.title?.trim();
  const content = req.body.content?.trim();
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
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, post: data });
});

app.delete('/api/posts/:id', adminLimiter, async (req, res) => {
  if (!isValidAdminKey(req.headers['x-admin-key'])) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true });
});

app.post('/api/contact', contactLimiter, async (req, res) => {
  const { vorname, nachname, email, telefon, anliegen, nachricht, datenschutz } = req.body;

  if (!datenschutz) {
    return res.status(400).json({ error: 'Datenschutzzustimmung ist erforderlich.' });
  }

  if (!vorname || !nachname || !email || !nachricht) {
    return res.status(400).json({ error: 'Pflichtfelder fehlen: vorname, nachname, email, nachricht' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });
  }

  if (vorname.length > 100 || nachname.length > 100) {
    return res.status(400).json({ error: 'Name zu lang (max. 100 Zeichen).' });
  }
  if (email.length > 254) {
    return res.status(400).json({ error: 'E-Mail-Adresse zu lang.' });
  }
  if (telefon && telefon.length > 30) {
    return res.status(400).json({ error: 'Telefonnummer zu lang (max. 30 Zeichen).' });
  }
  if (anliegen && anliegen.length > 100) {
    return res.status(400).json({ error: 'Anliegen zu lang (max. 100 Zeichen).' });
  }
  if (nachricht.length > 2000) {
    return res.status(400).json({ error: 'Nachricht zu lang (max. 2000 Zeichen).' });
  }

  const strip = s => s.replace(/<[^>]*>/g, '').trim();

  const { error } = await supabase
    .from(process.env.SUPABASE_TABLE || 'anfragen')
    .insert([{
      vorname: strip(vorname),
      nachname: strip(nachname),
      email: email.trim().toLowerCase(),
      telefon: telefon ? strip(telefon) : null,
      anliegen: anliegen ? strip(anliegen) : null,
      nachricht: strip(nachricht),
      status: 'Neu',
    }]);

  if (error) {
    console.error('Supabase insert error:', JSON.stringify(error));
    return res.status(500).json({ error: 'Interner Fehler. Bitte versuche es später erneut.' });
  }

  console.log('Contact form submitted');
  res.json({ success: true });
});

app.post('/api/track', trackLimiter, async (req, res) => {
  const page = String(req.body.page || '').slice(0, 500);
  const referrer = String(req.body.referrer || '').slice(0, 500);
  if (!page) return res.status(400).json({ error: 'page required' });
  await supabase.from('pageviews').insert({ page, referrer });
  res.json({ ok: true });
});

app.get('/api/stats', adminLimiter, async (req, res) => {
  if (!isValidAdminKey(req.headers['x-admin-key'])) {
    return res.status(401).json({ success: false });
  }
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
  const monthStart = new Date(now); monthStart.setDate(now.getDate() - 30);

  const [totalRes, todayRes, weekRes, monthRes, pagesData, recentRes] = await Promise.all([
    supabase.from('pageviews').select('*', { count: 'exact', head: true }),
    supabase.from('pageviews').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
    supabase.from('pageviews').select('*', { count: 'exact', head: true }).gte('created_at', weekStart.toISOString()),
    supabase.from('pageviews').select('*', { count: 'exact', head: true }).gte('created_at', monthStart.toISOString()),
    supabase.from('pageviews').select('page').gte('created_at', monthStart.toISOString()),
    supabase.from('pageviews').select('page, referrer, created_at').order('created_at', { ascending: false }).limit(20),
  ]);

  const pageMap = {};
  (pagesData.data || []).forEach(r => { pageMap[r.page] = (pageMap[r.page] || 0) + 1; });
  const topPages = Object.entries(pageMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([page, count]) => ({ page, count }));

  res.json({
    success: true,
    today: todayRes.count || 0,
    week: weekRes.count || 0,
    month: monthRes.count || 0,
    total: totalRes.count || 0,
    topPages,
    recent: recentRes.data || [],
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
