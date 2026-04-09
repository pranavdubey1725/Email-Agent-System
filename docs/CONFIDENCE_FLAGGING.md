# GPT Confidence Flagging — Design & Implementation

> **Purpose:** Document why confidence flagging was added, how it works technically, and what it signals about the engineering approach.

---

## The Problem It Solves

The AI parser extracts a `to` field (recipient email address) from natural language input. But not all extractions are equal:

| Input | What GPT does | Reliability |
|---|---|---|
| `email john@company.com about the meeting` | Reads a complete address directly | High — it's right there |
| `email John about the meeting` | Has a name, no address — returns `""` | N/A — empty, handled separately |
| `email john at company dot com` | Reconstructs from spoken format | Medium — likely correct but inferred |
| `mail to Pranav saying hi` (voice, mishearing) | Guesses from partial input | Low — could be wrong |
| `send an email to my boss` | No address at all | Low — left empty |

Without confidence flagging, all successful extractions look identical to the user. A correctly read address and a guessed one both appear in the same `To` field with no distinction. The user has no signal that one needs more careful review than the other.

---

## How It Works

### 1. GPT rates its own confidence

Every parsing prompt now includes this instruction:

```
- "to_confidence": rate your confidence in the "to" field as either "high" or "low".
  Use "high" only when a complete, clearly stated email address was present in the input.
  Use "low" when: no email was found, the address was partially spoken or guessed,
  the input was ambiguous, or you inferred it from a name rather than reading it directly.
```

GPT returns a fourth field alongside `to`, `subject`, and `body`:

```json
{
  "to": "pranavdubey@gmail.com",
  "to_confidence": "low",
  "subject": "Meeting Request",
  "body": "Can we meet tomorrow?"
}
```

### 2. Backend normalises it

`openaiService.js` normalises `to_confidence` defensively — anything other than the explicit string `"high"` is treated as `"low"`. This means if GPT omits the field or returns an unexpected value, the default is to be cautious, not to silently pass:

```js
toConfidence: parsed.to_confidence === 'high' ? 'high' : 'low'
```

### 3. Passed through the stack

```
openaiService  →  routes/parse.js  →  api.js  →  App.jsx  →  ConfirmationForm
```

`toConfidence` travels as a prop from the parsed result all the way to the UI.

### 4. UI shows an amber warning

In `ConfirmationForm.jsx`, when `toConfidence === 'low'` and the `To` field is not empty:

- The `To` input gets an **amber border** instead of the default grey
- A warning message appears beneath it: *"⚠ AI wasn't certain about this address — please verify it before sending."*

```
TO
┌─────────────────────────────────────┐  ← amber border
│ pranavdubey@gmail.com               │
└─────────────────────────────────────┘
⚠ AI wasn't certain about this address — please verify it before sending.
```

### 5. Warning dismisses when user edits

Once the user clicks into the `To` field and changes the value, `userEditedTo` is set to `true` and the warning disappears. The user has taken ownership of the field — the warning has done its job.

---

## Priority Order of To Field Messages

Three different messages can appear under the `To` field. Only one shows at a time, in this priority:

| Condition | Message | Colour |
|---|---|---|
| Field has a value but invalid format | "Please enter a valid email address." | Red |
| GPT flagged low confidence (and user hasn't edited) | "AI wasn't certain about this address..." | Amber |
| Field is completely empty | "The AI couldn't find an email address — please enter one." | Amber |

---

## Why This Is an ML/DS Approach

Most applications that use AI treat the model output as ground truth. They display whatever the model returns and move on.

**Confidence flagging is a different philosophy: trust but verify.**

Real ML systems surface model uncertainty to the user or downstream system. A model that returns a result with a confidence score of 0.3 should be treated differently than one returning 0.97. The same principle applies here — GPT telling us it's guessing at an email address is meaningful signal that we surface directly in the UI rather than silently ignoring.

This is the same thinking behind:
- Spam filters showing confidence scores instead of binary decisions
- Medical AI highlighting which predictions need radiologist review
- Recommendation systems deprioritising low-confidence suggestions

For an email agent specifically, a wrong `To` address means the email goes to the wrong person. Surfacing GPT's uncertainty exactly at that field is the right place to intervene.

---

## What Triggers Low vs High Confidence

**High confidence examples:**
- `"email john@example.com about the project"` — complete address, directly stated
- `"send to sarah.jones@company.co.uk with subject update"` — full address in input

**Low confidence examples:**
- `"email John about the project"` — name only, no address
- `"mail to pranav at the rate gmail dot com"` — spoken format, reconstructed
- `"send a follow-up to my manager"` — no address at all, field will be empty
- Voice input with a mishearing — the address may have been partially transcribed

---

## Files Changed

| File | What changed |
|---|---|
| `server/services/openaiService.js` | Added `to_confidence` to both prompts (raw + styled tones). Added `normalise()` helper that defaults to `'low'` defensively. |
| `client/src/App.jsx` | `parsedEmail` state now includes `toConfidence`. Passed as prop to `ConfirmationForm`. |
| `client/src/components/ConfirmationForm.jsx` | Accepts `toConfidence` prop. Shows amber border + warning message when low. Warning dismisses when user edits the field. |
| `client/src/components/ConfirmationForm.css` | Added `.field__input--warning` and `.field__confidence-warning` styles. |

---

*Last updated: 2026-04-09*
