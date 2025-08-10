// api/server.js — serves api/public + SMTP mail with spam protection + auto-reply
require('dotenv').config();
const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = Number(process.env.PORT || 4000); // Standard: 4000 (lokal), Render nutzt eigenen PORT

// Healthcheck vor allem anderen
app.get('/healthz', (_req, res) => res.type('text').send('OK'));

// Static Frontend (liegt in api/public)
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.json({ limit: '100kb' }));
app.use(express.static(PUBLIC_DIR));
app.get('/', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// Nodemailer-Transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),         // 465 = SSL, 587 = STARTTLS
  secure: String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

// Optional testen
transporter.verify()
  .then(() => console.log('SMTP ready'))
  .catch(e => console.warn('SMTP verify failed:', e.message));

// leichtes Rate-Limit
const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQ = 5;
const hits = new Map(); // ip -> timestamps[]
function rateLimited(ip){
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  return list.length > MAX_REQ;
}

// Kontakt-Endpoint
app.post('/contact', async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
  if (rateLimited(ip)) return res.status(429).json({ ok:false, message:'Zu viele Anfragen. Bitte später erneut.' });

  const { name, email, msg, hp, ts } = req.body || {};

  // Honeypot muss leer sein
  if (hp) return res.json({ ok:true, message:'Danke!' });

  // Mindestzeit 3s
  const t = Number(ts);
  if (!Number.isFinite(t) || Date.now() - t < 3000 || Date.now() - t > 2*60*60*1000) {
    return res.status(400).json({ ok:false, message:'Ungültige Anfrage.' });
  }

  if (!name || !email || !msg) return res.status(400).json({ ok:false, message:'Bitte alle Felder ausfüllen.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ ok:false, message:'Bitte gültige E-Mail eingeben.' });

  const clean = s => String(s).replace(/[\r\n]/g, ' ').trim();
  try {
    // Mail an dich
    await transporter.sendMail({
      from: process.env.FROM_EMAIL || 'ccappitcho7@gmail.com',
      to: process.env.TO_EMAIL || 'ccappitcho7@gmail.com',
      replyTo: clean(email),
      subject: `Kontakt – ${clean(name)}`,
      text: `Name: ${clean(name)}\nE-Mail: ${clean(email)}\n\nNachricht:\n${msg}\n\nIP: ${ip}`,
      html: `<p><b>Name:</b> ${clean(name)}</p>
             <p><b>E-Mail:</b> ${clean(email)}</p>
             <p><b>Nachricht:</b><br>${String(msg).replace(/\n/g,'<br>')}</p>
             <hr><small>IP: ${ip}</small>`
    });

    // Auto-Reply an Absender
    await transporter.sendMail({
      to: email,
      from: process.env.FROM_EMAIL || 'ccappitcho7@gmail.com',
      subject: 'Danke für Ihre Anfrage – IT Service3',
      text: `Hallo ${name},

vielen Dank für Ihre Nachricht. Wir melden uns so schnell wie möglich.

Ihre Nachricht:
${msg}

Freundliche Grüße
IT Service3`,
      html: `<p>Hallo ${clean(name)},</p>
             <p>vielen Dank für Ihre Nachricht. Wir melden uns so schnell wie möglich.</p>
             <p><b>Ihre Nachricht:</b><br>${String(msg).replace(/\n/g,'<br>')}</p>
             <p>Freundliche Grüße<br>IT Service3</p>`
    });

    return res.json({ ok:true, message:'Danke! Ihre Nachricht wurde gesendet.' });
  } catch (err) {
    console.error('MAIL_ERROR:', err);
    return res.status(502).json({ ok:false, message:'Senden fehlgeschlagen – bitte später erneut.' });
  }
});

// Server starten
app.listen(PORT, '0.0.0.0', () => console.log(`Server läuft auf :${PORT}`));
