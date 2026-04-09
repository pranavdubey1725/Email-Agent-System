# Web Speech API — Findings & Why We Switched to Whisper

> **Purpose:** Document the first voice implementation using the browser's built-in Web Speech API, the problems it introduced, and why it was replaced with OpenAI Whisper.

---

## What the Web Speech API Is

The Web Speech API is a browser-native interface for real-time speech recognition. No server, no API key, no cost — the browser streams audio to a recognition engine (Google's, in Chrome's case) and fires events with live transcription results as the user speaks.

```js
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.continuous = false;
recognition.interimResults = true;  // live word-by-word results
recognition.lang = 'en-US';
recognition.start();
```

It was the obvious first choice: no external dependency, instant results, works in the browser.

---

## What It Did Well

**Live interim results** — as the user speaks, words appear in the textarea in real time. This gives immediate feedback that the mic is working and the app is listening. No waiting for a "transcription" step.

This is the one thing the Web Speech API genuinely does better than Whisper. Whisper is batch-only — the transcript appears after the recording stops.

---

## Problem 1 — Browser Support

| Browser | Support |
|---|---|
| Chrome | ✓ Full support |
| Edge | ✓ Full support |
| Firefox | ✗ Not supported at all |
| Safari | Partial (unreliable) |

Firefox has never implemented `SpeechRecognition`. Since voice input is a core feature of this app, being unavailable in one of the two major browsers was a significant problem.

The Web Speech API hook (`useSpeechRecognition.js`) included an `isSupported` flag specifically to handle this — it fell back to showing "Voice input is not supported in this browser" on Firefox. But that's not a solution, it's a workaround that removes a feature from a large portion of users.

Whisper is a server API call — it works in every browser that supports `MediaRecorder` (all modern browsers including Firefox).

---

## Problem 2 — Cannot Produce Special Characters

The Web Speech API transcribes phonetically. It cannot output `@`, `.com`, `_`, or other characters that don't appear in spoken language. This is a hard limitation of how the API works.

For email address dictation this is a critical failure. A user saying:

> "pranav at gmail dot com"

gets transcribed as:

> `pranav at gmail dot com`

— a plain English sentence with no `@`, no `.`, and no recognisable email structure. GPT cannot reliably parse this as an email address because it looks like a noun phrase.

**The workaround we wrote:**

```js
function fixSpeechArtifacts(text) {
  return text
    .replace(/\bat the rate\b/gi, '@')
    .replace(/\[at\]/gi, '@')
    .trim();
}
```

This converted "at the rate" → `@` before passing the transcript to GPT. But it only covered two variants. Users might say "at sign", "at symbol", "commercial at", "@" spelled out, or anything else — each variation required a new rule. And even with `@` inserted correctly, "dot com" still left the address as `pranav@gmail dot com` — another fix needed for every domain suffix.

Whisper transcribes `pranav@gmail.com` directly from spoken input. No post-processing needed.

---

## Problem 3 — Accuracy on Names and Email Addresses

The Web Speech API is optimised for clear, natural speech — news reading, dictation of prose, voice commands. It performs poorly on:

- Proper names (`pranavdubey1725` → `Pranav Dubey 1725`, then split across words)
- Domain names (`company.co.uk` → `company dot co dot uk`)
- Email usernames with numbers or underscores

For this specific use case — where the most critical piece of data is an email address — the API's accuracy on the exact content that matters most was consistently unreliable.

---

## Problem 4 — No Control Over the Model

The Web Speech API is a black box. When a transcription is wrong, there is no way to:
- Correct it at the model level
- Pass context ("this is likely an email address")
- Retry with different settings
- Switch to a better model

It is entirely controlled by the browser vendor (Google, in Chrome's case). Any inaccuracy is permanent.

With Whisper, we pass `language: 'en'` and could add a `prompt` parameter to hint at the expected format. We control the model version, and we can post-process the result on the server before it reaches the client.

---

## Side-by-Side Comparison

| | Web Speech API | OpenAI Whisper |
|---|---|---|
| **Browser support** | Chrome / Edge only | All modern browsers |
| **Cost** | Free | ~$0.006 / minute |
| **API key required** | No | Yes (OpenAI) |
| **Live interim results** | Yes — word by word | No — batch after recording |
| **Produces `@`, `.`, special chars** | No | Yes |
| **Accuracy on email addresses** | Poor | Good |
| **Handles spoken email format** | No (needs heuristic fixes) | Yes (understands context) |
| **Control over model** | None | Model version, language, prompt |
| **Works offline** | No (streams to Google) | No (streams to OpenAI) |
| **Firefox support** | No | Yes |

---

## The Trade-off We Accepted

Switching to Whisper meant losing **live interim results**. With the Web Speech API, the user sees words appear as they speak. With Whisper, the textarea stays blank during recording and fills in only after the recording is uploaded and processed — typically 1–3 seconds.

We handled this with UI state:
- While recording: "Listening — speak now" banner with a blinking red dot
- While transcribing: "Transcribing with Whisper..." banner
- The textarea placeholder text changes to reflect each state

For this use case — email address dictation — we decided accuracy on the critical data matters more than live feedback. Getting `pranav@gmail.com` correctly after a 2-second wait is more valuable than seeing `pranav at gmail dot com` appear instantly.

---

## Files

| File | Status | Notes |
|---|---|---|
| `client/src/hooks/useSpeechRecognition.js` | Kept, not used | Preserved as documentation of the original approach |
| `client/src/hooks/useWhisper.js` | Active | Replaced `useSpeechRecognition` |

---

*Last updated: 2026-04-09*
