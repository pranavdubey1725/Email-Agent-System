import dns from 'dns';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Render's free tier doesn't support IPv6 — force all DNS lookups to IPv4.
dns.setDefaultResultOrder('ipv4first');
import parseRouter from './routes/parse.js';
import sendRouter from './routes/send.js';
import transcribeRouter from './routes/transcribe.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware ---
// Allow the Vite dev server locally and the deployed frontend in production.
// Set FRONTEND_URL on Render to your Vercel app URL (e.g. https://email-agent.vercel.app).
const allowedOrigins = ['http://localhost:5173'];
if (process.env.FRONTEND_URL) allowedOrigins.push(process.env.FRONTEND_URL);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// --- Routes ---
app.use('/api/parse', parseRouter);
app.use('/api/send', sendRouter);
app.use('/api/transcribe', transcribeRouter);

// Health check — visit http://localhost:5000/health to confirm server is running
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Email Agent server is running' });
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
