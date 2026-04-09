# OpenAI API — Findings & Why We Chose It

> **Purpose:** Document why the OpenAI API (GPT-4o-mini) was chosen over a regex + NLP library approach for parsing email intent. Each section directly addresses a limitation found in NLP_FINDINGS.md and shows how GPT solves it.

---

## Overview

The OpenAI approach uses one tool:
- **GPT-4o-mini** — a large language model that *understands* natural language intent and returns structured JSON

Unlike regex and compromise.js, GPT does not match patterns. It reads the sentence the way a human would, infers what the user means, and produces a structured output directly.

---

## Finding 1 — GPT Handles Broken Email Addresses

**The NLP problem (from NLP_FINDINGS.md):**
Regex can only match tokens that *structurally look like* an email. Anything with spaces, missing `@`, or spoken phonetically breaks the pattern entirely.

**How GPT handles it:**

| What the user types / says | NLP result | GPT result |
|---|---|---|
| `Pranav Dubey 1725@gmail.com` | `1725@gmail.com` (name lost) | `pranavdubey1725@gmail.com` (inferred) |
| `pranav at gmail dot com` | nothing found | `pranav@gmail.com` |
| `1725 @ gmail.com` | nothing found | `1725@gmail.com` |
| `milk to pranav at the rate gmail.com` | nothing found | `pranavdubey1725@gmail.com` |

**Why GPT can do this:**
GPT understands that "pranav at gmail dot com" is a person describing an email address out loud. It knows the convention and reconstructs it. No regex rule can do this — it requires semantic understanding of what an email address *is*, not just what one *looks like*.

**Result:** The `to` field is populated correctly in the vast majority of cases, even from messy or spoken input.

---

## Finding 2 — GPT Understands Intent, Not Just Labels

**The NLP problem (from NLP_FINDINGS.md):**
compromise.js tags words as nouns, verbs, names — but has no concept of *command structure*. "Pranav Dubey" and "an email" both look like noun phrases. It cannot tell which is the recipient and which is boilerplate.

**How GPT handles it:**

Given: `"send an email to Pranav Dubey saying hi"`

| Task | NLP library | GPT |
|---|---|---|
| Identify recipient | Sees "Pranav Dubey" as a proper noun, but so is "email" | Knows "to Pranav Dubey" is the recipient slot |
| Identify message | Extracts nouns — could pick up "email" as a topic | Knows "saying hi" is the message body |
| Generate subject | Cannot — no understanding of topic | Infers subject from intent: "Greeting" |
| Generate body | Template fill — no real composition | Writes a complete, professional email |

**Why GPT can do this:**
GPT was trained on billions of examples of human communication. It has internalized the structure of commands like "send an email to X saying Y." It doesn't label words — it understands the *sentence as a whole*.

**Result:** Subject and body are generated accurately from casual, incomplete instructions.

---

## Finding 3 — GPT Resolves Ambiguity Intelligently

**The NLP problem (from NLP_FINDINGS.md):**
Ambiguous inputs like "tell him I'll be late" or "send a follow-up" are impossible for pattern-matching to resolve. They require world knowledge and context.

**How GPT handles it:**

| Input | NLP result | GPT result |
|---|---|---|
| `email Pranav about the meeting` | Subject unclear, no email address found | Writes a meeting-related email, flags `to` as empty |
| `tell him I'll be late` | Cannot identify "him" | Writes body with the message, leaves `to` empty with graceful fallback |
| `send a follow-up to yesterday's discussion` | No pattern matches | Generates a follow-up email body, flags `to` as empty |
| `write to my boss asking for leave` | "my boss" unresolvable | Generates a leave request email, `to` left for user to fill |

**Why GPT can do this:**
When GPT cannot determine something (like who "him" is), it makes the best possible decision for what it *can* determine, and returns an empty string for what it cannot. The review form then catches the gap — the user only fills in one field instead of everything.

**The NLP approach would return nothing useful. GPT returns everything it can.**

---

## Finding 4 — GPT Corrects Voice Transcription Errors

**The NLP problem (from NLP_FINDINGS.md):**
The Web Speech API produces phonetic transcriptions, not structured text. Voice users will almost always produce degraded input: "milk to pranav at the rate gmail.com saying hike."

**How GPT handles it:**

| What gets transcribed | NLP result | GPT result |
|---|---|---|
| `milk to pranav at the rate gmail.com saying hike` | "milk" extracted as subject, no email found | Corrects "milk" → "mail", "hike" → "hi", extracts email |
| `Sarah at company dot com` | No email found | `sarah@company.com` |
| `hi Sarah I'll be late` (no punctuation) | Noun extraction confused by missing structure | Writes a proper email regardless |

