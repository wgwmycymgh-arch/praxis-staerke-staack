const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
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
  methods: ['POST'],
  allowedHeaders: ['Content-Type'],
}));

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Zu viele Anfragen. Bitte versuche es in 15 Minuten erneut.' },
  standardHeaders: true,
  legacyHeaders: false,
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

  console.log('Contact form submitted:', email.trim());
  res.json({ success: true });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
