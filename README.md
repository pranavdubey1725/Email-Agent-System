# Email Agent

An intelligent email agent that composes and sends emails from voice or text input. Describe your email in plain English — the AI extracts the recipient, subject, and body, lets you review and edit, then delivers it.

**Live demo:** `[URL]`

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
| Voice input | OpenAI Whisper — client-side silence detection, server-side transcription |
| Text input | Textarea with 500-character counter |
| AI parsing | GPT-4o-mini extracts `to`, `subject`, `body` |
| Tone selector | Raw · Formal · Friendly · Concise |
| Confidence flagging | Amber warning when the recipient address was reconstructed or guessed |
| Editable review form | Edit any field before sending, live word count |
| Email delivery | Nodemailer + Gmail SMTP |
| Dark mode | Persisted to `localStorage` |
| Error handling | Every failure path surfaces a clear, actionable message |

---

## Tech Stack

```
Frontend    React 19 (Vite)
Voice       OpenAI Whisper (via backend API)
AI          OpenAI GPT-4o-mini
Backend     Node.js 22 + Express 5
Email       Nodemailer + Gmail SMTP
Deployed    Render (backend) · Vercel (frontend)
```

---

## Project Structure

```
email-agent/
├── client/                          # React frontend (Vite)
│   └── src/
│       ├── components/
│       │   ├── InputPanel.jsx          # Text + voice input, tone selector
│       │   ├── ConfirmationForm.jsx    # Editable review form, confidence warning
│       │   ├── StatusMessage.jsx       # Error/success/info banners
│       │   └── ErrorBoundary.jsx       # Catches unexpected React crashes
│       ├── hooks/
│       │   ├── useWhisper.js           # MediaRecorder + amplitude check + Whisper
│       │   └── useSpeechRecognition.js # Web Speech API — kept for reference
│       ├── services/
│       │   └── api.js                  # All fetch calls to the backend
│       └── App.jsx                     # Step state machine, dark mode
│
├── server/                          # Express backend
│   ├── routes/
│   │   ├── transcribe.js            # POST /api/transcribe
│   │   ├── parse.js                 # POST /api/parse
│   │   └── send.js                  # POST /api/send
│   ├── services/
│   │   ├── openaiService.js         # GPT parsing, tone logic, confidence flagging
│   │   └── emailService.js          # Nodemailer, SMTP error handling
│   ├── index.js                     # Entry point, CORS, middleware
│   ├── test.js                      # Backend test script (17 tests, all passing)
│   └── .env.example                 # Required environment variables
│
└── docs/
    ├── NLP_FINDINGS.md              # Why regex + NLP failed (6 failure cases)
    ├── WEBSPEECH_FINDINGS.md        # Why Web Speech API was replaced by Whisper
    ├── OPENAI_FINDINGS.md           # Why GPT-4o-mini, capability comparison
    ├── CONFIDENCE_FLAGGING.md       # Confidence flagging design and implementation
    ├── EMAIL_SERVICE_REPORT.md      # SMTP, Nodemailer, Gmail App Password
    ├── TESTS.md                     # All tests (automated + manual), bugs found and fixed
    └── FULL_PROJECT_REPORT.md       # Complete project reference
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
| **Raw** | Sends your exact words — GPT only extracts recipient and subject |
| **Formal** | Rewrites in professional, polished language |
| **Friendly** | Keeps it warm and conversational |
| **Concise** | Strips everything to the core message |

### Voice input

Click the mic and speak. The recording is analysed for actual speech before being sent to Whisper — silent recordings are discarded without making an API call. Works in all modern browsers.

### Confidence warning

If the AI reconstructed or guessed the recipient address (e.g. from a spoken format like *"pranav at gmail dot com"*), an amber warning appears under the **To** field. It disappears once you edit the field.

---

## API Reference

### `POST /api/transcribe`

Transcribes audio using OpenAI Whisper. Silent recordings return `""`.

**Request:** `multipart/form-data` with field `audio` (webm blob)

**Response:** `{ "transcript": "..." }`

---

### `POST /api/parse`

Parses natural language into structured email fields.

**Request:**
```json
{ "message": "Email john@example.com about the Friday meeting", "tone": "formal" }
```

| Field | Type | Required | Values |
|---|---|---|---|
| `message` | string | Yes | Natural language input |
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

`toConfidence` is `"high"` only when a literal `@` address was present in the input.

---

### `POST /api/send`

Sends an email via Gmail SMTP.

**Request:** `{ "to": "...", "subject": "...", "body": "..." }`

**Response:** `{ "success": true, "messageId": "<abc123@gmail.com>" }`

---

### `GET /health`

**Response:** `{ "status": "ok", "message": "Email Agent server is running" }`

---

## Running Locally

<details>
<summary>Setup instructions</summary>

### Prerequisites

- Node.js v18+
- OpenAI API key — [platform.openai.com](https://platform.openai.com)
- Gmail account with 2-Step Verification and an App Password

### Install

```bash
git clone https://github.com/pranavdubey1725/Email-Agent-System.git
cd email-agent

cd client && npm install
cd ../server && npm install
```

### Configure

```bash
cd server
cp .env.example .env
# Fill in OPENAI_API_KEY, GMAIL_USER, GMAIL_APP_PASSWORD
```

### Run

```bash
# Terminal 1
cd server && node index.js

# Terminal 2
cd client && npm run dev
```

Open `http://localhost:5173`.

</details>

---

## Testing

Automated backend tests — 17/17 passing:

```bash
cd server && node test.js
```

See [docs/TESTS.md](docs/TESTS.md) for the full test breakdown, all 20 manual UI tests, and the 3 bugs found and fixed during testing.

---

## Documentation

| File | Contents |
|---|---|
| [docs/NLP_FINDINGS.md](docs/NLP_FINDINGS.md) | All 6 failure cases from the regex + NLP approach |
| [docs/WEBSPEECH_FINDINGS.md](docs/WEBSPEECH_FINDINGS.md) | Why Web Speech API was replaced by Whisper |
| [docs/OPENAI_FINDINGS.md](docs/OPENAI_FINDINGS.md) | Why GPT-4o-mini, capability comparison table |
| [docs/CONFIDENCE_FLAGGING.md](docs/CONFIDENCE_FLAGGING.md) | Confidence flagging design and implementation |
| [docs/EMAIL_SERVICE_REPORT.md](docs/EMAIL_SERVICE_REPORT.md) | SMTP, Nodemailer, Gmail App Password explained |
| [docs/TESTS.md](docs/TESTS.md) | Automated + manual tests, bugs found and fixed |
| [docs/FULL_PROJECT_REPORT.md](docs/FULL_PROJECT_REPORT.md) | Complete project reference document |

---

## License

MIT
