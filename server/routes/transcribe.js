import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import { toFile } from 'openai';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/transcribe
// Accepts: multipart/form-data with an "audio" field (webm/ogg/mp4 blob)
// Returns: { transcript: string }
router.post('/', upload.single('audio'), async (req, res) => {
  // Instantiate here so dotenv has already run by the time this executes
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file received.' });
  }

  // The browser sends webm audio — Whisper accepts it directly.
  // We wrap the buffer in an openai File object so the SDK can stream it.
  const audioFile = await toFile(req.file.buffer, 'audio.webm', {
    type: req.file.mimetype || 'audio/webm',
  });

  const response = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    language: 'en',
  });

  // Whisper hallucinates text when given silent or near-silent audio.
  // It was heavily trained on YouTube, so silence sounds like the end of a video.
  // Strategy: catch anything that starts with "thank you for watching" or
  // "thanks for watching" regardless of what follows (e.g. "...and subscribe!").
  // Also catch other common silence artifacts (lone punctuation, "you", etc.).
  const transcript = response.text.trim();

  const isSilenceHallucination =
    /^thank(s| you) for watching/i.test(transcript) ||
    /^thank you[.!]?\s*$/i.test(transcript)         ||
    /^you[.!]?\s*$/i.test(transcript)               ||
    /^[.\s]+$/.test(transcript);

  res.json({ transcript: isSilenceHallucination ? '' : transcript });
});

export default router;
