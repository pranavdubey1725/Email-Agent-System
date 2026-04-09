# Email Agent — Full Project Report

> **Purpose:** The single authoritative reference for everything about this project. Every file, every design decision, every bug encountered and fixed, every architectural trade-off. Use this as the source of truth when writing other documentation.

---

## Table of Contents

1. [What We Built](#1-what-we-built)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [The Three-Step User Flow](#4-the-three-step-user-flow)
5. [Phase 1 — The NLP Approach: What We Tried and Why It Failed](#5-phase-1--the-nlp-approach-what-we-tried-and-why-it-failed)
6. [Phase 2 — GPT Integration and the Body Faithfulness Bug](#6-phase-2--gpt-integration-and-the-body-faithfulness-bug)
7. [Phase 3 — Confidence Flagging](#7-phase-3--confidence-flagging)
8. [Phase 4 — Email Delivery](#8-phase-4--email-delivery)
9. [Phase 5 — Voice Input: Whisper vs Web Speech API](#9-phase-5--voice-input-whisper-vs-web-speech-api)
10. [The Tone System](#10-the-tone-system)
11. [Backend Architecture](#11-backend-architecture)
12. [Frontend Architecture](#12-frontend-architecture)
13. [Styling & Design System](#13-styling--design-system)
14. [Error Handling — All Layers](#14-error-handling--all-layers)
15. [Test Suite](#15-test-suite)
16. [Environment Variables](#16-environment-variables)
17. [API Reference](#17-api-reference)
18. [Complete Bug & Fix Log](#18-complete-bug--fix-log)
19. [Key Design Decisions Summary](#19-key-design-decisions-summary)

---

## 1. What We Built

An intelligent email agent with a three-step UI:

1. **Input** — the user describes their email in plain English, by typing or speaking
2. **Review** — GPT parses the description into structured fields (`to`, `subject`, `body`); the user can edit before sending
3. **Sent** — Nodemailer delivers the email via Gmail SMTP

The core value: a user can say *"Email sarah@company.com about the project update, tell her we're on track"* and receive a correctly addressed, properly written email in their outbox — without touching a traditional email compose form.

---

## 2. Tech Stack

### Frontend
| Technology | Version | Role |
|---|---|---|
| React | 19.2.4 | UI framework |
| Vite | 8.0.4 | Build tool and dev server |
| `@vitejs/plugin-react` | 6.0.1 | React Fast Refresh in dev |
| CSS (no framework) | — | All styling hand-written with CSS variables |

### Backend
| Technology | Version | Role |
|---|---|---|
| Node.js | 22 | Runtime |
| Express | 5.2.1 | HTTP server and routing |
| OpenAI SDK | 6.33.0 | GPT-4o-mini (parsing) and Whisper (transcription) |
| Nodemailer | 8.0.4 | Gmail SMTP email delivery |
| multer | 2.1.1 | Multipart form parsing (audio file upload) |
| cors | 2.8.6 | Cross-origin requests from the React frontend |
| dotenv | 17.4.1 | Environment variable loading from `.env` |

### External Services
| Service | What it does |
|---|---|
| OpenAI GPT-4o-mini | Parses natural language into `{ to, subject, body, to_confidence }` |
| OpenAI Whisper (`whisper-1`) | Transcribes voice recordings to text |
| Gmail SMTP (`smtp.gmail.com:587`) | Delivers the finished email to the recipient |

### Why these choices
- **React 19 + Vite**: fastest dev setup, modern React with hooks, no class components needed
- **Express 5**: minimal overhead, straightforward routing — no need for a heavier framework for three routes
- **GPT-4o-mini over GPT-4o**: cheaper per call (~$0.0002), faster, still highly capable for structured extraction tasks
- **Nodemailer + Gmail over SendGrid/Mailgun**: zero account setup, free, sufficient for a demo — no domain verification required
- **No CSS framework**: the UI is simple enough that Tailwind or MUI would add more weight than value; hand-written CSS with CSS variables gives full control and is easy to read

---

## 3. Project Structure

```
email-agent/
│
├── client/                              # React frontend (Vite)
│   ├── index.html                       # Single HTML shell; React mounts into <div id="root">
│   ├── vite.config.js                   # Proxy /api → localhost:5000 in dev
│   ├── package.json                     # React 19, Vite, ESLint
│   └── src/
│       ├── main.jsx                     # Entry: wraps <App> in <ErrorBoundary>
│       ├── App.jsx                      # Step state machine, dark mode, route between views
│       ├── App.css                      # Global layout, design tokens, shared button styles
│       ├── index.css                    # Minimal reset (box-sizing, margin: 0)
│       ├── components/
│       │   ├── InputPanel.jsx           # Step 1: text/voice input + tone selector
│       │   ├── InputPanel.css           # Styles for tone buttons, mic button, textarea
│       │   ├── ConfirmationForm.jsx     # Step 2: editable review form + confidence warning
│       │   ├── ConfirmationForm.css     # Styles for fields, AI badge, warning colours
│       │   ├── StatusMessage.jsx        # Reusable error/info/success banner
│       │   ├── StatusMessage.css        # Banner styles
│       │   ├── ErrorBoundary.jsx        # React class component — catches render crashes
│       │   └── (ErrorBoundary has no .css — uses global .error-boundary class in App.css)
│       ├── hooks/
│       │   ├── useWhisper.js            # Records audio via MediaRecorder, POSTs to /api/transcribe
│       │   └── useSpeechRecognition.js  # [Unused] Original Web Speech API hook — kept for reference
│       └── services/
│           └── api.js                   # All fetch() calls to the backend (parseMessage, sendEmail)
│
├── server/                              # Express backend
│   ├── index.js                         # Server entry: middleware, route mounting, health check
│   ├── package.json                     # Express, OpenAI, Nodemailer, multer, cors, dotenv
│   ├── .env                             # Secrets (not in git): OPENAI_API_KEY, GMAIL_USER, GMAIL_APP_PASSWORD
│   ├── .env.example                     # Template showing required keys
│   ├── .gitignore                       # Excludes .env and node_modules
│   ├── test.js                          # Backend API test script (runs against the live server)
│   ├── routes/
│   │   ├── transcribe.js                # POST /api/transcribe — receives audio blob, calls Whisper
│   │   ├── parse.js                     # POST /api/parse — validates, calls openaiService
│   │   └── send.js                      # POST /api/send — validates, calls emailService
│   └── services/
│       ├── openaiService.js             # GPT-4o-mini parsing logic, prompt construction, tone handling
│       └── emailService.js             # Nodemailer transporter, SMTP error classification
│
└── docs/
    ├── FULL_PROJECT_REPORT.md           # This file
    ├── OPENAI_FINDINGS.md               # Why GPT-4o-mini over regex/NLP libraries
    ├── CONFIDENCE_FLAGGING.md           # Confidence flagging design and implementation
    └── EMAIL_SERVICE_REPORT.md          # In-depth breakdown of Nodemailer + Gmail SMTP
```

---

## 4. The Three-Step User Flow

The entire app is a state machine with three states managed in `App.jsx`:

```
'input'  →  'confirmation'  →  'sent'
```

A step indicator in the header shows progress (Input → Review → Sent) with animated connecting lines. Completed steps show a ✓.

### State variables in App.jsx

| State | Type | Purpose |
|---|---|---|
| `step` | `'input' \| 'confirmation' \| 'sent'` | Controls which view is shown |
| `isLoading` | boolean | True while GPT is parsing (disables the input form) |
| `isSending` | boolean | True while Nodemailer is sending (disables the confirmation form) |
| `error` | string \| null | Any error message — shown in `<StatusMessage>` above the current step |
| `parsedEmail` | `{ to, subject, body, toConfidence }` | The AI-parsed result; passed into `ConfirmationForm` |
| `sentTo` | string | Recipient address — shown in the success screen |
| `isDark` | boolean | Dark mode toggle state, persisted to `localStorage` |

### Step transitions

- **input → confirmation**: triggered by `handleInputSubmit(message, tone)` — calls `parseMessage()` from `api.js`, receives `{ to, subject, body, toConfidence }`, sets `parsedEmail`, advances step
- **confirmation → sent**: triggered by `handleSend(emailData)` — calls `sendEmail()` from `api.js`, advances step on success
- **confirmation → input**: Back button calls `setStep('input')` directly
- **sent → input**: "Send another email" button calls `handleStartOver()`, which resets all state

### Fade animation

Each step change re-mounts the content with the key `{step}`, which triggers a CSS `stepFadeIn` animation (opacity 0→1, Y offset 8px→0, 250ms). This gives each step change a clean, polished feel.

---

## 5. Phase 1 — The NLP Approach: What We Tried and Why It Failed

Before building the GPT pipeline, we tried to parse email intent using:
- **Regular expressions** to extract email addresses
- **compromise.js** (an NLP library) to identify recipients, extract named entities, and parse sentence structure

### What broke and why

| Input | Expected | Actual result | Root cause |
|---|---|---|---|
| `Pranav Dubey 1725@gmail.com` | `pranavdubey1725@gmail.com` | `1725@gmail.com` (name lost) | Regex matches structural email tokens, not meaning — the username before `1725@` was discarded |
| `pranav at gmail dot com` | `pranav@gmail.com` | Nothing found | Spoken email format doesn't structurally resemble an email address |
| `1725 @ gmail.com` | `1725@gmail.com` | Nothing found | Spaces around `@` break the regex pattern |
| `send an email to John saying hi` | `to: ""`, `body: "hi"` | Could not distinguish recipient from boilerplate | compromise.js labels words as noun/verb but has no concept of command structure — "John" and "email" both look like noun phrases |
| `tell him I'll be late` | Body extracted, `to` empty | Complete failure | No world knowledge, cannot resolve pronouns or implicit references |
| `milk to pranav at the rate gmail.com` | Corrects "milk"→"mail", extracts email | Total failure | Speech-to-text artifacts require semantic correction, not pattern matching |

### Why we stopped

Every fix was a patch over the same root cause: **pattern matching cannot understand meaning**. We were writing more and more regex rules and NLP heuristics to handle individual edge cases, with no path to handling them all. The fundamental capability gap — understanding *intent* — cannot be closed by adding more rules.

### The switch to GPT

Replaced the entire NLP pipeline with a single `client.chat.completions.create()` call to `gpt-4o-mini`. GPT understands natural language the way a human does — it reads the input as a sentence, understands the command structure ("send an email to X saying Y"), and returns a structured JSON object. One API call replaced hundreds of lines of regex and NLP code.

---

## 6. Phase 2 — GPT Integration and the Body Faithfulness Bug

### Initial implementation

The first GPT system prompt instructed:

> *"Write a complete, professional email body — expand the user's intent into a proper email."*

This produced polished-looking output, but with a critical flaw.

**Input:** `"email ekta saying hi let's catch up"`

**Output:**
```
Dear Ekta,

I hope this message finds you well. I wanted to reach out to discuss
a few matters that I believe are important. Please let me know a
convenient time for you to chat.

Best regards,
[Your Name]
```

### What was wrong

1. **Filler phrases** the user never said ("I hope this message finds you well", "I wanted to reach out")
2. **`[Your Name]` placeholder** — the email couldn't be sent without manual editing
3. **The user's actual intent was buried** — they said "hi let's catch up", GPT replaced it with a generic formal letter
4. **The agent was the author, not the user** — GPT was writing its own version of a "professional email" rather than faithfully transcribing what the user said

### The fix

Rewrote the system prompt to explicitly say:

```
"body": ONLY the message the user wants to send — copy their exact words verbatim.
Strip the command wrapper (e.g. "send an email to X saying") and return just the content.
Do NOT rephrase, clean up, expand, or modify in any way.
```

**Same input after fix:**
```
Hi, let's catch up.
```

### Lesson

Prompt wording has direct, measurable impact on GPT output. "Expand intent into a professional email" vs. "copy their exact words verbatim" produces completely different emails from identical input. Prompt engineering is not a one-time setup — it requires iteration based on real observed outputs.

The correct mental model for this agent: **GPT is the transcriber and formatter, not the author.** The user is the author.

### Why the Tone system exists

After fixing body faithfulness, a new question arose: sometimes the user *does* want GPT to rewrite their words — but in a controlled, opt-in way. The tone selector was built to provide this. Raw mode (default) preserves the user's exact words. The other three modes (Formal, Friendly, Concise) explicitly instruct GPT to rewrite — but only when the user has consciously chosen that mode.

---

## 7. Phase 3 — Confidence Flagging

### The problem

GPT successfully extracts email addresses in most cases. But not all extractions are equally reliable:

| Input | What GPT does | Reliability |
|---|---|---|
| `email john@company.com about the meeting` | Reads a complete address directly | High |
| `email john at company dot com` | Reconstructs from spoken format | Medium — likely correct but inferred |
| `mail to pranav at the rate gmail.com` (voice mishearing) | Guesses from partial/corrupted input | Low — could be wrong |
| `email my boss` | No address at all, leaves `to` empty | N/A — handled separately |

Without flagging, **all of these look identical to the user**. A correctly read address and a guessed one both appear in the same `To` field with the same styling. The user has no signal that one needs more careful review.

The risk: a confidently wrong email address means the email goes to the wrong person.

### The four-layer solution

**Layer 1 — GPT rates itself**

Added `to_confidence` as a fourth JSON field. The system prompt for both Raw and Tone-adjusted modes includes:

```
- "to_confidence": rate your confidence in the "to" field as either "high" or "low".
  Use "high" only when a complete, clearly stated email address was present in the input.
  Use "low" when: no email was found, the address was partially spoken or guessed,
  the input was ambiguous, or you inferred it from a name rather than reading it directly.
```

GPT returns:
```json
{
  "to": "pranavdubey@gmail.com",
  "to_confidence": "low",
  "subject": "Quick Hello",
  "body": "Hi, just wanted to say hello."
}
```

**Layer 2 — Backend normalises defensively**

In `openaiService.js`, the `normalise()` helper treats anything other than the explicit string `"high"` as `"low"`:

```js
toConfidence: parsed.to_confidence === 'high' ? 'high' : 'low'
```

If GPT omits the field, returns `null`, or returns an unexpected value, the result defaults to `"low"` (cautious). The system never silently passes an unchecked confidence value.

**Layer 3 — toConfidence travels the full stack**

```
openaiService.normalise()
  → routes/parse.js (returned in JSON response)
  → api.js parseMessage() (returned to App.jsx)
  → App.jsx parsedEmail state
  → ConfirmationForm as a prop
```

**Layer 4 — Amber warning in the UI**

In `ConfirmationForm.jsx`:
- When `toConfidence === 'low'` AND the `To` field has a value AND the user hasn't yet edited it: the `To` input gets an **amber border** and a warning appears beneath it
- The warning reads: *"⚠ AI wasn't certain about this address — please verify it before sending."*
- The warning **disappears as soon as the user edits the field** — they've taken ownership, the warning has served its purpose
- This is tracked by a `userEditedTo` state: `false` initially, set to `true` on `handleToChange`

### Priority order of To field messages

Only one message shows at a time, in this priority order:

| Condition | Message | Colour |
|---|---|---|
| Value present but fails email regex | "Please enter a valid email address." | Red (`#ef4444`) |
| Low confidence AND value present AND user hasn't edited | "AI wasn't certain about this address — please verify it before sending." | Amber (`#d97706`) |
| Field is completely empty | "The AI couldn't find an email address — please enter one." | Amber (`#d97706`) |

The format-error message takes priority because it's a harder failure (the address is structurally wrong, not just uncertain). A structurally wrong address is more urgent than an uncertain one.

---

## 8. Phase 4 — Email Delivery

### What happens when the user clicks Send Email

```
ConfirmationForm.onSend({ to, subject, body })
  → App.jsx handleSend()
  → api.js sendEmail() [POST /api/send]
  → server/routes/send.js
      → validation: all fields present?
      → validation: email format valid? (regex /^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  → server/services/emailService.js sendEmail()
      → checkCredentials() (throws early if .env keys missing)
      → nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
      → transporter.sendMail({ from, to, subject, text, html })
          → TLS connection to smtp.gmail.com:587
          → SMTP authentication with Gmail App Password
          → Email transmitted
          → Gmail acknowledges, returns messageId
  → res.json({ success: true, messageId })
  → App.jsx: step = 'sent', sentTo = emailData.to
```

### The mailOptions object

```js
{
  from: `"Email Agent" <${process.env.GMAIL_USER}>`,
  to,
  subject,
  text: body,
  html: `<p>${body.replace(/\n/g, '<br>')}</p>`
}
```

- **`from` display name**: "Email Agent" — what the recipient sees as the sender name
- **Both `text` and `html`**: sent as `multipart/alternative` so email clients automatically pick the version they support. Old/corporate clients often only render plain text; modern clients prefer HTML
- **HTML conversion**: newlines (`\n`) replaced with `<br>` tags to preserve paragraph breaks when rendered in a browser

### Why SMTP over the Gmail API

The Gmail REST API (via OAuth 2.0) would require: user login flows, access tokens, refresh tokens, callback URLs, and Google Cloud project setup. For simply sending an email, this is significant overhead. SMTP via Nodemailer achieves the same result — email in the recipient's inbox — with far less setup.

### Why Gmail App Password over regular password

Since May 2022, Google blocks regular Gmail passwords for programmatic SMTP access. An App Password is a 16-character credential that Google generates specifically for one application. It:
- Only works for SMTP (no access to Drive, Calendar, contacts, etc.)
- Can be revoked at any time without changing the main password
- Is stored in `.env`, never committed to source code

### SMTP error classification

`emailService.js` catches Nodemailer errors and classifies them into user-readable messages:

| SMTP error pattern | User-facing message |
|---|---|
| `Invalid login`, `535`, `Username and Password not accepted` | "Gmail login failed. Your App Password may be wrong or expired..." |
| `ECONNREFUSED`, `ENOTFOUND`, `ETIMEDOUT` | "Could not connect to Gmail. Check your internet connection..." |
| `550`, `5.1.1`, `invalid address` | "The recipient address was rejected by Gmail. Please double-check it." |
| Anything else | "Email could not be sent: [original error message]" |

---

## 9. Phase 5 — Voice Input: Whisper vs Web Speech API

The project has two voice hooks. Only `useWhisper.js` is active. `useSpeechRecognition.js` is kept for reference.

### How Whisper works in this project

**Step 1 — Browser records audio**

`useWhisper.js` calls `navigator.mediaDevices.getUserMedia({ audio: true })` to request microphone access. On grant, it creates a `MediaRecorder` instance. Audio chunks are collected in `chunksRef.current` via the `ondataavailable` event as the user speaks.

**Step 2 — User stops recording**

When the user clicks the mic button again, `stopRecording()` calls `mediaRecorder.stop()`. The `onstop` event fires, which:
- Stops all mic tracks so the browser's recording indicator disappears
- Assembles the chunks into a single `Blob` (type: `audio/webm`)
- Calls `transcribe(blob)`

**Step 3 — Audio posted to backend**

`transcribe()` creates a `FormData` object with the blob appended as `"audio"` and POSTs it to `/api/transcribe`.

**Step 4 — Server calls Whisper**

`server/routes/transcribe.js` receives the file via `multer` (stored in memory, not written to disk). It wraps the buffer in an OpenAI `File` object using `toFile()` from the OpenAI SDK, then calls:

```js
openai.audio.transcriptions.create({
  file: audioFile,
  model: 'whisper-1',
  language: 'en',
})
```

Whisper returns the transcription text. The server responds with `{ transcript: "..." }`.

**Step 5 — Transcript appears in textarea**

Back in `useWhisper.js`, the response calls `onTranscriptChange(transcript)`, which sets the `message` state in `InputPanel` — the textarea updates with the full transcription.

### State managed by useWhisper

| State | Type | Meaning |
|---|---|---|
| `isRecording` | boolean | True while `MediaRecorder` is active |
| `isTranscribing` | boolean | True while waiting for Whisper response |
| `error` | string \| null | Any mic or network error |

These drive the UI:
- `isRecording` → mic button turns red with a pulse animation, textarea is disabled, "Listening — speak now" banner shows
- `isTranscribing` → mic button shows "Transcribing..." and is disabled, "Transcribing with Whisper..." banner shows
- Both states together form `isListening = isRecording || isTranscribing`, which disables tone buttons, example chips, Clear button, and the submit button

### Why Whisper beats the Web Speech API for this use case

| | Web Speech API | OpenAI Whisper |
|---|---|---|
| **Browser support** | Chrome and Edge only — Firefox has zero support | Works in every browser — it's a server API call |
| **Accuracy** | Decent for clear speech, poor for names and email addresses | Significantly better, especially for dictated email content |
| **Special characters** | Cannot produce `@`, `.` — users had to say "at the rate" and rely on heuristic fixes | Whisper transcribes spoken email formats correctly |
| **Artifacts** | Produces mishearings like "milk" for "mail" with no correction | Whisper's model is trained on noisy audio and handles speech artifacts naturally |
| **Control** | Runs in Google's cloud; no control over the model or post-processing | You control the model, language hint, and can post-process the result |
| **Interim results** | Live word-by-word transcription as the user speaks | Batch only — text appears after recording stops |
| **API key required** | None — browser-native | Requires an OpenAI API key and costs ~$0.006/minute |

The only meaningful advantage of the Web Speech API is **live interim results** — text appearing in real time while the user speaks. Whisper is always a batch operation. The UI handles this trade-off by showing "Transcribing with Whisper..." feedback during the wait.

For email dictation specifically, where accuracy on addresses and names matters more than live feedback, Whisper is the correct trade-off. The `useSpeechRecognition.js` hook is preserved in the codebase as documentation of the earlier approach.

---

## 10. The Tone System

### The four tones

| Tone | Value | What it does |
|---|---|---|
| Raw | `"raw"` | Body is copied verbatim from the user's input — GPT strips the command wrapper but does not modify the content |
| Formal | `"formal"` | GPT rewrites the body in professional, polished language. Removes contractions, uses complete sentences, formal salutations if appropriate |
| Friendly | `"friendly"` | GPT rewrites in a warm, conversational tone. Contractions are fine, personal and approachable |
| Concise | `"concise"` | GPT strips everything to the core ask in one or two sentences maximum. No greetings, no sign-off, no filler |

Raw is the default because the original body faithfulness bug was caused by GPT over-writing. Raw mode is the safe baseline — it preserves intent. The other three modes are opt-in rewrites.

### How tone is implemented in openaiService.js

The `parseEmailIntent(message, tone)` function has two code paths:

**Raw tone**: uses one GPT call with a verbatim-body system prompt. `temperature: 0.1` (very low — we want consistency, not creativity).

**Formal/Friendly/Concise**: uses one GPT call with the tone instruction appended to the system prompt. `temperature: 0.2` (slightly higher — the rewrite can be slightly creative).

Both paths use `response_format: { type: 'json_object' }` to enforce JSON-only output — no preamble, no markdown, just the JSON object.

### Tone instruction examples

**Formal:**
> "Rewrite the email body in formal, professional language. Use complete sentences, proper salutations if appropriate, and polished phrasing. Avoid contractions and casual words. Example: 'Can we meet?' becomes 'I would like to request a meeting at your earliest convenience.'"

**Friendly:**
> "Rewrite the email body in a warm, friendly tone. Use natural conversational language, contractions are fine, keep it personal and approachable. Example: 'Can we meet?' becomes 'Hey! Would love to find a time to catch up — let me know when works for you!'"

**Concise:**
> "Rewrite the email body as briefly as possible — one or two sentences maximum. Strip everything except the core ask or statement. No greetings, no sign-off, no filler. Example: 'Can we meet?' stays as 'Can we meet?'"

### Tone in the UI

- Four pill-shaped toggle buttons in a row (Raw, Formal, Friendly, Concise)
- The active tone has a filled indigo background; inactive ones are outlined
- A hint line below updates as the user switches tones, explaining what each mode does
- All tone buttons are disabled while the form is loading or voice input is active

---

## 11. Backend Architecture

### server/index.js — Entry Point

```
Middleware loaded:
  cors({ origin: 'http://localhost:5000' })   ← only the Vite dev server can call the API
  express.json()                               ← parse JSON request bodies

Routes mounted:
  /api/parse      → parseRouter
  /api/send       → sendRouter
  /api/transcribe → transcribeRouter

Health check:
  GET /health     → { status: 'ok', message: '...' }
```

The `dotenv.config()` call at the top loads `.env` before any route handlers run — important because `openaiService.js` reads `process.env.OPENAI_API_KEY` on every call.

### server/routes/transcribe.js — Voice Transcription

- Uses `multer({ storage: multer.memoryStorage() })` — the audio file is held in memory (as `req.file.buffer`), never written to disk
- Wraps the buffer in an OpenAI `File` object via `toFile(buffer, 'audio.webm', { type: 'audio/webm' })`
- Calls `openai.audio.transcriptions.create({ file, model: 'whisper-1', language: 'en' })`
- Returns `{ transcript: response.text }`
- The OpenAI client is instantiated inside the route handler (not at module load time) so that `dotenv.config()` has already run before the API key is read

### server/routes/parse.js — GPT Parsing

Validation before calling OpenAI:
1. `message` must be present and non-empty (trims whitespace)
2. `tone` must be one of `['raw', 'formal', 'friendly', 'concise']`

If either check fails: `400` with a descriptive error.

Error classification for OpenAI failures:
- `429` or `quota`/`billing` in message → "OpenAI quota exceeded — add credits..."
- `401` or `API key`/`Incorrect API key` → "Invalid OpenAI API key..."
- `ETIMEDOUT`/`timeout` → "The AI took too long to respond..."
- `err.status >= 500` → "OpenAI is currently unavailable..."
- Any `err.message` → forward it directly
- Fallback → generic "Failed to parse" message

### server/routes/send.js — Email Delivery

Validation before calling Nodemailer:
1. All three fields (`to`, `subject`, `body`) must be truthy
2. `to` must match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` — rejects spaces around `@`, missing `@`, etc.

If either check fails: `400`. The email service is never called for invalid input.

### server/services/openaiService.js — GPT Logic

**`getClient()`** — creates an OpenAI instance with:
- `apiKey: process.env.OPENAI_API_KEY`
- `timeout: 20000` (20 seconds — prevents hanging requests)
- `maxRetries: 1` (one automatic retry on transient failures)

**`parseGPTResponse(raw)`** — tries `JSON.parse(raw)`. If it throws, raises a user-friendly error. This protects against GPT occasionally returning malformed JSON despite `response_format: json_object`.

**`normalise(parsed, bodyOverride)`** — standardises the four output fields:
```js
{
  to:           typeof parsed.to      === 'string' ? parsed.to.trim()      : '',
  subject:      typeof parsed.subject === 'string' ? parsed.subject.trim() : '',
  body:         bodyOverride !== null ? bodyOverride
                : (typeof parsed.body === 'string' ? parsed.body.trim() : ''),
  toConfidence: parsed.to_confidence === 'high' ? 'high' : 'low',
}
```
The defensive type-checking (`typeof ... === 'string'`) prevents crashes if GPT returns a non-string for any field. `toConfidence` defaults to `'low'` for any value that isn't the explicit string `"high"`.

**`parseEmailIntent(message, tone)`** — the exported function. Has two branches:
- `tone === 'raw'`: verbatim-body prompt, `temperature: 0.1`
- `tone === 'formal' | 'friendly' | 'concise'`: tone-rewrite prompt, `temperature: 0.2`

Both use `response_format: { type: 'json_object' }`.

**`CONFIDENCE_INSTRUCTION`** — a shared string appended to every prompt so GPT always rates its confidence on the `to` field.

**`TONE_INSTRUCTIONS`** — an object mapping each tone to its full instruction string. Keeps the prompt strings out of the function body.

### server/services/emailService.js — Nodemailer

**`checkCredentials()`** — throws with a clear message if `GMAIL_USER` or `GMAIL_APP_PASSWORD` are missing from `.env`. Called before attempting any SMTP connection, so the error is caught at the application layer rather than as a cryptic SMTP failure.

**`createTransporter()`** — creates a Nodemailer transporter. `service: 'gmail'` is a Nodemailer shortcut that automatically sets `host: 'smtp.gmail.com'` and `port: 587` — no manual SMTP config needed.

**`sendEmail({ to, subject, body })`** — builds the `mailOptions` object and calls `transporter.sendMail()`. Catches SMTP errors and classifies them into user-friendly messages (see Phase 4 section for the error table).

---

## 12. Frontend Architecture

### client/src/main.jsx

```jsx
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

The entire app is wrapped in `ErrorBoundary`. Any unhandled render error will show the fallback screen instead of a blank page.

### client/src/App.jsx

The top-level component. Owns all shared state. Renders the header, step indicator, and card shell. Delegates to `InputPanel`, `ConfirmationForm`, or the success screen based on `step`.

**Dark mode implementation:**
- `isDark` state initialised from `localStorage.getItem('theme') === 'dark'`
- A `useEffect` applies `data-theme="dark"` or `data-theme="light"` to `document.documentElement` and saves to `localStorage` whenever `isDark` changes
- All colours are CSS variables — swapping `data-theme` flips the entire colour palette
- The toggle button in the header shows a sun (dark mode) or moon (light mode) SVG icon

### client/src/components/InputPanel.jsx

Handles Step 1. Key details:

- **Character limit**: 500 characters, enforced with a counter displayed inside the textarea. The counter turns red and the submit button is disabled when over the limit
- **Voice state**: `isRecording || isTranscribing` combined into `isListening`. When `isListening` is true: textarea is `disabled`, tone buttons are `disabled`, example chips are `disabled`, Clear button is `disabled`, submit button is `disabled`
- **Mic button states**:
  - Default: outlined pill button with mic icon
  - `isRecording`: red border + red text + pulse animation via `mic-pulse` keyframe
  - `isTranscribing`: disabled with opacity 0.45
- **Recording indicator banner**: red-bordered banner with a blinking dot appears when recording or transcribing
- **Example chips**: three pre-written example prompts. Clicking one sets the message textarea directly. Chips are disabled during voice input and form loading
- **Submission**: calls `onSubmit(message.trim(), tone)` — both the message content and selected tone are passed up to `App.jsx`

### client/src/components/ConfirmationForm.jsx

Handles Step 2. Key details:

- **Initialised from `initialData`**: `useState(initialData.to)` etc. The fields start with AI-parsed values but are immediately editable
- **`canSend` guard**: `isToValid && subject.trim() !== '' && body.trim() !== '' && !isSending` — all three fields must be non-empty and `to` must pass the email regex before the Send button enables
- **Word count**: live word count on the body field — `body.trim().split(/\s+/).length`, with correct singular/plural ("1 word" vs "3 words")
- **AI badge**: a small "✦ Drafted by AI — review before sending" badge above the form. Serves as a reminder that the content came from GPT and may need review
- **`← Back` button**: calls `onBack()` — returns to the input step without clearing the parsed data (so if the user goes back and makes a small change, the parse runs again fresh)
- **`isSending` disables everything**: all inputs, Back button, and Send button get `disabled={isSending}`. Send button shows a spinner and "Sending..."

### client/src/components/StatusMessage.jsx

A reusable banner for `success`, `error`, and `info` states. Used in `App.jsx` to show errors above the current step card. Has an optional `onDismiss` prop — when provided, a × button appears. In `App.jsx`, all errors are dismissible (`onDismiss={() => setError(null)}`).

### client/src/components/ErrorBoundary.jsx

A React class component (required — error boundaries cannot be function components in React 19). Uses `getDerivedStateFromError` to capture error state and `componentDidCatch` to log to the console. The fallback UI shows the error message and a "Try again" button that clears the error state (`setState({ hasError: false })`).

### client/src/hooks/useWhisper.js

See the full explanation in [Phase 5](#9-phase-5--voice-input-whisper-vs-web-speech-api). Key internal details:

- `mediaRecorderRef` and `chunksRef` are `useRef` (not state) — they persist across renders without causing re-renders
- `stream.getTracks().forEach(t => t.stop())` is called in `onstop` to release the microphone as soon as recording ends (the browser recording indicator disappears immediately)
- `transcribe()` is async and called from `onstop`, so it runs after the recorder has fully stopped

### client/src/hooks/useSpeechRecognition.js

**Not used in the current app** — kept as documentation of the Web Speech API approach. See [Phase 5](#9-phase-5--voice-input-whisper-vs-web-speech-api) for a full comparison. Notable design from when it was active:
- `fixSpeechArtifacts(text)` — converted "at the rate" and "[at]" to `@`. This was a heuristic patch for the Web Speech API's inability to produce special characters. Whisper does not need this.

### client/src/services/api.js

Single source of all backend communication. Components never call `fetch` directly.

**`safeFetch(url, options)`** — wraps `fetch` with two guards:
1. If `fetch` itself throws (server down, no network): caught and re-thrown as "Cannot reach the server..."
2. If `response.json()` throws (server crashed and returned HTML): caught and re-thrown as "Unexpected response from server..."

**`BASE_URL`**: `import.meta.env.VITE_API_URL || ''`. When deployed, set `VITE_API_URL` to the backend's URL. In development, it's empty string — Vite's proxy (`vite.config.js`) forwards `/api/*` to `localhost:5000`.

### client/vite.config.js

```js
server: {
  proxy: {
    '/api': 'http://localhost:5000'
  }
}
```

This means in development, any request to `/api/parse` from the React app is transparently forwarded to `http://localhost:5000/api/parse`. No hardcoded localhost URLs in the frontend code — it just calls `/api/...` and Vite handles routing to the backend.

---

## 13. Styling & Design System

All styles are hand-written CSS. No Tailwind, no MUI. The design system is built on CSS custom properties (variables) defined in `App.css`.

### Design tokens — Light mode

```css
--color-primary: #4f46e5          /* Indigo — buttons, active states, focus rings */
--color-primary-hover: #4338ca    /* Darker indigo on hover */
--color-primary-light: #eef2ff    /* Very light indigo — button hover backgrounds */
--color-primary-glow: rgba(79, 70, 229, 0.15)  /* Focus ring colour */

--color-surface: #ffffff           /* Card backgrounds, input backgrounds */
--color-background: #f5f5f5        /* Page background */
--color-border: #e5e7eb            /* Input borders, dividers */

--color-text-primary: #111827      /* Main text */
--color-text-secondary: #374151    /* Secondary text (labels, etc.) */
--color-text-muted: #6b7280        /* Hints, placeholders, de-emphasised text */

--color-error: #ef4444             /* Red — validation errors */
--color-success: #22c55e           /* Green — success states */

--radius: 10px                     /* Standard border radius */
--shadow-card: 0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06)
```

### Design tokens — Dark mode

Applied via `[data-theme="dark"]` selector on `<html>`. All component styles use the variables — no colour is hardcoded in component CSS files (except a few amber/red values for the warning/error states which don't change between themes).

```css
--color-primary: #818cf8           /* Lighter indigo — readable on dark backgrounds */
--color-surface: #1e1e2e           /* Dark navy — card backgrounds */
--color-background: #13131f        /* Very dark — page background */
--color-border: #2e2e45            /* Subtle border on dark backgrounds */
--color-text-primary: #e2e8f0      /* Near-white — main text */
```

The `body` and `.app__card` have `transition: background 0.2s ease` so the theme toggle animates smoothly.

### Shared button system

Two variants, defined in `App.css`:
- `.btn--primary`: filled indigo, white text
- `.btn--ghost`: transparent, grey border, dark text

Both variants: `8px` border radius, `0.9rem` font size, inline-flex with `0.4rem` gap for icons/spinners.

The `.btn__spinner` is a CSS-animated `border-top-color` rotation (white border, spinning top segment). The `.btn__arrow` (`→`) shifts 2px right on primary button hover.

### Mic button animation

When recording (`mic-btn--active`): red border and text, plus `mic-pulse` keyframe animation:
```css
@keyframes mic-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.3); }
  50%       { box-shadow: 0 0 0 5px rgba(239, 68, 68, 0); }
}
```
The recording indicator dot uses a simple `blink` animation (opacity 1 → 0 at 50% → 1).

### Confidence warning colours

- Amber border on `To` input: `#f59e0b`, focus glow `rgba(245, 158, 11, 0.15)`
- Amber warning text: `#d97706`
- These are defined directly in `ConfirmationForm.css` (not as CSS variables) since they don't change between themes

---

## 14. Error Handling — All Layers

### Layer 1 — Client-side validation (InputPanel)
- Empty/whitespace message: submit button disabled
- Over 500 characters: textarea gets error border, char counter turns red, submit button disabled
- These are caught before any network call is made

### Layer 2 — Client-side network wrapper (api.js)
- `fetch()` throws (server unreachable): "Cannot reach the server. Make sure it is running..."
- `response.json()` throws (server returned HTML instead of JSON): "Unexpected response from server..."
- Non-`response.ok` status: re-throws `data.error` or a generic fallback message

### Layer 3 — Server-side route validation (routes/parse.js, routes/send.js)
- Missing/empty message: `400 { error: 'Message is required.' }`
- Invalid tone: `400 { error: 'Invalid tone "X"...' }`
- Missing send fields: `400 { error: 'to, subject, and body are all required.' }`
- Invalid email format in `to`: `400 { error: '"X" doesn\'t look like a valid email address.' }`

### Layer 4 — OpenAI error classification (routes/parse.js)
- Quota exceeded: friendly billing message with link
- Invalid API key: tells user to check `.env`
- Timeout: tells user to try again
- OpenAI service down (`5xx`): tells user to try again later
- JSON parse failure from GPT: "OpenAI returned a response that could not be read"

### Layer 5 — SMTP error classification (services/emailService.js)
- Missing credentials: fails before connecting, clear message about which `.env` key is missing
- Auth failure: "Gmail login failed. Your App Password may be wrong..."
- Connection failure: "Could not connect to Gmail..."
- Rejected address (`550`): "The recipient address was rejected by Gmail..."
- Unknown: "Email could not be sent: [original error]"

### Layer 6 — React error boundary (ErrorBoundary.jsx)
- Any unhandled render error in any component: shows fallback UI with the error message and a "Try again" button

### Layer 7 — UI error display (App.jsx + StatusMessage)
- All async errors (`handleInputSubmit`, `handleSend`) are caught and set to `error` state
- The `<StatusMessage type="error">` renders above the current step card
- A dismiss (×) button calls `setError(null)`
- Navigating to a new step automatically leaves the error behind (it stays visible on the current step until dismissed or until the user successfully progresses)

---

## 15. Test Suite

`server/test.js` is a standalone Node.js script that tests all backend routes by making real HTTP requests to the running server.

### How to run

```bash
# Terminal 1 — start the server
cd server && node index.js

# Terminal 2 — run tests
cd server && node test.js
```

### Test coverage

**Health check (1 test)**
- `GET /health` → `200`, `{ status: 'ok' }`

**POST /api/parse (6 tests)**
- Empty message → `400` with error
- Whitespace-only message → `400`
- Missing `message` field entirely → `400`
- Valid message with clear email → `200` with `{ to, subject, body }`, checks:
  - Email correctly extracted
  - Subject non-empty
  - Body non-empty
- Message with no email address → `200`, `to` is `""` (or GPT's reasonable guess)
- Voice-style input (`"at the rate"`) → `200`, `to` contains `@`

**POST /api/send (6 tests)**
- Missing `to` → `400`
- Missing `subject` → `400`
- Missing `body` → `400`
- Invalid email format (`"notanemail"`) → `400`
- Email with spaces around `@` (`"pranav @ gmail.com"`) → `400`
- All fields empty → `400`

**Not tested (intentionally):** the actual email delivery happy path. Sending a real email in an automated test has side effects and costs. The happy path is tested manually by running the full app.

### Test results

```
==============================================
  Email Agent — Backend API Tests
  Server: http://localhost:5000
==============================================

── Health Check
  ✓  GET /health → 200, status: ok

── POST /api/parse
  ✓  Empty message → 400 with error message
  ✓  Whitespace-only message → 400
  ✓  Missing message field → 400
  ✓  Valid message → 200 with { to, subject, body }
  ✓    AI correctly extracted email address
  ✓    AI generated a non-empty subject
  ✓    AI generated a non-empty body
  ✓  No email address in message → still returns 200
  ✓    "to" is empty string when no email found
  ✓  Voice-style input (at the rate) → email correctly extracted

── POST /api/send
  ✓  Missing "to" → 400
  ✓  Missing "subject" → 400
  ✓  Missing "body" → 400
  ✓  Invalid email format → 400
  ✓  Email with spaces around @ → 400
  ✓  All fields empty → 400

==============================================
  Results: 17/17 passed
  All tests passed ✓
==============================================
```

---

## 16. Environment Variables

All secrets live in `server/.env`. Never committed to git (listed in `server/.gitignore`).

| Variable | Example value | Required | Purpose |
|---|---|---|---|
| `OPENAI_API_KEY` | `sk-proj-...` | Yes | Authenticates calls to GPT-4o-mini and Whisper |
| `GMAIL_USER` | `yourname@gmail.com` | Yes | The Gmail account emails are sent from |
| `GMAIL_APP_PASSWORD` | `abcdefghijklmnop` | Yes | 16-character App Password (not your regular Gmail password) |
| `PORT` | `5000` | No | Server port (defaults to 5000 if not set) |

`server/.env.example` is committed to git as a template:
```env
OPENAI_API_KEY=sk-proj-...
GMAIL_USER=yourname@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
PORT=5000
```

On the frontend, `VITE_API_URL` is an optional env variable. When empty (development), Vite's proxy handles routing. When deployed, set it to the backend's URL. Vite env variables must be prefixed with `VITE_` to be accessible in the browser via `import.meta.env`.

---

## 17. API Reference

### POST /api/transcribe

Transcribes an audio recording using OpenAI Whisper.

**Request:** `multipart/form-data` with one field:
- `audio` — an audio blob (type: `audio/webm`, filename: `audio.webm`)

**Response (200):**
```json
{ "transcript": "email sarah at company dot com about the project update tell her we're on track" }
```

**Response (400):**
```json
{ "error": "No audio file received." }
```

---

### POST /api/parse

Parses a natural language message into structured email fields.

**Request body:**
```json
{
  "message": "Email john@example.com about the Friday meeting",
  "tone": "formal"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `message` | string | Yes | The user's natural language input |
| `tone` | string | No | `"raw"` (default) · `"formal"` · `"friendly"` · `"concise"` |

**Response (200):**
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
| `subject` | Generated subject line (inferred from context) |
| `body` | Email body — verbatim in Raw mode, rewritten in Formal/Friendly/Concise |
| `toConfidence` | `"high"` if GPT found a complete, clearly stated address; `"low"` otherwise |

**Response (400):**
```json
{ "error": "Message is required." }
```

**Response (500):**
```json
{ "error": "OpenAI quota exceeded — no API credits remaining. Add credits at platform.openai.com/settings/billing." }
```

---

### POST /api/send

Sends an email via Gmail SMTP.

**Request body:**
```json
{
  "to": "john@example.com",
  "subject": "Friday Meeting",
  "body": "I would like to discuss the Friday meeting."
}
```

All three fields are required. `to` must be a valid email address format.

**Response (200):**
```json
{
  "success": true,
  "messageId": "<abc123@gmail.com>"
}
```

**Response (400):**
```json
{ "error": "\"notanemail\" doesn't look like a valid email address." }
```

**Response (500):**
```json
{ "error": "Gmail login failed. Your App Password may be wrong or expired. Go to your Google Account → Security → App Passwords and generate a new one." }
```

---

### GET /health

Health check.

**Response (200):**
```json
{ "status": "ok", "message": "Email Agent server is running" }
```

---

## 18. Complete Bug & Fix Log

| # | When | Bug | Root cause | Fix |
|---|---|---|---|---|
| 1 | Phase 1 | Regex extracted `1725@gmail.com` from `Pranav Dubey 1725@gmail.com` — username lost | Regex matches structural tokens, not meaning | Replaced entire NLP pipeline with GPT-4o-mini |
| 2 | Phase 1 | `pranav at gmail dot com` → nothing found | Spoken email format does not match regex | Same fix — GPT understands spoken email descriptions |
| 3 | Phase 1 | `1725 @ gmail.com` → nothing found | Spaces around `@` break regex pattern | Same fix |
| 4 | Phase 1 | `tell him I'll be late` → total failure | NLP has no world knowledge, cannot resolve pronouns | Same fix — GPT handles implicit references gracefully |
| 5 | Phase 2 | GPT body contained `[Your Name]` placeholder | System prompt said "expand into a professional email" | Rewrote prompt: "copy exact words verbatim, strip command wrapper only" |
| 6 | Phase 2 | GPT body added filler phrases user never said | Same root cause | Same fix |
| 7 | Phase 3 | Guessed email addresses looked identical to correctly read ones | No confidence signal from GPT | Added `to_confidence` to GPT output, amber UI warning when `"low"` |
| 8 | Phase 5 | Web Speech API voice input worked only in Chrome/Edge | Firefox has no SpeechRecognition implementation | Replaced with Whisper via MediaRecorder + POST to /api/transcribe |
| 9 | Phase 5 | Web Speech API couldn't produce `@` or `.` characters | Browser API doesn't support special character output | Same fix — Whisper transcribes spoken email addresses correctly |

---

## 19. Key Design Decisions Summary

| Decision | What we chose | Why |
|---|---|---|
| AI parsing | GPT-4o-mini (one API call) | NLP/regex cannot understand meaning; GPT handles all edge cases |
| AI model size | gpt-4o-mini over gpt-4o | ~10× cheaper, faster, still highly capable for structured JSON extraction |
| Body faithfulness | Verbatim copy in Raw mode | User is the author; GPT is the transcriber. "Expand intent" led to unfaithful output |
| Confidence flagging | GPT self-rates + amber UI warning | A wrong email address is the worst failure mode; surface uncertainty at exactly that field |
| Voice transcription | OpenAI Whisper | Browser accuracy on email addresses/names is poor; Whisper works in all browsers |
| Email delivery | Nodemailer + Gmail SMTP | Zero account setup, free, no domain verification; appropriate for a demo |
| Auth method for Gmail | App Password | Required since May 2022; scoped to SMTP only; stored in .env |
| Tone system | Four explicit modes (Raw default) | Gives user control over GPT rewriting; Raw is safe default after body faithfulness bug |
| API layer on frontend | `api.js` wrapper | Components never touch fetch; network errors are handled in one place |
| Error boundary | React class component | Required API; protects against any render crash showing a blank page |
| CSS approach | Variables + hand-written CSS | App is simple enough that a framework adds more weight than value |
| Dark mode | CSS variables + data-theme on `<html>` | Single attribute flip changes the entire colour palette; preference persisted in localStorage |
| Test strategy | Real HTTP calls against live server | Tests that work are more valuable than tests that mock everything; SMTP happy path tested manually |

---

*Last updated: 2026-04-09*
*Covers: every file in the project as of this date*
