const express = require('express');
const axios = require('axios');
const session = require('express-session');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

const FRONTEND_URL = 'https://exositeweb.github.io';
const DASHBOARD_URL = 'https://exositeweb.github.io/exobot-website/dashboard.html';

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

    req.session.user = userRes.data;
    res.json({ success: true, user: userRes.data });

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'OAuth failed' });
  }
});

/* ================= API ================= */

app.get('/api/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json(req.session.user);
});

app.listen(PORT, () => {
  console.log('Backend running on port ' + PORT);
});
