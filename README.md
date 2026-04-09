# Email Agent

An intelligent email agent that composes and sends emails from voice or text input. Describe your email in plain English — the AI extracts the recipient, subject, and body, lets you review and edit, then delivers it.

**Live demo:** _coming soon_

---

## What It Does

1. **Speak or type** your email intent — *"Email sarah@company.com about the project deadline, tell her we're on track"*
2. **AI parses it** using GPT-4o-mini — extracts recipient, subject, and a full email body
3. **Review and edit** the extracted fields before sending
4. **Email is delivered** via Gmail SMTP — straight to the recipient's inbox

---

## Features

| Feature | Details |
|---|---|
| Voice input | OpenAI Whisper — records audio, detects silence client-side, transcribes via API |
| Text input | Textarea with 500-character counter |
| AI parsing | GPT-4o-mini extracts `to`, `subject`, `body` |
| Tone selector | Raw · Formal · Friendly · Concise — controls how GPT writes the body |
| Confidence flagging | Amber warning when the recipient address was reconstructed or guessed |
| Editable review form | Edit any field before sending, word count on body |
| Email delivery | Nodemailer + Gmail SMTP |
| Dark mode | Persisted to localStorage |
| Error handling | Every failure path shows a clear, actionable message |

---

## Tech Stack

```
Frontend   React 19 (Vite)
Voice      OpenAI Whisper (via backend transcription API)
AI         OpenAI GPT-4o-mini
Backend    Node.js 22 + Express 5
Email      Nodemailer + Gmail SMTP
Deployed   Render (backend) + Vercel (frontend)
```

---

## Project Structure

```
email-agent/
├── client/                        # React frontend
│   └── src/
│       ├── components/
│       │   ├── InputPanel.jsx        # Text + voice input, tone selector
│       │   ├── ConfirmationForm.jsx  # Review/edit extracted fields
│       │   ├── StatusMessage.jsx     # Error/success/info banners
│       │   └── ErrorBoundary.jsx     # Catches unexpected React crashes
│       ├── hooks/
│       │   ├── useWhisper.js         # MediaRecorder + silence detection + Whisper
│       │   └── useSpeechRecognition.js  # Web Speech API (reference only — not used)
│       ├── services/
│       │   └── api.js                # All fetch calls to the backend
│       └── App.jsx                   # Main app shell + step state machine
│
├── server/                        # Express backend
│   ├── routes/
│   │   ├── transcribe.js          # POST /api/transcribe — Whisper
│   │   ├── parse.js               # POST /api/parse — GPT-4o-mini
│   │   └── send.js                # POST /api/send — Gmail SMTP
│   ├── services/
│   │   ├── openaiService.js       # GPT parsing, tone logic, confidence flagging
│   │   └── emailService.js        # Nodemailer transporter, SMTP error handling
│   ├── index.js                   # Server entry point, CORS, middleware
│   ├── test.js                    # Backend API test script (17 tests)
│   └── .env.example               # Environment variable template
│
└── docs/
    ├── NLP_FINDINGS.md            # Why regex + NLP failed, all 6 failure cases
    ├── OPENAI_FINDINGS.md         # Why GPT-4o-mini was chosen, capability comparison
    ├── CONFIDENCE_FLAGGING.md     # Confidence flagging design and implementation
    ├── EMAIL_SERVICE_REPORT.md    # Email delivery deep-dive (SMTP, Nodemailer)
    ├── TESTS.md                   # All automated and manual tests, bugs found and fixed
    └── FULL_PROJECT_REPORT.md     # Complete project reference document
```

---

## Prerequisites

