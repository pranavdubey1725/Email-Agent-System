import express from 'express';
import { sendEmail } from '../services/emailService.js';

const router = express.Router();

// POST /api/send
// Body: { to, subject, body }
// Returns: { success: true, messageId }
router.post('/', async (req, res) => {
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
    const result = await sendEmail({ to, subject, body });
    res.json({ success: true, messageId: result.messageId });
  } catch (err) {
    console.error('Send error:', err.message);
    res.status(500).json({ error: 'Failed to send email. Please check your settings and try again.' });
  }
});

export default router;
