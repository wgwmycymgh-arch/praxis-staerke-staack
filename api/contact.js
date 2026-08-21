import { supabase, ANFRAGEN_TABLE } from './_lib/supabase.js';
import { guardPublic } from './_lib/ratelimit.js';
import { text } from './_lib/validate.js';

const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'tafkac@icloud.com';
const MAIL_FROM = process.env.MAIL_FROM || 'Praxis Stärke & Staack <onboarding@resend.dev>';

async function sendAnfrageMail(a) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const body =
    `Neue Kontaktanfrage über die Website\n\n` +
    `Name:     ${a.vorname} ${a.nachname}\n` +
    `E-Mail:   ${a.email}\n` +
    `Telefon:  ${a.telefon || '—'}\n` +
    `Anliegen: ${a.anliegen || '—'}\n\n` +
    `Nachricht:\n${a.nachricht}\n`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: [NOTIFY_EMAIL],
      reply_to: a.email,
      subject: `Neue Anfrage: ${a.vorname} ${a.nachname}`,
      text: body,
    }),
  });
  if (!r.ok) console.error('Resend error:', r.status, await r.text());
}

const stripTags = s => s.replace(/<[^>]*>/g, '').trim();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await guardPublic(req, res, 'contact'))) return;

  if (!req.body?.datenschutz) {
    return res.status(400).json({ error: 'Datenschutzzustimmung ist erforderlich.' });
  }

  const vorname = text(req.body.vorname);
  const nachname = text(req.body.nachname);
  const email = text(req.body.email);
  const telefon = text(req.body.telefon);
  const anliegen = text(req.body.anliegen);
  const nachricht = text(req.body.nachricht);

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
  if (telefon.length > 30) {
    return res.status(400).json({ error: 'Telefonnummer zu lang (max. 30 Zeichen).' });
  }
  if (anliegen.length > 100) {
    return res.status(400).json({ error: 'Anliegen zu lang (max. 100 Zeichen).' });
  }
  if (nachricht.length > 2000) {
    return res.status(400).json({ error: 'Nachricht zu lang (max. 2000 Zeichen).' });
  }

  const row = {
    vorname: stripTags(vorname),
    nachname: stripTags(nachname),
    email: email.toLowerCase(),
    telefon: telefon ? stripTags(telefon) : null,
    anliegen: anliegen ? stripTags(anliegen) : null,
    nachricht: stripTags(nachricht),
    status: 'Neu',
  };

  const { error } = await supabase.from(ANFRAGEN_TABLE).insert([row]);
  if (error) {
    console.error('Supabase insert error:', error.message);
    return res.status(500).json({ error: 'Interner Fehler. Bitte versuche es später erneut.' });
  }

  // Muss awaited werden: Vercel friert die Function nach der Antwort ein, ein
  // fire-and-forget Promise liefe nie zu Ende. Die Anfrage steht schon in der
  // DB — ein Mail-Fehler darf den Patienten deshalb nicht erreichen.
  try {
    await sendAnfrageMail(row);
  } catch (e) {
    console.error('Mail send failed:', e.message);
  }

  res.json({ success: true });
}
