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
  const { vorname, nachname, email, telefon, anliegen, nachricht } = req.body;

  if (!vorname || !nachname || !email || !nachricht) {
    return res.status(400).json({ error: 'Pflichtfelder fehlen: vorname, nachname, email, nachricht' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });
  }

  const { error } = await supabase
    .from(process.env.SUPABASE_TABLE || 'anfragen')
    .insert([{
      vorname: vorname.trim(),
      nachname: nachname.trim(),
      email: email.trim(),
      telefon: telefon ? telefon.trim() : null,
      anliegen: anliegen ? anliegen.trim() : null,
      nachricht: nachricht.trim(),
      status: 'Neu',
    }]);

  if (error) {
    console.error('Supabase insert error:', JSON.stringify(error));
    return res.status(500).json({ error: 'Interner Fehler. Bitte versuche es später erneut.' });
  }

  console.log('Contact form submitted');
  res.json({ success: true });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
