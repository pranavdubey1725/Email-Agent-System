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
  ℹ  Happy path (actual email delivery) → test manually in the browser

==============================================
  Results: 17/17 passed
  All tests passed ✓
==============================================
```

### What Each Test Covers

**Health check**

| # | Test | Expected | Why |
|---|---|---|---|
| 1 | `GET /health` | `200 { status: 'ok' }` | Confirms server is running and responsive |

**POST /api/parse**

| # | Test | Expected | Why |
|---|---|---|---|
| 2 | Empty string `""` | `400` with error | Empty input should never reach GPT |
| 3 | Whitespace only `"   "` | `400` with error | Whitespace-only is effectively empty |
| 4 | Missing `message` field entirely | `400` with error | Malformed request body |
| 5 | Valid message with email address | `200 { to, subject, body }` | Core happy path |
| 6 | — Email correctly extracted | `to` contains `test@example.com` | Verifies GPT extracted the right address |
| 7 | — Subject non-empty | `subject.length > 0` | GPT generated a subject line |
| 8 | — Body non-empty | `body.length > 0` | GPT generated a body |
| 9 | Message with no email address | `200`, `to` is `""` | GPT should gracefully return empty `to` |
| 10 | Voice-style `"pranav at the rate gmail.com"` | `to` contains `@` | GPT reconstructs spoken email addresses |

**POST /api/send**

| # | Test | Expected | Why |
|---|---|---|---|
| 11 | Missing `to` | `400` | All fields required |
| 12 | Missing `subject` | `400` | All fields required |
| 13 | Missing `body` | `400` | All fields required |
| 14 | Invalid email `"notanemail"` | `400` | Format check before touching SMTP |
| 15 | Email with spaces `"pranav @ gmail.com"` | `400` | Spaces around `@` are invalid |
| 16 | All fields empty strings | `400` | Empty strings treated as missing |

**Not automated (manual only):**
Actual email delivery — sending a real email has side effects and consumes API credits. Verified manually via the full browser flow.

---

## 2. Manual UI Tests

Tested in Chrome with both servers running (`node index.js` + `npm run dev`).

### Group 1 — Text input, basic flow

| # | Input | Tone | Pass? | Notes |
|---|---|---|---|---|
| T1 | `Email john@example.com saying hi how are you` | Raw | ✓ | To: `john@example.com`, body verbatim, no amber warning |
| T2 | `Send an email to sarah@gmail.com about the project deadline, tell her we're on track` | Raw | ✓ | Subject contained "deadline", body contained "we're on track" |
| T3 | Leave message blank, click Continue | — | ✓ | Button stayed disabled |
| T4 | Paste 501+ characters | — | ✓ | Counter turned red, Continue disabled |

### Group 2 — Tone modes

| # | Input | Tone | Pass? | Notes |
|---|---|---|---|---|
| T5 | `Email boss@work.com saying can we meet tomorrow` | Raw | ✓ | Body: exact words only |
| T6 | Same | Formal | ✓ | Body rewritten formally |
| T7 | Same | Friendly | ✓ | Body conversational |
| T8 | Same | Concise | ✓ | Body stripped to one sentence |

### Group 3 — Confidence flagging

| # | Input | Pass? | Notes |
|---|---|---|---|
| T9 | `Email pranav saying hi` (no address) | ✓ | To empty, amber hint "couldn't find an email address" |
| T10 | `mail to pranav at the rate gmail dot com` | ✓ (after fix) | Amber border + warning appeared — see Bug #1 below |
| T11 | T10 result → click into To field and edit | ✓ | Warning dismissed immediately on edit |

### Group 4 — Confirmation form

| # | Action | Pass? | Notes |
|---|---|---|---|
| T12 | Clear the To field on review screen | ✓ | Send Email disabled immediately |
| T13 | Type `notanemail` in To field | ✓ | Red border + "Please enter a valid email address" |
| T14 | Click ← Back | ✓ | Returned to input, no data lost |

