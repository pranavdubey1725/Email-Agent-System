# Email Agent

An intelligent email agent that composes and sends emails from voice or text input. Describe your email in plain English — the AI extracts the recipient, subject, and body, lets you review and edit, then delivers it directly from your Gmail account.

**Live demo:** https://email-agent-system-pranavdubey1725s-projects.vercel.app

---

## What It Does

1. **Sign in with Google** — one click, no passwords stored
2. **Speak or type** your email intent — *"Email sarah@company.com about the project deadline, tell her we're on track"*
3. **AI parses it** using GPT-4o-mini — extracts recipient, subject, and a full email body
4. **Review and edit** the extracted fields before sending
5. **Email is delivered** from your own Gmail via the Gmail API

---

## Features

| Feature | Details |
|---|---|
| Google OAuth 2.0 | Sign in with Google — email sent from your own Gmail account |
| Session management | Session stored in `localStorage`, sign-out clears it |
| Voice input | OpenAI Whisper — client-side silence detection, server-side transcription |
| Text input | Textarea with 500-character counter |
| AI parsing | GPT-4o-mini extracts `to`, `subject`, `body` |
| Tone selector | Raw · Formal · Friendly · Concise |
| Confidence flagging | Amber warning when the recipient address was reconstructed or guessed |
| Editable review form | Edit any field before sending, live word count |
| Email delivery | Gmail API (OAuth 2.0) — sends from the signed-in user's Gmail |
| Dark mode | Persisted to `localStorage` |
| Error handling | Every failure path surfaces a clear, actionable message |

---

## Tech Stack

```
Frontend    React 19 (Vite)
Voice       OpenAI Whisper (via backend API)
AI          OpenAI GPT-4o-mini
Auth        Google OAuth 2.0 + Gmail API
Backend     Node.js 22 + Express 5
Email       Gmail API (googleapis)
Deployed    Render (backend) · Vercel (frontend)
```

---

## Project Structure

```
email-agent/
├── client/                          # React frontend (Vite)
│   └── src/
│       ├── components/
│       │   ├── Login.jsx               # Google sign-in screen
│       │   ├── InputPanel.jsx          # Text + voice input, tone selector
│       │   ├── ConfirmationForm.jsx    # Editable review form, confidence warning
│       │   ├── StatusMessage.jsx       # Error/success/info banners
│       │   └── ErrorBoundary.jsx       # Catches unexpected React crashes
│       ├── hooks/
│       │   ├── useWhisper.js           # MediaRecorder + amplitude check + Whisper
│       │   └── useSpeechRecognition.js # Web Speech API — kept for reference
│       ├── services/
│       │   └── api.js                  # All fetch calls; attaches X-Session-Id header
│       └── App.jsx                     # Auth state, step machine, dark mode
│
├── server/                          # Express backend
│   ├── routes/
│   │   ├── auth.js                  # GET /auth/google, /auth/google/callback, /auth/me, POST /auth/logout
│   │   ├── transcribe.js            # POST /api/transcribe
│   │   ├── parse.js                 # POST /api/parse
│   │   └── send.js                  # POST /api/send (requires OAuth session)
│   ├── services/
│   │   ├── sessionStore.js          # In-memory session map
│   │   ├── gmailService.js          # Gmail API send (OAuth token)
│   │   └── openaiService.js         # GPT parsing, tone logic, confidence flagging
│   ├── index.js                     # Entry point, CORS, middleware
│   ├── test.js                      # Backend test script (19 tests, all passing)
│   └── .env.example                 # Required environment variables
│
└── docs/
    ├── NLP_FINDINGS.md              # Why regex + NLP failed (6 failure cases)
    ├── WEBSPEECH_FINDINGS.md        # Why Web Speech API was replaced by Whisper
    ├── OPENAI_FINDINGS.md           # Why GPT-4o-mini, capability comparison
    ├── CONFIDENCE_FLAGGING.md       # Confidence flagging design and implementation
    ├── EMAIL_SERVICE_REPORT.md      # Gmail API, OAuth 2.0 approach
    ├── TESTS.md                     # All tests (automated + manual), bugs found and fixed
    └── FULL_PROJECT_REPORT.md       # Complete project reference
```

---

## Usage

### Basic flow

1. **Sign in with Google** — click the button, authorise once
2. **Choose a tone** — Raw, Formal, Friendly, or Concise
3. **Describe your email** — type it or click the mic and speak
4. **Click Continue** — GPT extracts recipient, subject, and body
5. **Review the fields** — edit anything if needed
6. **Click Send Email** — email is delivered from your Gmail account

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

### `GET /auth/google`

Redirects the browser to Google's OAuth consent screen.

---

### `GET /auth/google/callback`

Google redirects here after the user grants permission. Exchanges the auth code for tokens, creates a session, and redirects to the frontend with `?session=<id>`.

---

### `GET /auth/me`

Returns the signed-in user's profile.

**Headers:** `X-Session-Id: <session id>`

**Response:** `{ "email": "user@gmail.com", "name": "User Name" }`

**Errors:** `401` if session is missing or expired.

---

### `POST /auth/logout`

Destroys the current session.

**Headers:** `X-Session-Id: <session id>`

**Response:** `{ "success": true }`

---

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

Sends an email via Gmail API using the signed-in user's OAuth token.

**Headers:** `X-Session-Id: <session id>`

**Request:** `{ "to": "...", "subject": "...", "body": "..." }`

**Response:** `{ "success": true, "messageId": "<abc123>" }`

**Errors:** `401` if not authenticated, `400` if fields are missing or invalid.

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
- Google Cloud project with OAuth 2.0 credentials and Gmail API enabled

### Install

```bash
git clone https://github.com/pranavdubey1725/Email-Agent-System.git
cd email-agent

cd client && npm install
cd ../server && npm install
```

### Google Cloud Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. **APIs & Services → Library** → search "Gmail API" → **Enable**
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
4. Application type: **Web application**
5. Authorised redirect URIs: `http://localhost:5000/auth/google/callback`
6. Copy the **Client ID** and **Client Secret**
7. **OAuth consent screen → Test users** → add your Gmail address

### Configure

```bash
cd server
cp .env.example .env
# Fill in OPENAI_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
```

Create `client/.env.local`:
```
VITE_API_URL=http://localhost:5000
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

Automated backend tests — 19/19 passing:

```bash
cd server && node test.js
```

See [docs/TESTS.md](docs/TESTS.md) for the full test breakdown, all manual UI tests, and the bugs found and fixed during testing.

---

## Documentation

| File | Contents |
|---|---|
| [docs/NLP_FINDINGS.md](docs/NLP_FINDINGS.md) | All 6 failure cases from the regex + NLP approach |
| [docs/WEBSPEECH_FINDINGS.md](docs/WEBSPEECH_FINDINGS.md) | Why Web Speech API was replaced by Whisper |
| [docs/OPENAI_FINDINGS.md](docs/OPENAI_FINDINGS.md) | Why GPT-4o-mini, capability comparison table |
| [docs/CONFIDENCE_FLAGGING.md](docs/CONFIDENCE_FLAGGING.md) | Confidence flagging design and implementation |
| [docs/EMAIL_SERVICE_REPORT.md](docs/EMAIL_SERVICE_REPORT.md) | Gmail API, OAuth 2.0, session management |
| [docs/TESTS.md](docs/TESTS.md) | Automated + manual tests, bugs found and fixed |
| [docs/FULL_PROJECT_REPORT.md](docs/FULL_PROJECT_REPORT.md) | Complete project reference document |

---

## License

MIT