- **Node.js v18 or above** — [nodejs.org](https://nodejs.org)
- **A Gmail account** with 2-Step Verification enabled and an App Password generated
- **An OpenAI API account** with credits — [platform.openai.com](https://platform.openai.com)

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-username/email-agent.git
cd email-agent
```

### 2. Install dependencies

```bash
# Frontend
cd client && npm install

# Backend
cd ../server && npm install
```

### 3. Configure environment variables

```bash
cd server
cp .env.example .env
```

Open `server/.env` and fill in:

```env
OPENAI_API_KEY=sk-proj-...
GMAIL_USER=yourname@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
PORT=5000
```

### 4. Run locally

```bash
# Terminal 1 — backend
cd server && node index.js

# Terminal 2 — frontend
cd client && npm run dev
```

Open `http://localhost:5173`.

---

## Usage

### Basic flow

1. **Choose a tone** — Raw, Formal, Friendly, or Concise
2. **Describe your email** — type it or click the mic and speak
3. **Click Continue** — GPT extracts recipient, subject, and body
4. **Review the fields** — edit anything if needed
5. **Click Send Email** — email is delivered to the recipient

### Tone modes

| Tone | What it does |
|---|---|
| **Raw** | Sends your exact words — GPT only extracts the recipient and subject |
| **Formal** | Rewrites in professional, polished language |
| **Friendly** | Keeps it warm and conversational |
| **Concise** | Strips everything down to the core message |

### Voice input

Click the mic and speak naturally. The app analyses the recording for actual speech before sending to Whisper — silent recordings are discarded client-side without making an API call. Works in all modern browsers (Chrome, Edge, Firefox, Safari).

### Confidence warning

If the AI reconstructed or guessed the recipient address (e.g. from a spoken format like "pranav at gmail dot com"), the **To** field shows an amber border:

> ⚠ AI wasn't certain about this address — please verify it before sending.

The warning disappears once you edit the field.

---

## Testing

### Automated

```bash
cd server && node test.js
```

Runs 17 tests against all backend routes. Requires the server to be running and `OPENAI_API_KEY` set in `.env`. Results: **17/17 passing**.

See [docs/TESTS.md](docs/TESTS.md) for the full test breakdown, all manual tests, and bugs found during testing.

---

## Deployment

### Backend — Render

- **Root Directory:** `server`
- **Build Command:** `npm install`
- **Start Command:** `node index.js`
- **Environment variables:** `OPENAI_API_KEY`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `FRONTEND_URL` (your Vercel URL)

### Frontend — Vercel

- **Root Directory:** `client`
- **Framework:** Vite
- **Environment variables:** `VITE_API_URL` (your Render backend URL)

---

## API Reference

### `POST /api/transcribe`

Transcribes audio using OpenAI Whisper. Silent recordings return `""`.

**Request:** `multipart/form-data` — field `audio` (webm blob)

**Response:** `{ "transcript": "..." }`

---

### `POST /api/parse`

Parses natural language into structured email fields.

**Request:**
```json
{ "message": "Email john@example.com about the Friday meeting", "tone": "formal" }
```

**Response:**
```json
{
  "to": "john@example.com",
  "subject": "Friday Meeting",
  "body": "I would like to discuss the Friday meeting at your earliest convenience.",
  "toConfidence": "high"
}
```

`toConfidence` is `"high"` only when a literal `@` address was present in the input. Everything else — reconstructed spoken addresses, guesses from names — returns `"low"`.

---

### `POST /api/send`

Sends an email via Gmail SMTP.

**Request:**
```json
{ "to": "john@example.com", "subject": "Friday Meeting", "body": "..." }
```

**Response:** `{ "success": true, "messageId": "<abc123@gmail.com>" }`

---

### `GET /health`

**Response:** `{ "status": "ok", "message": "Email Agent server is running" }`

---

## Documentation

| File | Contents |
|---|---|
| [docs/NLP_FINDINGS.md](docs/NLP_FINDINGS.md) | All 6 failure cases from the regex + NLP approach |
| [docs/OPENAI_FINDINGS.md](docs/OPENAI_FINDINGS.md) | Why GPT-4o-mini was chosen, capability comparison |
| [docs/CONFIDENCE_FLAGGING.md](docs/CONFIDENCE_FLAGGING.md) | Confidence flagging design and implementation |
| [docs/EMAIL_SERVICE_REPORT.md](docs/EMAIL_SERVICE_REPORT.md) | SMTP, Nodemailer, Gmail App Password explained |
| [docs/TESTS.md](docs/TESTS.md) | All tests (automated + manual), bugs found and fixed |
| [docs/FULL_PROJECT_REPORT.md](docs/FULL_PROJECT_REPORT.md) | Complete project reference document |

---

## License

MIT
