# Testing — Automated & Manual

> **Purpose:** Complete record of every test run on this project — the automated backend suite, all manual UI tests, bugs found during testing, and fixes applied.

---

## Table of Contents

1. [Automated Backend Tests](#1-automated-backend-tests)
2. [Manual UI Tests](#2-manual-ui-tests)
3. [Bugs Found During Testing](#3-bugs-found-during-testing)

---

## 1. Automated Backend Tests

**File:** `server/test.js`  
**How to run:** Start the server (`node index.js`), then run `node test.js` from the `server/` directory.  
**Makes real API calls:** Yes — the `/api/parse` tests hit the live OpenAI API.

### Test Results

```
==============================================
  Email Agent — Backend API Tests
  Server: http://localhost:5000
==============================================

── Health Check
  ✓  GET /health → 200, status: ok

── GET /auth/me
  ✓  No session header → 401
  ✓  Invalid session ID → 401

── POST /auth/logout
  ✓  Logout with no session → 200 (safe no-op)
  ✓  Logout with fake session ID → 200 (safe no-op)

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
  ✓  Response includes toConfidence field ("high" or "low")
  ✓  Literal @ in input → toConfidence is "high"

── POST /api/send
  ✓  No session header → 401 (auth required)
  ✓  Invalid session ID → 401 (session not found)
  ℹ  Field validation (400s) and happy path → tested manually (requires OAuth session)

==============================================
  Results: 19/19 passed
  All tests passed ✓
==============================================
```

### What Each Test Covers

**Health check**

| # | Test | Expected | Why |
|---|---|---|---|
| 1 | `GET /health` | `200 { status: 'ok' }` | Confirms server is running and responsive |

**GET /auth/me**

| # | Test | Expected | Why |
|---|---|---|---|
| 2 | No `X-Session-Id` header | `401` with error | Unauthenticated request must be rejected |
| 3 | Invalid/random session ID | `401` with error | Non-existent session must be rejected |

**POST /auth/logout**

| # | Test | Expected | Why |
|---|---|---|---|
| 4 | No session header | `200` | Logout is idempotent — safe to call even when not signed in |
| 5 | Fake session ID | `200` | Deleting a non-existent session should not throw |

**POST /api/parse**

| # | Test | Expected | Why |
|---|---|---|---|
| 6 | Empty string `""` | `400` | Empty input should never reach GPT |
| 7 | Whitespace only `"   "` | `400` | Whitespace-only is effectively empty |
| 8 | Missing `message` field entirely | `400` | Malformed request body |
| 9 | Valid message with email address | `200 { to, subject, body }` | Core happy path |
| 10 | — Email correctly extracted | `to` contains `test@example.com` | Verifies GPT extracted the right address |
| 11 | — Subject non-empty | `subject.length > 0` | GPT generated a subject line |
| 12 | — Body non-empty | `body.length > 0` | GPT generated a body |
| 13 | Message with no email address | `200`, `to` is `""` | GPT should gracefully return empty `to` |
| 14 | Voice-style `"pranav at the rate gmail.com"` | `to` contains `@` | GPT reconstructs spoken email addresses |
| 15 | Any valid message | `toConfidence` is `"high"` or `"low"` | Field must always be present |
| 16 | Message with literal `@` in input | `toConfidence === "high"` | Deterministic confidence check |

**POST /api/send**

| # | Test | Expected | Why |
|---|---|---|---|
| 17 | No `X-Session-Id` header | `401` | Sending requires an authenticated Google session |
| 18 | Invalid/expired session ID | `401` | Non-existent session must be rejected |

**Not automated (manual only):**  
Field validation (missing `to`/`subject`/`body`, invalid email format) fires after auth and requires a real OAuth session. Verified manually via the full browser flow.

---

## 2. Manual UI Tests

Tested in Chrome with both servers running (`node index.js` + `npm run dev`).

### Group 0 — Authentication

| # | Action | Pass? | Notes |
|---|---|---|---|
| T1 | Load app (not signed in) | ✓ | Sign-in screen shown, no app content visible |
| T2 | Click "Sign in with Google" | ✓ | Browser redirects to Google consent screen |
| T3 | Complete Google sign-in | ✓ | Redirected back to app, signed-in user email appears in header |
| T4 | Refresh page after sign-in | ✓ | Session restored from localStorage, stays signed in |
| T5 | Click "Sign out" | ✓ | Returns to sign-in screen, localStorage cleared |

### Group 1 — Text input, basic flow

| # | Input | Tone | Pass? | Notes |
|---|---|---|---|---|
| T6 | `Email john@example.com saying hi how are you` | Raw | ✓ | To: `john@example.com`, body verbatim, no amber warning |
| T7 | `Send an email to sarah@gmail.com about the project deadline, tell her we're on track` | Raw | ✓ | Subject contained "deadline", body contained "we're on track" |
| T8 | Leave message blank, click Continue | — | ✓ | Button stayed disabled |
| T9 | Paste 501+ characters | — | ✓ | Counter turned red, Continue disabled |

### Group 2 — Tone modes

| # | Input | Tone | Pass? | Notes |
|---|---|---|---|---|
| T10 | `Email boss@work.com saying can we meet tomorrow` | Raw | ✓ | Body: exact words only |
| T11 | Same | Formal | ✓ | Body rewritten formally |
| T12 | Same | Friendly | ✓ | Body conversational |
| T13 | Same | Concise | ✓ | Body stripped to one sentence |

### Group 3 — Confidence flagging

| # | Input | Pass? | Notes |
|---|---|---|---|
| T14 | `Email pranav saying hi` (no address) | ✓ | To empty, amber hint "couldn't find an email address" |
| T15 | `mail to pranav at the rate gmail dot com` | ✓ | Amber border + warning appeared |
| T16 | T15 result → click into To field and edit | ✓ | Warning dismissed immediately on edit |

### Group 4 — Confirmation form

| # | Action | Pass? | Notes |
|---|---|---|---|
| T17 | Clear the To field on review screen | ✓ | Send Email disabled immediately |
| T18 | Type `notanemail` in To field | ✓ | Red border + "Please enter a valid email address" |
| T19 | Click ← Back | ✓ | Returned to input, no data lost |

### Group 5 — Voice input

| # | Action | Pass? | Notes |
|---|---|---|---|
| T20 | Say `email pranav dubey 1725 at gmail dot com saying hi`, stop mic | ✓ | Whisper transcribed correctly, address extracted |
| T21 | Click mic, say nothing, stop | ✓ | Textarea stayed blank — see Bug #2 and Bug #3 below |
| T22 | Deny mic permission | ✓ | "Microphone access was denied..." error appeared |

### Group 6 — Actual email delivery

| # | Action | Pass? | Notes |
|---|---|---|---|
| T23 | Full flow to own email address | ✓ | Email arrived in inbox, sent from signed-in Gmail account |

### Group 7 — Error states

| # | Action | Pass? | Notes |
|---|---|---|---|
| T24 | Kill server, try to submit | ✓ | "Cannot reach the server..." error banner appeared |
| T25 | Toggle dark mode | ✓ | Full UI switched, theme persisted on page refresh |

---

## 3. Bugs Found During Testing

### Bug 1 — Confidence warning not showing for spoken/reconstructed addresses

**Test that found it:** T15  
**Input:** `mail to pranav at the rate gmail dot com`  
**Observed:** Address was extracted as `pranav@gmail.com` but no amber warning appeared.  
**Root cause:** GPT was rating its own confidence as `"high"` because it successfully reconstructed the address. But "high" should mean the user *typed* a literal `@` — not that GPT guessed correctly.

**Fix (`server/services/openaiService.js`):**

```js
const gptSaysHigh = parsed.to_confidence === 'high';
const addressWasInInput = message.includes('@');
const toConfidence = (gptSaysHigh && (to === '' || addressWasInInput)) ? 'high' : 'low';
```

Rule: if the extracted `to` contains `@` but the original message doesn't, the address was reconstructed — override to `"low"` regardless of GPT's self-rating.

---

### Bug 2 — Silent audio returned "Thanks for watching!"

**Test that found it:** T21 (first attempt)  
**Observed:** Recording silence and stopping the mic caused Whisper to return "Thanks for watching!" in the textarea.  
**Root cause:** Whisper was trained heavily on YouTube content. When given silent audio, it hallucinates a YouTube-style sign-off.

**Fix attempt 1 (`server/routes/transcribe.js`):**

Added a server-side blocklist of known hallucination phrases. Result: partially worked — some variants still got through.

---

### Bug 3 — Whisper still outputting random phrases after fix attempt 1

**Test that found it:** T21 (second attempt)  
**Observed:** Whisper returned `"Thank you for watching and don't forget to like and subscribe!"` — a longer variant the blocklist didn't catch.

**Final fix — client-side amplitude detection (`client/src/hooks/useWhisper.js`):**

```js
async function hasSpeech(blob) {
  const audioContext = new AudioContext();
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  audioContext.close();
  const channelData = audioBuffer.getChannelData(0);
  let sum = 0;
  for (let i = 0; i < channelData.length; i++) {
    sum += channelData[i] * channelData[i];
  }
  const rms = Math.sqrt(sum / channelData.length);
  return rms > 0.01;
}
```

If RMS amplitude is below 0.01, the blob is not sent to Whisper at all. The server-side blocklist was kept as a backup with a broader regex.

**Result:** Fixed. Silent recordings leave the textarea blank. ✓

---

*Last updated: 2026-04-10*
