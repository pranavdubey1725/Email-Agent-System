import express from 'express';
import { getSession } from '../services/sessionStore.js';
import { sendEmailViaGmail } from '../services/gmailService.js';

const router = express.Router();

// POST /api/send
// Headers: X-Session-Id: <session id from OAuth flow>
// Body: { to, subject, body }
// Returns: { success: true, messageId }
router.post('/', async (req, res) => {
  // Auth check
  const sessionId = req.headers['x-session-id'];
  const session = getSession(sessionId);

  if (!session) {
    return res.status(401).json({ error: 'Not signed in. Please sign in with Google first.' });
  }

  const { to, subject, body } = req.body;

  // Basic validation
  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'to, subject, and body are all required.' });
  }

  // Simple email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    return res.status(400).json({ error: `"${to}" doesn't look like a valid email address.` });
  }

  try {
    const messageId = await sendEmailViaGmail({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      senderName: session.name,
      senderEmail: session.email,
      to,
      subject,
      body,
    });
    res.json({ success: true, messageId });
  } catch (err) {
    console.error('Send error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to send email. Please try again.' });
  }
});

export default router;