### Group 5 — Voice input

| # | Action | Pass? | Notes |
|---|---|---|---|
| T15 | Say `email pranav dubey 1725 at gmail dot com saying hi`, stop mic | ✓ | Whisper transcribed correctly, address extracted |
| T16 | Click mic, say nothing, stop | ✓ (after fix) | Textarea stayed blank — see Bug #2 and Bug #3 below |
| T17 | Deny mic permission | ✓ | "Microphone access was denied..." error appeared |

### Group 6 — Actual email delivery

| # | Action | Pass? | Notes |
|---|---|---|---|
| T18 | Full flow to own email address | ✓ | Email arrived in inbox. From showed "Email Agent", subject and body matched what GPT generated |

### Group 7 — Error states

| # | Action | Pass? | Notes |
|---|---|---|---|
| T19 | Kill server, try to submit | ✓ | "Cannot reach the server..." error banner appeared |
| T20 | Toggle dark mode | ✓ | Full UI switched, theme persisted on page refresh |

---

## 3. Bugs Found During Testing

### Bug 1 — Confidence warning not showing for spoken/reconstructed addresses

**Test that found it:** T10  
**Input:** `mail to pranav at the rate gmail dot com`  
**Observed:** Address was extracted as `pranav@gmail.com` but no amber warning appeared — the To field looked identical to a high-confidence extraction.  
**Root cause:** GPT was rating its own confidence as `"high"` because it successfully reconstructed the address. But "high" should mean the user *typed* a literal `@` — not that GPT guessed correctly.

**Fix (`server/services/openaiService.js`):**

Replaced the pure GPT self-assessment with a deterministic cross-check:

```js
const gptSaysHigh = parsed.to_confidence === 'high';
const addressWasInInput = message.includes('@');
const toConfidence = (gptSaysHigh && (to === '' || addressWasInInput)) ? 'high' : 'low';
```

Rule: if the extracted `to` contains `@` but the original message doesn't, the address was reconstructed — override to `"low"` regardless of GPT's self-rating. GPT cannot be trusted to assess its own reconstruction quality here.

---

### Bug 2 — Silent audio returned "Thanks for watching!"

**Test that found it:** T16 (first attempt)  
**Observed:** Recording silence and stopping the mic caused Whisper to return "Thanks for watching!" in the textarea.  
**Root cause:** Whisper was trained heavily on YouTube content. When given silent audio, it hallucinates a YouTube-style sign-off because silence at the end of a recording is its prior for "end of video".

**Fix attempt 1 (`server/routes/transcribe.js`):**

Added a blocklist of known hallucination phrases:

```js
const SILENCE_HALLUCINATIONS = [
  /^thanks for watching[.!]?\s*$/i,
  /^thank you for watching[.!]?\s*$/i,
  ...
];
```

Result: Partially worked — some variants still got through.

---

### Bug 3 — Whisper still outputting random phrases after fix attempt 1

**Test that found it:** T16 (second attempt)  
**Observed:** Whisper returned `"Thank you for watching and don't forget to like and subscribe!"` — a longer variant the blocklist didn't catch. The fundamental problem is that Whisper can hallucinate *anything*, so a blocklist can never be complete.

**Fix attempt 2 — Client-side amplitude detection (`client/src/hooks/useWhisper.js`):**

Changed the approach entirely. Instead of filtering bad outputs on the server, detect silence before sending the audio at all:

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

If RMS amplitude is below 0.01 (well below any normal speech level), the blob is not sent to Whisper at all. Whisper never receives silent audio, so it has nothing to hallucinate from.

The server-side blocklist was also made more robust as a backup — instead of matching exact phrases, it now matches anything starting with `"thank(s| you) for watching"`.

**Result:** Fixed. Silent recordings leave the textarea blank. ✓

---

*Last updated: 2026-04-09*
