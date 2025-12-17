const express = require('express');
const axios = require('axios');
const cors = require('cors');
const session = require('express-session');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

/* ================= CONFIG ================= */

const FRONTEND_ORIGIN = 'https://exositeweb.github.io';
const REDIRECT_URI = 'https://exositeweb.github.io/exobot-website/dashboard.html';
const DISCORD_API = 'https://discord.com/api/v10';

/* ================= MIDDLEWARE ================= */

app.use(express.json());

app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true
}));

app.use(session({
  name: 'exobot.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    sameSite: 'none',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

function requireAuth(req, res, next) {
  if (!req.session.discord_token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

/* ================= AUTH ================= */

app.get('/auth/discord', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds'
  });

  res.json({
    authUrl: `https://discord.com/oauth2/authorize?${params.toString()}`
  });
});

app.post('/auth/callback', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'No code' });

    const tokenRes = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const token = tokenRes.data;

    const userRes = await axios.get(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });

    req.session.discord_token = token.access_token;
    req.session.discord_user = userRes.data;

    res.json({ success: true, user: userRes.data });

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'OAuth failed' });
  }
});

/* ================= API ================= */

app.get('/api/user', requireAuth, (req, res) => {
  res.json(req.session.discord_user);
});

app.get('/api/guilds', requireAuth, async (req, res) => {
  const r = await axios.get(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${req.session.discord_token}` }
  });

  res.json(r.data);
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

/* ================= START ================= */

app.listen(PORT, () => {
  console.log(`🚀 ExoBot backend running on port ${PORT}`);
});