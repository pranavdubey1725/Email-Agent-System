import express from 'express';
import { google } from 'googleapis';
import { createSession, getSession, deleteSession } from '../services/sessionStore.js';

const router = express.Router();

const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.send',
];

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// GET /auth/google — redirect the browser to Google's consent screen
router.get('/google', (req, res) => {
  const auth = getOAuth2Client();
  const url = auth.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // always show consent to get a fresh refresh_token
  });
  res.redirect(url);
});

// GET /auth/google/callback — Google redirects here with an auth code
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (error || !code) {
    return res.redirect(`${frontendUrl}?error=auth_cancelled`);
  }

  try {
    const auth = getOAuth2Client();
    const { tokens } = await auth.getToken(code);
    auth.setCredentials(tokens);

    // Fetch the user's basic profile
    const oauth2 = google.oauth2({ version: 'v2', auth });
    const { data: userInfo } = await oauth2.userinfo.get();

    const sessionId = createSession({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      email: userInfo.email,
      name: userInfo.name || userInfo.email,
    });

    res.redirect(`${frontendUrl}?session=${sessionId}`);
  } catch (err) {
    console.error('OAuth callback error:', err.message);
    const msg = encodeURIComponent(err.message || 'auth_failed');
    res.redirect(`${frontendUrl}?error=${msg}`);
  }
});

// GET /auth/me — returns the profile for the current session
router.get('/me', (req, res) => {
  const sessionId = req.headers['x-session-id'];
  const session = getSession(sessionId);

  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  res.json({ email: session.email, name: session.name });
});

// POST /auth/logout — destroys the session
router.post('/logout', (req, res) => {
  const sessionId = req.headers['x-session-id'];
  deleteSession(sessionId);
  res.json({ success: true });
});

export default router;
