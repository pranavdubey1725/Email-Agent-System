# Email Agent — Full Project Report

> **Purpose:** The single authoritative reference for everything about this project. Every file, every design decision, every bug encountered and fixed, every architectural trade-off. Use this as the source of truth when writing other documentation.

---

## Table of Contents

1. [What We Built](#1-what-we-built)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [The User Flow](#4-the-user-flow)
5. [Phase 1 — The NLP Approach: What We Tried and Why It Failed](#5-phase-1--the-nlp-approach-what-we-tried-and-why-it-failed)
6. [Phase 2 — GPT Integration and the Body Faithfulness Bug](#6-phase-2--gpt-integration-and-the-body-faithfulness-bug)
7. [Phase 3 — Confidence Flagging](#7-phase-3--confidence-flagging)
8. [Phase 4 — Email Delivery via Gmail API](#8-phase-4--email-delivery-via-gmail-api)
9. [Phase 5 — Voice Input: Whisper vs Web Speech API](#9-phase-5--voice-input-whisper-vs-web-speech-api)
10. [Phase 6 — Google OAuth 2.0](#10-phase-6--google-oauth-20)
11. [The Tone System](#11-the-tone-system)
12. [Backend Architecture](#12-backend-architecture)
13. [Frontend Architecture](#13-frontend-architecture)
14. [Styling & Design System](#14-styling--design-system)
15. [Error Handling — All Layers](#15-error-handling--all-layers)
16. [Test Suite](#16-test-suite)
17. [Environment Variables](#17-environment-variables)
18. [API Reference](#18-api-reference)
19. [Complete Bug & Fix Log](#19-complete-bug--fix-log)
20. [Key Design Decisions Summary](#20-key-design-decisions-summary)

---

## 1. What We Built

An intelligent email agent with a four-phase flow:

1. **Sign in** — user authenticates with Google OAuth 2.0
2. **Input** — user describes their email in plain English, by typing or speaking
3. **Review** — GPT parses the description into structured fields (`to`, `subject`, `body`); the user can edit before sending
4. **Sent** — the Gmail API delivers the email from the user's own Gmail account

The core value: a user can say *"Email sarah@company.com about the project update, tell her we're on track"* and receive a correctly addressed, properly written email delivered from their own Gmail — without touching a traditional email compose form.

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
| googleapis | — | Gmail API (send) and Google OAuth 2.0 |
| multer | 2.1.1 | Multipart form parsing (audio file upload) |
| cors | 2.8.6 | Cross-origin requests from the React frontend |
| dotenv | 17.4.1 | Environment variable loading from `.env` |

### External Services
| Service | What it does |
|---|---|
| Google OAuth 2.0 | Authenticates users with their Google account |
| Gmail API | Sends emails on behalf of the authenticated user |
| OpenAI GPT-4o-mini | Parses natural language into `{ to, subject, body, to_confidence }` |
| OpenAI Whisper (`whisper-1`) | Transcribes voice recordings to text |

### Why these choices
- **React 19 + Vite**: fastest dev setup, modern React with hooks, no class components needed
- **Express 5**: minimal overhead, straightforward routing — no need for a heavier framework for four routes
- **GPT-4o-mini over GPT-4o**: cheaper per call (~$0.0002), faster, still highly capable for structured extraction tasks
- **Gmail API over SMTP**: sends from the user's own Gmail, no shared credentials, Google's recommended approach for modern apps
- **googleapis over raw HTTP**: handles OAuth token refresh automatically, official Google SDK with full type support
- **No CSS framework**: the UI is simple enough that Tailwind or MUI would add more weight than value; hand-written CSS with CSS variables gives full control

---

## 3. Project Structure

```
email-agent/
│
├── client/                              # React frontend (Vite)
│   ├── index.html                       # Single HTML shell; React mounts into <div id="root">
│   ├── vite.config.js                   # Proxy /api → localhost:5000 in dev
│   ├── .env.local                       # VITE_API_URL=http://localhost:5000 (local dev only, not in git)
│   ├── package.json                     # React 19, Vite, ESLint
│   └── src/
│       ├── main.jsx                     # Entry: wraps <App> in <ErrorBoundary>
│       ├── App.jsx                      # Auth state, step machine, dark mode
│       ├── App.css                      # Global layout, design tokens, shared button styles
│       ├── index.css                    # Minimal reset (box-sizing, margin: 0)
│       ├── components/
│       │   ├── Login.jsx                # Google sign-in screen (shown when not authenticated)
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
│           └── api.js                   # All fetch() calls; stores and sends X-Session-Id header
│
├── server/                              # Express backend
│   ├── index.js                         # Server entry: middleware, route mounting, CORS, health check
│   ├── package.json                     # Express, OpenAI, googleapis, multer, cors, dotenv
│   ├── .env                             # Secrets (not in git): OPENAI_API_KEY, GOOGLE_* vars
│   ├── .env.example                     # Template showing all required keys
│   ├── test.js                          # Backend API test script (19 tests, all passing)
│   ├── routes/
│   │   ├── auth.js                      # GET /auth/google, /auth/google/callback, /auth/me, POST /auth/logout
│   │   ├── transcribe.js                # POST /api/transcribe — receives audio blob, calls Whisper
│   │   ├── parse.js                     # POST /api/parse — validates, calls openaiService
│   │   └── send.js                      # POST /api/send — verifies session, validates, calls gmailService
│   └── services/
│       ├── sessionStore.js              # In-memory session Map (UUID → tokens + profile)
│       ├── gmailService.js              # Gmail API send, RFC 2822 encoding, error classification
│       └── openaiService.js             # GPT-4o-mini parsing logic, prompt construction, tone handling
│
└── docs/
    ├── FULL_PROJECT_REPORT.md           # This file
    ├── NLP_FINDINGS.md                  # Why regex + NLP failed (6 failure cases)
    ├── WEBSPEECH_FINDINGS.md            # Why Web Speech API was replaced by Whisper
    ├── OPENAI_FINDINGS.md               # Why GPT-4o-mini, capability comparison
    ├── CONFIDENCE_FLAGGING.md           # Confidence flagging design and implementation
    ├── EMAIL_SERVICE_REPORT.md          # Gmail API, OAuth 2.0, session management
    └── TESTS.md                         # All tests (automated + manual), bugs found and fixed
```

---

## 4. The User Flow

The app is a state machine with four states managed in `App.jsx`:

```
'unauthenticated'  →  'input'  →  'confirmation'  →  'sent'
```

### Authentication state

Before the app content is shown, `App.jsx` checks authentication on mount:

```js
const sessionId = sessionFromUrl || localStorage.getItem('sessionId');
setSessionId(sessionId);
const me = await getMe(); // GET /auth/me
if (me) setUser(me);      // signed in — show app
else    setUser(null);     // not signed in — show Login screen
```

If not signed in: `<Login>` is shown inside the card — a Google sign-in button that redirects to `/auth/google`.

If signed in: the full step UI is shown with the user's email and a "Sign out" button in the header.

### Step state variables in App.jsx

| State | Type | Purpose |
|---|---|---|
| `user` | `{ email, name } \| null` | Signed-in user profile; null = show Login screen |
| `authChecked` | boolean | Prevents flashing login screen while session is being verified |
| `step` | `'input' \| 'confirmation' \| 'sent'` | Controls which view is shown |
| `isLoading` | boolean | True while GPT is parsing |
| `isSending` | boolean | True while Gmail API is sending |
| `error` | string \| null | Any error message shown in `<StatusMessage>` |
| `parsedEmail` | `{ to, subject, body, toConfidence }` | The AI-parsed result; passed into `ConfirmationForm` |
| `sentTo` | string | Recipient — shown in success screen |
| `isDark` | boolean | Dark mode toggle, persisted to `localStorage` |

### Step transitions

- **Login → input**: after OAuth callback, `?session=` param is read, verified, user set
- **input → confirmation**: `handleInputSubmit()` calls `parseMessage()`, receives AI-parsed fields
- **confirmation → sent**: `handleSend()` calls `sendEmail()`, Gmail API delivers
- **confirmation → input**: Back button calls `setStep('input')` directly
- **sent → input**: "Send another email" calls `handleStartOver()`, resets all state
- **any step → login**: "Sign out" calls `logout()`, clears localStorage, resets to `user = null`

---

## 5. Phase 1 — The NLP Approach: What We Tried and Why It Failed

Before building the GPT pipeline, we tried parsing email intent using:
- **Regular expressions** to extract email addresses
- **compromise.js** (an NLP library) to identify recipients, extract named entities, and parse sentence structure

### What broke and why

| Input | Expected | Actual result | Root cause |
|---|---|---|---|
| `Pranav Dubey 1725@gmail.com` | `pranavdubey1725@gmail.com` | `1725@gmail.com` (name lost) | Regex matches structural tokens, not meaning |
| `pranav at gmail dot com` | `pranav@gmail.com` | Nothing found | Spoken format doesn't structurally resemble an email |
| `1725 @ gmail.com` | `1725@gmail.com` | Nothing found | Spaces around `@` break the regex |
| `send an email to John saying hi` | `to: ""`, `body: "hi"` | Could not distinguish | compromise.js has no concept of command structure |
| `tell him I'll be late` | Body extracted, `to` empty | Complete failure | Cannot resolve pronouns |
| `milk to pranav at the rate gmail.com` | Corrects "milk"→"mail" | Total failure | Speech artifacts require semantic correction |

### Why we stopped

Every fix was a patch over the same root cause: **pattern matching cannot understand meaning**. The switch to GPT replaced hundreds of lines of regex and NLP code with a single API call that understands natural language the way a human does.

---

## 6. Phase 2 — GPT Integration and the Body Faithfulness Bug

### The bug

The first GPT system prompt instructed: *"Write a complete, professional email body."*

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

Problems: filler phrases the user never said, a `[Your Name]` placeholder, and the user's actual intent buried in generic corporate language.

### The fix

Rewrote the system prompt: *"body: ONLY the message the user wants to send — copy their exact words verbatim. Strip the command wrapper and return just the content. Do NOT rephrase, expand, or modify in any way."*

**Same input after fix:** `Hi, let's catch up.`

### Lesson

The correct mental model: **GPT is the transcriber and formatter, not the author.** The user is the author. The Tone system was built later to offer opt-in rewriting in a controlled way.

---

## 7. Phase 3 — Confidence Flagging

### The problem

Not all GPT extractions are equally reliable. A correctly read address (`john@company.com`) and a guessed one (`pranav@gmail.com` reconstructed from `"mail to pranav at the rate gmail dot com"`) both appear in the same `To` field with no distinction. Without flagging, the user has no signal that one needs careful review. A wrong `To` address means the email goes to the wrong person.

### The four-layer solution

**Layer 1 — GPT rates itself:** `to_confidence` is a fourth JSON field. GPT uses `"high"` only when a literal `@` address was present. `"low"` for anything reconstructed, guessed, or absent.

**Layer 2 — Backend deterministic override:** if the extracted `to` contains `@` but the original `message` doesn't, it was reconstructed — force `"low"` regardless of GPT's self-rating:

```js
const addressWasInInput = message.includes('@');
const toConfidence = (gptSaysHigh && (to === '' || addressWasInInput)) ? 'high' : 'low';
```

**Layer 3 — toConfidence travels the full stack:**
```
openaiService.normalise() → routes/parse.js → api.js → App.jsx → ConfirmationForm
```

**Layer 4 — Amber warning in the UI:** `To` input gets an amber border + warning when confidence is `"low"`. Warning disappears as soon as the user edits the field.

### Priority order of To field messages

| Condition | Message | Colour |
|---|---|---|
| Value present but fails email regex | "Please enter a valid email address." | Red |
| Low confidence AND value present AND user hasn't edited | "AI wasn't certain about this address — please verify it." | Amber |
| Field is completely empty | "The AI couldn't find an email address — please enter one." | Amber |

---

## 8. Phase 4 — Email Delivery via Gmail API

### What happens when the user clicks Send Email

```
ConfirmationForm.onSend({ to, subject, body })
  → App.jsx handleSend()
  → api.js sendEmail() [POST /api/send, X-Session-Id header]
  → server/routes/send.js
      → getSession(sessionId) — looks up token in memory
      → validation: all fields present?
      → validation: email format valid?
  → server/services/gmailService.js sendEmailViaGmail()
      → buildAuth(accessToken, refreshToken) — creates OAuth2 client
      → buildRawMessage() — RFC 2822, base64url encoded
      → gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
          → Gmail API authenticates with the user's access token
          → Email sent from the user's own Gmail account
          → Returns Gmail message ID
  → res.json({ success: true, messageId })
  → App.jsx: step = 'sent', sentTo = emailData.to
```

### Why Gmail API over SMTP

| | SMTP + App Password (old) | Gmail API + OAuth (current) |
|---|---|---|
| Sends from | One fixed account | Signed-in user's own Gmail |
| Credentials | App Password in `.env` | OAuth tokens (no password stored) |
| Multi-user | No | Yes |
| IPv6 on Render | ENETUNREACH error | Not an issue — HTTPS to Google's API |
| Revocable | Only by deleting App Password | User revokes from Google Account |

---

## 9. Phase 5 — Voice Input: Whisper vs Web Speech API

The project has two voice hooks. Only `useWhisper.js` is active.

### How Whisper works in this project

1. **Browser records audio**: `navigator.mediaDevices.getUserMedia({ audio: true })` → `MediaRecorder` → chunks collected in `chunksRef`
2. **Client-side silence check**: before sending to Whisper, `hasSpeech(blob)` computes RMS amplitude. If `rms < 0.01` (below any normal speech level), the recording is silently discarded — no API call made
3. **POST to backend**: `FormData` with the blob → `POST /api/transcribe`
4. **Server calls Whisper**: `multer` receives the file in memory, wraps buffer in `toFile()`, calls `openai.audio.transcriptions.create({ model: 'whisper-1', language: 'en' })`
5. **Server-side hallucination filter**: if Whisper returns a phrase starting with `"thank(s| you) for watching"` (a known silence hallucination from YouTube training data), it's replaced with `""`
6. **Transcript appears in textarea**: `onTranscriptChange(transcript)` sets the message state in `InputPanel`

### Why Whisper beats the Web Speech API for this use case

| | Web Speech API | OpenAI Whisper |
|---|---|---|
| Browser support | Chrome/Edge only — Firefox not supported | All modern browsers |
| Produces `@`, `.` | No — users had to say "at the rate" | Yes |
| Accuracy on email addresses | Poor | Good |
| Control over model | None — black box | Model version, language, prompt |
| Interim results | Live word-by-word | Batch only |
| Cost | Free | ~$0.006/minute |

The only meaningful advantage of the Web Speech API is live interim results. For email dictation, accuracy on addresses matters more.

---

## 10. Phase 6 — Google OAuth 2.0

### Why it was added

The original SMTP approach sent all emails from one fixed Gmail account. Adding OAuth meant each user could sign in and send from their own Gmail.

### The OAuth flow

```
1. User clicks "Sign in with Google"
   → Login.jsx: window.location.href = BASE_URL + '/auth/google'

2. Backend builds Google consent URL
   → Scopes: openid, userinfo.email, userinfo.profile, gmail.send
   → access_type: 'offline' (gets a refresh token)
   → prompt: 'consent' (always return fresh refresh token)
   → res.redirect(consentUrl)

3. Google shows consent screen — user approves

4. Google redirects to GOOGLE_REDIRECT_URI with ?code=...

5. Backend exchanges code for tokens
   → auth.getToken(code) → { access_token, refresh_token }
   → Fetches user profile: oauth2.userinfo.get()

6. Backend creates session
   → createSession({ accessToken, refreshToken, email, name })
   → Returns UUID session ID

7. Backend redirects to frontend
   → res.redirect(FRONTEND_URL + '?session=' + sessionId)

8. Frontend picks up session
   → Reads ?session= from URL
   → localStorage.setItem('sessionId', sessionId)
   → Verifies with GET /auth/me
   → Sets user state → shows the app
```

### Session storage

`sessionStore.js` uses a `Map` in memory. Session IDs are `crypto.randomUUID()` UUIDs. No database needed for a demo. Sessions are lost on server restart — users must sign in again.

### X-Session-Id header

All API calls from the frontend include `X-Session-Id: <session id>` as a custom header. This works cleanly across the Vercel/Render cross-origin deployment without requiring `withCredentials` or cookie handling.

---

## 11. The Tone System

### The four tones

| Tone | Value | What it does |
|---|---|---|
| Raw | `"raw"` | Body copied verbatim — GPT strips command wrapper only |
| Formal | `"formal"` | GPT rewrites in professional, polished language |
| Friendly | `"friendly"` | GPT rewrites in warm, conversational tone |
| Concise | `"concise"` | GPT strips to the core ask in one or two sentences |

Raw is the default because the original body faithfulness bug was caused by GPT over-writing. Raw is the safe baseline — it preserves intent.

### Implementation in openaiService.js

Two code paths:
- **Raw**: verbatim-body system prompt, `temperature: 0.1`
- **Formal/Friendly/Concise**: tone instruction appended to system prompt, `temperature: 0.2`

Both paths use `response_format: { type: 'json_object' }` to enforce JSON-only output.

---

## 12. Backend Architecture

### server/index.js — Entry Point

```
dns.setDefaultResultOrder('ipv4first')  ← Render free tier IPv6 workaround

Middleware:
  cors({ origin: allowedOrigins, allowedHeaders: ['Content-Type', 'X-Session-Id'] })
  express.json()

Routes:
  /auth           → authRouter   (OAuth flow)
  /api/parse      → parseRouter
  /api/send       → sendRouter   (requires X-Session-Id)
  /api/transcribe → transcribeRouter

Health check:
  GET /health → { status, message, frontendUrl, redirectUri }
```

### server/routes/auth.js — OAuth Flow

Four endpoints:
- `GET /auth/google` — generates and redirects to Google consent URL
- `GET /auth/google/callback` — exchanges code for tokens, creates session, redirects to frontend with `?session=`
- `GET /auth/me` — returns `{ email, name }` for the current session (used to verify sessions on page load)
- `POST /auth/logout` — deletes the session from the store

### server/routes/send.js — Email Delivery

Auth check first:
```js
const session = getSession(req.headers['x-session-id']);
if (!session) return res.status(401).json({ error: '...' });
```
Then field validation (all three fields present, email format valid), then `sendEmailViaGmail()`.

### server/services/sessionStore.js

```js
const sessions = new Map();
createSession(data)  → crypto.randomUUID(), stores { ...data, createdAt }
getSession(id)       → returns session or null
deleteSession(id)    → removes from Map
```

### server/services/gmailService.js

```js
buildAuth(accessToken, refreshToken)
  → new google.auth.OAuth2(...).setCredentials(...)

buildRawMessage({ senderName, senderEmail, to, subject, body })
  → RFC 2822 formatted, Buffer.from(...).toString('base64url')

sendEmailViaGmail({ accessToken, refreshToken, senderName, senderEmail, to, subject, body })
  → gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
```

### server/services/openaiService.js

- **`getClient()`**: OpenAI instance with 20s timeout and 1 retry
- **`parseGPTResponse(raw)`**: `JSON.parse()` with user-friendly error on failure
- **`normalise(parsed, message, bodyOverride)`**: type-checks all fields, applies deterministic `@`-in-input confidence check
- **`parseEmailIntent(message, tone)`**: two-branch function (raw vs tone modes)

---

## 13. Frontend Architecture

### client/src/App.jsx

Top-level component. Manages auth state, step state, dark mode. On mount:
1. Reads `?session=` from URL or `localStorage`
2. Sets session ID in `api.js`
3. Calls `getMe()` to verify
4. Sets `user` state — renders `<Login>` or the full step UI accordingly

**Dark mode:** `isDark` state from `localStorage`; `useEffect` applies `data-theme` to `<html>` and persists.

### client/src/components/Login.jsx

Shown when `user === null`. Single Google sign-in button:
```js
window.location.href = `${BASE_URL}/auth/google`;
```
Full-page redirect — Google OAuth doesn't work in `fetch` or iframes.

### client/src/components/InputPanel.jsx

Step 1. Character limit (500), voice state management, tone selector, example chips, submit. Calls `onSubmit(message.trim(), tone)`.

### client/src/components/ConfirmationForm.jsx

Step 2. Initialised from `initialData`. `canSend` guard ensures all fields are valid. Live word count on body. AI badge. Confidence warning on `To`. `userEditedTo` state dismisses the warning on edit.

### client/src/services/api.js

All backend communication. Module-level `_sessionId` variable set by `setSessionId()`. Every `safeFetch` call attaches `X-Session-Id` if set. Exports: `parseMessage`, `sendEmail`, `getMe`, `logout`, `setSessionId`, `getSessionId`.

**`BASE_URL`**: `import.meta.env.VITE_API_URL || ''`. Set to `http://localhost:5000` in `client/.env.local` for local dev; set on Vercel for production.

---

## 14. Styling & Design System

All styles are hand-written CSS. No Tailwind, no MUI.

### Design tokens — Light mode

```css
--color-primary: #4f46e5          /* Indigo — buttons, active states, focus rings */
--color-surface: #ffffff           /* Card backgrounds */
--color-background: #f5f5f5        /* Page background */
--color-text-primary: #111827      /* Main text */
--color-error: #ef4444             /* Red — validation errors */
```

### Design tokens — Dark mode

```css
--color-primary: #818cf8           /* Lighter indigo */
--color-surface: #1e1e2e           /* Dark navy */
--color-background: #13131f        /* Very dark */
--color-text-primary: #e2e8f0      /* Near-white */
```

Applied via `[data-theme="dark"]` on `<html>`. All component styles use variables — no colour hardcoded in components (except amber/red warning values which don't change between themes).

### New styles for auth (App.css additions)

- `.login-screen` — centred card layout for the sign-in screen
- `.btn--google` — white button with Google logo SVG, dark-mode aware
- `.user-info` — email + sign-out button in the header
- `.app__header-right` — flex container for user info + dark mode toggle
- `.btn--sm` — smaller padding variant for the sign-out button

---

## 15. Error Handling — All Layers

### Layer 1 — Client-side validation (InputPanel)
- Empty/whitespace message: submit button disabled
- Over 500 characters: error border, char counter red, submit disabled

### Layer 2 — Client-side network wrapper (api.js)
- `fetch()` throws (server unreachable): "Cannot reach the server..."
- `response.json()` throws (server returned HTML): "Unexpected response from server..."
- Non-`ok` status: re-throws `data.error` or generic fallback

### Layer 3 — Auth check (routes/send.js)
- Missing session: `401 { error: 'Not signed in. Please sign in with Google first.' }`
- Invalid/expired session: `401 { error: 'Session expired.' }`

### Layer 4 — Server-side route validation
- Missing/empty message: `400 { error: 'Message is required.' }`
- Invalid tone: `400 { error: 'Invalid tone "X"...' }`
- Missing send fields: `400 { error: 'to, subject, and body are all required.' }`
- Invalid email format: `400 { error: '"X" doesn\'t look like a valid email address.' }`

### Layer 5 — OpenAI error classification (routes/parse.js)
- Quota exceeded: billing message
- Invalid API key: check `.env` message
- Timeout: try again message
- Service down: try again later
- JSON parse failure: "OpenAI returned a response that could not be read"

### Layer 6 — Gmail API error classification (services/gmailService.js)
- `401` / `invalid_grant`: "Your Google session has expired. Please sign in again."
- `403` / `insufficientPermissions`: "Gmail permission denied. Please sign in again."
- Invalid `To`: "The recipient address was rejected by Gmail."
- Unknown: "Email could not be sent: [original error]"

### Layer 7 — React error boundary (ErrorBoundary.jsx)
- Any unhandled render error: fallback UI with "Try again" button

### Layer 8 — UI error display (App.jsx + StatusMessage)
- All async errors caught and set to `error` state
- `<StatusMessage type="error">` renders above the current step card
- Dismiss (×) button calls `setError(null)`

---

## 16. Test Suite

`server/test.js` — 19 automated tests against the running server.

### Test coverage

**Health check (1)**
- `GET /health` → 200, `{ status: 'ok' }`

**GET /auth/me (2)**
- No session header → 401
- Invalid session ID → 401

**POST /auth/logout (2)**
- No session → 200 (idempotent)
- Fake session ID → 200 (idempotent)

**POST /api/parse (8 + 2 sub-tests)**
- Empty message → 400
- Whitespace-only → 400
- Missing field → 400
- Valid message → 200 with `{ to, subject, body }`
  - Email correctly extracted
  - Subject non-empty
  - Body non-empty
- No email address → 200, `to` is `""`
- Voice-style input (`"at the rate"`) → 200, `to` contains `@`
- `toConfidence` field present (`"high"` or `"low"`)
- Literal `@` in input → `toConfidence === "high"`

**POST /api/send (2)**
- No session header → 401
- Invalid session ID → 401

**Not automated:** field validation (400s) for send requires a real OAuth session. Verified manually.

---

## 17. Environment Variables

### server/.env

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | OpenAI API key for GPT and Whisper |
| `GOOGLE_CLIENT_ID` | Yes | OAuth 2.0 client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth 2.0 client secret |
| `GOOGLE_REDIRECT_URI` | Yes | Where Google redirects after consent (`/auth/google/callback`) |
| `FRONTEND_URL` | Production | Your Vercel app URL — used for OAuth redirect and CORS |
| `PORT` | No | Server port (defaults to 5000) |

**`GMAIL_USER` and `GMAIL_APP_PASSWORD` are no longer needed** — removed when OAuth replaced SMTP.

### client/.env.local (local dev only, not in git)

| Variable | Value |
|---|---|
| `VITE_API_URL` | `http://localhost:5000` |

### Vercel environment variables

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://email-agent-system-8kix.onrender.com` |

---

## 18. API Reference

### `GET /auth/google`
Redirects browser to Google OAuth consent screen.

### `GET /auth/google/callback`
Receives the auth code from Google, exchanges for tokens, creates session, redirects to `FRONTEND_URL?session=<id>`. On error, redirects to `FRONTEND_URL?error=<message>`.

### `GET /auth/me`
**Headers:** `X-Session-Id: <id>`
**Response:** `{ email, name }` or `401`.

### `POST /auth/logout`
**Headers:** `X-Session-Id: <id>`
**Response:** `{ success: true }`. Always 200 (idempotent).

### `POST /api/transcribe`
**Request:** `multipart/form-data`, field `audio` (webm blob)
**Response:** `{ transcript: "..." }` — empty string for silent recordings.

### `POST /api/parse`
**Request:** `{ message: string, tone?: 'raw'|'formal'|'friendly'|'concise' }`
**Response:** `{ to, subject, body, toConfidence: 'high'|'low' }`
**Errors:** 400 for missing/empty message, 400 for invalid tone.

### `POST /api/send`
**Headers:** `X-Session-Id: <id>`
**Request:** `{ to, subject, body }`
**Response:** `{ success: true, messageId: string }`
**Errors:** 401 if not authenticated, 400 if fields invalid.

### `GET /health`
**Response:** `{ status: 'ok', message: string, frontendUrl: string, redirectUri: string }`

---

## 19. Complete Bug & Fix Log

### Bug 1 — Body faithfulness: GPT over-writing user content
**Phase:** 2  
**Symptom:** GPT replaced the user's words with a generic professional email template, including `[Your Name]` placeholder.  
**Root cause:** System prompt said "write a professional email" — GPT interpreted this as full authorship.  
**Fix:** Rewrote prompt to "copy exact words verbatim, strip command wrapper only."

---

### Bug 2 — Confidence warning not showing for spoken/reconstructed addresses
**Phase:** 3  
**Input:** `mail to pranav at the rate gmail dot com`  
**Symptom:** `pranav@gmail.com` extracted correctly but no amber warning shown.  
**Root cause:** GPT rated itself `"high"` because it successfully reconstructed the address.  
**Fix:** Deterministic override — if `to` contains `@` but original `message` doesn't, force `"low"`.

---

### Bug 3 — Silent audio returned "Thanks for watching!"
**Phase:** 5  
**Symptom:** Recording silence and stopping gave "Thanks for watching!" in the textarea.  
**Root cause:** Whisper trained heavily on YouTube content — hallucinates sign-offs for silence.  
**Fix attempt 1:** Server-side blocklist in `transcribe.js` — matched exact phrases. Some variants escaped.  
**Final fix:** Client-side `hasSpeech()` RMS amplitude check — if `rms < 0.01`, skip Whisper entirely. Server filter kept as backup with broader regex.

---

### Bug 4 — Whisper hallucinating random phrases after silence filter
**Phase:** 5  
**Symptom:** Longer variants like "Thank you for watching and don't forget to like and subscribe!" escaped the blocklist.  
**Root cause:** Blocklist could only match known phrases — Whisper can hallucinate anything.  
**Fix:** Client-side amplitude detection — silence never reaches the API. Server filter broadened to `^thank(s| you) for watching`.

---

### Bug 5 — CORS error in production (Vercel → Render)
**Phase:** Deployment  
**Symptom:** `Access to fetch blocked by CORS policy` in browser console.  
**Root cause:** `FRONTEND_URL` on Render set to wrong Vercel URL (`email-agent-system-three.vercel.app` instead of current URL).  
**Fix:** Corrected `FRONTEND_URL` env var on Render.

---

### Bug 6 — ENETUNREACH IPv6 on Gmail SMTP
**Phase:** Deployment (SMTP era)  
**Symptom:** `connect ENETUNREACH 2607:f8b0:400e:c09::6c:465`  
**Root cause:** Render free tier doesn't support IPv6; Gmail SMTP resolved to IPv6 address.  
**Fix:** `dns.setDefaultResultOrder('ipv4first')` in `server/index.js`. Moot after OAuth migration.

---

### Bug 7 — OAuth redirecting to localhost after production deploy
**Phase:** OAuth deployment  
**Symptom:** After Google sign-in on the deployed Vercel app, browser redirected to `http://localhost:5173`.  
**Root cause:** `FRONTEND_URL` on Render was still the old Vercel URL; `GOOGLE_REDIRECT_URI` was still the localhost value.  
**Fix:** Updated both env vars on Render to the correct production URLs.

---

### Bug 8 — `redirect_uri_mismatch` after updating Render env vars
**Phase:** OAuth deployment  
**Symptom:** Google showed "Error 400: redirect_uri_mismatch".  
**Root cause:** The production `GOOGLE_REDIRECT_URI` (`https://...onrender.com/auth/google/callback`) was set on Render but not registered as an Authorized redirect URI in Google Cloud Console.  
**Fix:** Added the production URI to the OAuth client's Authorized redirect URIs in Google Cloud Console.

---

## 20. Key Design Decisions Summary

| Decision | What we chose | Why |
|---|---|---|
| Email parsing | GPT-4o-mini | Pattern matching and NLP libraries failed on 6 core cases |
| Voice transcription | OpenAI Whisper | Web Speech API: Firefox not supported, can't produce `@` |
| Silence detection | Client-side RMS amplitude | Server blocklist can't cover all Whisper hallucinations |
| Tone system | 4 opt-in modes (Raw default) | Body faithfulness bug showed GPT over-writes without explicit instruction |
| Confidence flagging | Deterministic `@`-in-input override | GPT self-rating unreliable for reconstructed addresses |
| Email delivery | Gmail API + OAuth 2.0 | SMTP sent from one fixed account; OAuth sends from user's own Gmail |
| Auth method | Google OAuth 2.0 | No stored passwords; user-controlled revocable access; `gmail.send` scope only |
| Session transport | `X-Session-Id` header | Simpler than cookies across Vercel/Render cross-origin deployment |
| Session storage | In-memory `Map` | No database needed for a demo; acceptable that sessions reset on restart |
| Styling | Hand-written CSS + variables | UI simple enough that a framework adds weight without value |
| Deployment | Render (backend) + Vercel (frontend) | Free tiers, separate scaling, standard split architecture |

---

*Last updated: 2026-04-10*
