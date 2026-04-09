import express from 'express';
import { parseEmailIntent } from '../services/openaiService.js';

const router = express.Router();

// POST /api/parse
// Body: { message: "send an email to john@example.com about the meeting" }
// Returns: { to, subject, body }
router.post('/', async (req, res) => {
  const { message, tone = 'raw' } = req.body;

  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message is required.' });
  }

  const validTones = ['raw', 'formal', 'friendly', 'concise'];
  if (!validTones.includes(tone)) {
    return res.status(400).json({ error: `Invalid tone "${tone}". Must be one of: ${validTones.join(', ')}.` });
  }

  try {
    const parsed = await parseEmailIntent(message, tone);
    res.json(parsed);
  } catch (err) {
    console.error('Parse error:', err.message);

    // OpenAI quota / billing
    if (err.status === 429 || err.message?.includes('quota') || err.message?.includes('billing')) {
      return res.status(500).json({
        error: 'OpenAI quota exceeded — no API credits remaining. Add credits at platform.openai.com/settings/billing.',
      });
    }

    // Bad API key
    if (err.status === 401 || err.message?.includes('API key') || err.message?.includes('Incorrect API key')) {
      return res.status(500).json({
        error: 'Invalid OpenAI API key. Check OPENAI_API_KEY in your server/.env file.',
      });
    }

    // Request timed out
    if (err.code === 'ETIMEDOUT' || err.message?.includes('timed out') || err.message?.includes('timeout')) {
      return res.status(500).json({
        error: 'The AI took too long to respond. Please try again.',
      });
    }

    // OpenAI service is down
    if (err.status >= 500) {
      return res.status(500).json({
        error: 'OpenAI is currently unavailable. Please try again in a moment.',
      });
    }

    // Our own JSON / response errors (thrown from openaiService with plain messages)
    if (err.message) {
      return res.status(500).json({ error: err.message });
    }

    res.status(500).json({ error: 'Failed to parse your message. Please try again.' });
  }
});

export default router;
