const express = require('express');
const axios = require('axios');
const session = require('express-session');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

/* ================= CONFIG ================= */

const FRONTEND_URL = 'https://exositeweb.github.io';
const DASHBOARD_URL = 'https://exositeweb.github.io/exobot-website/dashboard.html';
const DATA_DIR = path.join(__dirname, 'data', 'guilds');

/* ================= PREP ================= */

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

app.use(express.json());

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));

app.use(session({
  name: 'exobot.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    sameSite: 'none'
  }
}));

/* ================= AUTH ================= */

app.get('/auth/discord', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: DASHBOARD_URL,
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

    const tokenRes = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DASHBOARD_URL
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const userRes = await axios.get(
      'https://discord.com/api/users/@me',
      { headers: { Authorization: `Bearer ${tokenRes.data.access_token}` } }
    );

    req.session.user = {
      ...userRes.data,
      accessToken: tokenRes.data.access_token
    };

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'OAuth failed' });
  }
});

/* ================= HELPERS ================= */

async function getBotGuilds() {
  const res = await axios.get(
    'https://discord.com/api/v10/users/@me/guilds',
    { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } }
  );
  return res.data.map(g => g.id);
}

function getSettings(guildId) {
  const file = path.join(DATA_DIR, `${guildId}.json`);
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file));
}

function saveSettings(guildId, settings) {
  const file = path.join(DATA_DIR, `${guildId}.json`);
  fs.writeFileSync(file, JSON.stringify(settings, null, 2));
}

/* ================= API ================= */

app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({});
  res.json(req.session.user);
});

app.get('/api/guilds', async (req, res) => {
  if (!req.session.user) return res.status(401).json([]);

  const userGuilds = await axios.get(
    'https://discord.com/api/users/@me/guilds',
    { headers: { Authorization: `Bearer ${req.session.user.accessToken}` } }
  ).then(r => r.data);

  const botGuilds = await getBotGuilds();

  const filtered = userGuilds.filter(g =>
    (g.permissions & 0x20) === 0x20 &&
    botGuilds.includes(g.id)
  );

  res.json(filtered);
});

app.get('/api/settings/:guildId', (req, res) => {
  res.json(getSettings(req.params.guildId));
});

app.post('/api/settings/:guildId', (req, res) => {
  saveSettings(req.params.guildId, req.body);
  res.json({ success: true });
});

/* ================= START ================= */

app.listen(PORT, () => {
  console.log('Backend running on port ' + PORT);
});
