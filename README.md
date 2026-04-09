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
| Voice input | OpenAI Whisper — records audio and transcribes via the Whisper API |
| Text input | Textarea with character counter |
| AI parsing | GPT-4o-mini extracts `to`, `subject`, `body` |
| Tone selector | Raw · Formal · Friendly · Concise — controls how GPT writes the body |
| Confidence flagging | Amber warning when GPT is uncertain about the email address |
| Editable review form | Edit any field before sending |
| Email delivery | Nodemailer + Gmail SMTP |
| Error handling | Every failure path shows a clear, actionable message |

---

## Tech Stack

```
Frontend   React 19 (Vite)
Voice      OpenAI Whisper (via backend transcription API)
AI         OpenAI GPT-4o-mini
Backend    Node.js 22 + Express 5
Email      Nodemailer + Gmail SMTP
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
│       │   └── useWhisper.js         # MediaRecorder + Whisper transcription
│       ├── services/
│       │   └── api.js                # All fetch calls to the backend
│       └── App.jsx                   # Main app shell + step management
│
├── server/                        # Express backend
│   ├── routes/
│   │   ├── transcribe.js          # POST /api/transcribe
│   │   ├── parse.js               # POST /api/parse
│   │   └── send.js                # POST /api/send
│   ├── services/
│   │   ├── openaiService.js       # GPT-4o-mini parsing + confidence
│   │   └── emailService.js        # Nodemailer email delivery
│   ├── index.js                   # Server entry point
│   ├── test.js                    # Backend API test script
│   └── .env.example               # Environment variable template
│
└── docs/
    ├── OPENAI_FINDINGS.md         # Why OpenAI over NLP libraries
    ├── CONFIDENCE_FLAGGING.md     # Confidence flagging design doc
    └── EMAIL_SERVICE_REPORT.md    # Email service deep-dive
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
cd client
npm install

# Backend
cd ../server
npm install
```

### 3. Configure environment variables

```bash
cd server
cp .env.example .env
```

Open `server/.env` and fill in the required values:

```env
OPENAI_API_KEY=sk-proj-...
GMAIL_USER=yourname@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
PORT=5000
```

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

Click the mic button and speak naturally. Recording stops when you click again. The audio is sent to Whisper for transcription — the result appears in the textarea and can be edited before submitting.

Voice input works in all modern browsers (Chrome, Edge, Firefox, Safari).

### Confidence warning

If the AI is uncertain about the email address it extracted (e.g. the address was partially spoken or inferred), the **To** field will show an amber border and a warning:

> ⚠ AI wasn't certain about this address — please verify it before sending.

Always double-check the recipient before sending.

---

## API Reference

### `POST /api/transcribe`

Transcribes an audio recording using OpenAI Whisper.

**Request:** `multipart/form-data` with an `audio` field (webm blob)

**Response:**
```json
{ "transcript": "Email john at example dot com about the Friday meeting" }
```

---

### `POST /api/parse`

Parses a natural language message into email fields using GPT-4o-mini.

**Request body:**
```json
{
  "message": "Email john@example.com about the Friday meeting",
  "tone": "formal"
}
```

| Field | Type | Required | Values |
|---|---|---|---|
| `message` | string | Yes | The user's natural language input |
| `tone` | string | No | `raw` · `formal` · `friendly` · `concise` (default: `raw`) |

**Response:**
```json
{
  "to": "john@example.com",
  "subject": "Friday Meeting",
  "body": "I would like to discuss the Friday meeting at your earliest convenience.",
  "toConfidence": "high"
}
```

| Field | Description |
|---|---|
| `to` | Extracted email address, or `""` if not found |
| `subject` | Generated subject line |
| `body` | Email body in the requested tone |
| `toConfidence` | `"high"` if GPT found a clear address, `"low"` if it guessed or couldn't find one |

---

### `POST /api/send`

Sends an email via Gmail SMTP.

**Request body:**
```json
{
  "to": "john@example.com",
  "subject": "Friday Meeting",
  "body": "I would like to discuss the Friday meeting."
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "<abc123@gmail.com>"
}
```

---

### `GET /health`

Health check — confirms the server is running.

**Response:**
```json
{
  "status": "ok",
  "message": "Email Agent server is running"
}
```

---

## License

MIT
