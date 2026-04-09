# NLP Approach — Findings & Why We Abandoned It

> **Purpose:** Document the first implementation attempt using regex and compromise.js (an NLP library) to parse email intent from natural language input. Every failure case recorded here directly motivated the switch to GPT-4o-mini.

---

## What We Tried

The initial approach used two tools in a pipeline:

1. **Regular expressions** — to extract email addresses from the user's input
2. **compromise.js** — a lightweight NLP library to identify named entities, tag parts of speech, and extract the recipient, subject, and body from natural language

The idea was to avoid a paid API call and handle parsing locally in Node.js.

---

## Failure Case 1 — Split Email Address

**Input:** `Pranav Dubey 1725@gmail.com`

**Expected:** `to: "pranavdubey1725@gmail.com"`

**Actual:** `to: "1725@gmail.com"` — the name was lost

**Root cause:**
The regex pattern `/[^\s@]+@[^\s@]+\.[^\s@]+/` matches the first complete structural email token it finds. `1725@gmail.com` is a valid match so it was returned. The preceding `Pranav Dubey` was parsed as part of the name — but there was no logic to combine it with the email username. Regex has no understanding that `Pranav Dubey` and `1725@gmail.com` form a single intended address.

---

## Failure Case 2 — Spoken Email Address

**Input:** `pranav at gmail dot com`

**Expected:** `to: "pranav@gmail.com"`

**Actual:** nothing found

**Root cause:**
Spoken email addresses — dictated word by word — don't structurally resemble email addresses. The regex requires `@` to be present as a literal character. "at" in plain text is invisible to the pattern. This is a fundamental limit: regex matches *structure*, not *meaning*.

Users dictating their email address will always say it this way. This is not an edge case — it's the primary use case for voice input.

---

## Failure Case 3 — Spaces Around @

**Input:** `1725 @ gmail.com`

**Expected:** `to: "1725@gmail.com"`

**Actual:** nothing found

**Root cause:**
The regex pattern `/[^\s@]+@[^\s@]+/` requires characters immediately adjacent to `@` with no whitespace. A single space on either side causes the entire match to fail. Users typing quickly often add spaces around special characters without thinking.

---

## Failure Case 4 — Recipient vs. Boilerplate

**Input:** `send an email to John saying hi`

**Expected:** `to: "" (no address found)`, `body: "hi"`

**Actual:** compromise.js identified "John" as a proper noun but had no way to distinguish it as a recipient vs. any other named entity in the sentence. "email" was also tagged as a noun. The command structure ("send ... to X saying Y") was not understood.

**Root cause:**
compromise.js labels words with grammatical roles (noun, verb, person, etc.) but has no concept of *command structure*. It doesn't know that `to [name]` is a recipient slot and `saying [words]` is the message body. Both look like noun phrases. Without understanding the sentence's intent, there was no reliable way to extract the right fields.

---

## Failure Case 5 — Pronoun Reference

**Input:** `tell him I'll be late`

**Expected:** Body extracted, `to` empty with a graceful fallback

**Actual:** Complete failure — "him" is unresolvable without knowing who was previously mentioned, and there's no prior context. The library returned no useful output.

**Root cause:**
NLP libraries have no world knowledge and no conversation memory. Resolving "him" requires knowing who the user is referring to — information that exists outside the current sentence. This is impossible for a stateless pattern-matching system.

---

## Failure Case 6 — Voice Transcription Artifacts

**Input (as transcribed by the browser):** `milk to pranav at the rate gmail.com saying hike`

**What the user said:** `mail to pranav at the rate gmail.com saying hi`

**Expected:** Corrects "milk" → "mail", "hike" → "hi", extracts email

**Actual:** "milk" was extracted as the subject, no email address found, "hike" was left in the body

**Root cause:**
The Web Speech API transcribes phonetically. "mail" and "milk" sound similar. "hi" becomes "hike" with ambient noise. No regex rule can fix a wrong word — you'd need to know what the user *meant*, not just what was *said*. Writing rules for every possible mishearing is not a scalable approach.

---

## The Pattern Across All Failures

Every failure has the same root cause: **pattern matching cannot understand meaning**.

| What regex/NLP can do | What it cannot do |
|---|---|
| Match text that looks like an email address | Reconstruct a spoken email address |
| Tag words as nouns, verbs, names | Understand command structure |
| Extract tokens that match a pattern | Resolve implicit references ("him", "my boss") |
| Apply rules you write explicitly | Handle inputs you didn't anticipate |
| Work offline with no API cost | Correct speech-to-text artifacts |

Each failure case required a new patch — a new regex variant, a new heuristic, a new exception. The patches worked for the specific cases they were written for and broke on the next variation. There was no path to handling the full range of natural language input this way.

---

## What Would Have Been Required to Continue

To make the NLP approach work at the level GPT achieves, we would have needed to build:

1. **Spoken email reconstruction** — a module that converts "at the rate", "dot com", "underscore" etc. into `@`, `.`, `_`
2. **Command parser** — a grammar that understands "send to X saying Y", "email X about Y", "write to X", "tell X that Y" and all their variants
3. **Speech artifact correction** — a dictionary or language model to correct phonetic transcription errors
4. **Fallback handling** — logic for every ambiguous or incomplete input
5. **Subject inference** — logic to generate a subject line when the user doesn't state one explicitly

Each of these is a non-trivial engineering problem. Together they would amount to building a small language model from scratch — to replicate something GPT-4o-mini does in a single API call at a cost of ~$0.0002.

---

## Decision

Replaced the entire NLP pipeline with GPT-4o-mini. The switch eliminated all six failure cases above and reduced the parsing code from a pipeline of libraries and heuristics to a single function in `server/services/openaiService.js`.

See [OPENAI_FINDINGS.md](OPENAI_FINDINGS.md) for a detailed breakdown of how GPT handles each of these cases.

---

*Last updated: 2026-04-09*