**Why GPT can do this:**
We explicitly instruct GPT in the system prompt to expect speech-to-text artifacts and correct obvious errors using context. GPT's training on natural language makes it robust to noise — it reads "milk to pranav" the same way a human reader would: as a mishearing of "mail to pranav."

**The NLP approach requires manually writing regex rules for every possible mishearing. GPT handles them all.**

---

## Finding 5 — Side-by-Side Capability Comparison

| Capability | Regex + compromise.js | GPT-4o-mini |
|---|---|---|
| Extract email from clean input | Yes | Yes |
| Extract email from messy/spoken input | Partial | Yes |
| Identify recipient vs. boilerplate | No | Yes |
| Generate a full professional email body | No (templates only) | Yes |
| Handle ambiguous pronouns ("tell him") | No | Partially |
| Correct voice transcription errors | Regex rules only | Yes |
| Understand "follow up on my last email" | No | Yes |
| Infer subject from context | No | Yes |
| Cost per call | Free | ~$0.0002 |
| Setup complexity | High (multiple libraries, rules) | Low (one API call) |

---

## Why We Chose the OpenAI API

### 1. It solves the actual problem
The core task — turning messy natural language into a structured `{ to, subject, body }` — requires *understanding*, not pattern matching. GPT does this in one API call. The NLP approach requires a pipeline of libraries, regex rules, boilerplate strippers, and noise filters — and still fails on edge cases.

### 2. The output quality is production-level
GPT doesn't just extract fields — it *writes* the email body. A user saying "email my professor saying I'll miss class tomorrow" gets back a complete, professionally written email. No NLP library can do this.

### 3. It's the right call for an ML/DS role
This project is an interview assignment for a machine learning and data science role. Reaching for the right AI tool — rather than reinventing NLP primitives with libraries — is exactly the kind of judgment the role requires. Knowing *when* to use an LLM is as important as knowing how to build without one.

### 4. The review form handles the remaining gaps
GPT is not perfect. It may occasionally miss an email address or misread a subject. That is why Phase 3 (the confirmation UI) exists — it is the safety net for everything the AI cannot determine automatically. The user only corrects small mistakes instead of filling in everything from scratch.

### 5. The architecture keeps it swappable
The AI parsing is isolated in one file: `server/services/openaiService.js`. If a better model becomes available, or if we wanted to run a local LLM, only that file changes. The routes, frontend, and confirmation form are all model-agnostic.

---

## Conclusion

The regex + NLP approach has fundamental hard limits that stem from a single root cause: **pattern matching cannot understand meaning**. Every workaround — boilerplate stripping, noise filtering, speech artifact normalisation — is a patch over that root cause, not a fix.

GPT addresses the root cause directly. For a project where the quality of language understanding is the entire point, it is the correct tool.

---

---

## Design Decision Log

### Change: Email Body Faithfulness (2026-04-08)

**What changed:** Updated the GPT system prompt to write the email body using *only* what the user actually said — no expansion, no padding.

**Previous behaviour:**
The prompt instructed GPT to write *"a complete, professional email body (expand the user's intent into a proper email)."* This produced well-structured emails but added content the user never said:

```
Dear Ekta,

I hope this message finds you well. I wanted to reach out to discuss
a few matters that I believe are important. Please let me know a
convenient time for you to chat.

Best regards,
[Your Name]
```

**Why it was a problem:**
The output was polished but not faithful. The user said *"email ekta saying hi let's catch up"* — GPT turned that into a formal letter with filler phrases and a `[Your Name]` placeholder. The user's actual intent was lost inside GPT's idea of what a "proper email" should look like.

**New behaviour:**
The prompt now explicitly instructs GPT:
- Write ONLY what the user said
- Do not add filler phrases ("I hope this message finds you well")
- Do not add `[Your Name]` placeholders
- Keep it as close to the user's own words as possible, just cleaned up into readable sentences

Same input now produces:

```
Hi, let's catch up.
```

**Why this is the right call:**
This is a voice/text agent — the user is the author, GPT is the transcriber and formatter. The agent's job is to capture intent accurately, not to rewrite the user's message in its own voice. Faithfulness to the user's input matters more than GPT's idea of a "professional" email. The confirmation UI exists precisely so the user can expand the message themselves if they want to.

**Lesson learned:**
Prompt wording has direct, measurable impact on output quality. "Expand the user's intent" vs "write only what the user said" produces completely different emails from the same input. Prompt engineering is not a one-time task — it requires iteration based on real observed outputs.

---

*Last updated: 2026-04-08*
*Reference: NLP_FINDINGS.md*
