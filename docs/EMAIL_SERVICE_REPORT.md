# Email Service — In-Depth Technical Report

> **Purpose:** A complete explanation of how the email sending feature works in this project — from the moment the user clicks Send, to the email landing in the recipient's inbox. Written to be understood without prior backend experience.

---

## Table of Contents

1. [The Big Picture](#1-the-big-picture)
2. [What is SMTP?](#2-what-is-smtp)
3. [What is Nodemailer?](#3-what-is-nodemailer)
4. [Why Gmail App Password?](#4-why-gmail-app-password)
5. [The Full Request Flow](#5-the-full-request-flow)
6. [File-by-File Breakdown](#6-file-by-file-breakdown)
7. [What the Email Looks Like When It Arrives](#7-what-the-email-looks-like-when-it-arrives)
8. [Why This Architecture](#8-why-this-architecture)
9. [Limitations & What You'd Change in Production](#9-limitations--what-youd-change-in-production)

---

## 1. The Big Picture

When the user clicks **Send Email** in the confirmation form, here is what happens at a high level:

```
Browser (React)
    │
    │  POST /api/send  { to, subject, body }
    ▼
Express Server (Node.js)
    │
    │  Validates the data
    │  Calls emailService.sendEmail()
    ▼
Nodemailer
    │
    │  Opens a connection to Gmail's SMTP server
    │  Authenticates with your Gmail App Password
    │  Hands over the email
    ▼
Gmail's SMTP Server
    │
    │  Delivers the email
    ▼
Recipient's Inbox
```

Three things are involved:
- **Your Express server** — receives the request from the browser, validates it, passes it on
- **Nodemailer** — a Node.js library that handles the technical work of connecting to Gmail and sending
- **Gmail's SMTP server** — Gmail's own mail delivery infrastructure that actually sends the email

---

## 2. What is SMTP?

**SMTP** stands for **Simple Mail Transfer Protocol**. It is the standard internet protocol for sending emails — invented in 1982 and still in use today.

Think of it like a postal system:
- You write a letter (your email)
- You take it to the post office (the SMTP server)
- The post office delivers it to the recipient

Every email provider has an SMTP server:

| Provider | SMTP Server Address | Port |
|---|---|---|
| Gmail | smtp.gmail.com | 587 |
| Outlook | smtp.office365.com | 587 |
| Yahoo | smtp.mail.yahoo.com | 465 |

When you send an email from Gmail's website, Google handles SMTP internally — you never see it. When we send email programmatically (from code), we connect to Gmail's SMTP server directly and hand it our email to deliver.

**What happens during an SMTP connection:**
1. Our server opens a TCP connection to `smtp.gmail.com` on port 587
2. Gmail's server says "hello, who are you?"
3. We authenticate — provide email address and App Password
4. We hand over the email (recipient, subject, body, headers)
5. Gmail says "received, I'll deliver it"
6. Connection closes

All of this is handled automatically by Nodemailer — we never write any of this manually.

---

## 3. What is Nodemailer?

**Nodemailer** is a Node.js library (package) that handles all the low-level SMTP communication for you.

Without Nodemailer, sending an email in Node.js would require:
- Manually opening a TCP socket connection
- Negotiating TLS encryption with the server
- Writing raw SMTP commands (`EHLO`, `AUTH`, `MAIL FROM`, `RCPT TO`, `DATA`)
- Formatting email headers correctly (MIME format)
- Handling errors at every step

That's hundreds of lines of complex networking code. Nodemailer wraps all of it into this:

```js
const transporter = nodemailer.createTransport({ /* Gmail credentials */ });
await transporter.sendMail({ from, to, subject, text, html });
```

Two lines. That's the whole thing.

**Nodemailer is the most downloaded email library for Node.js** — over 3 million downloads per week. It is the standard choice for this kind of project.

---

## 4. Why Gmail App Password?

### The Problem with Regular Passwords

Since May 2022, Google no longer allows apps to log into Gmail using your regular Google password. If you tried, you'd get an authentication error. This was a security decision — regular passwords give too much access.

### What is an App Password?

An **App Password** is a special 16-character password that Google generates specifically for one app. It:
- Works only for SMTP access (sending email)
- Does **not** give the app access to your Google Drive, Calendar, contacts, or anything else
- Can be revoked at any time without changing your main password
- Looks like: `abcd efgh ijkl mnop` (Google shows it with spaces; you remove the spaces when using it)

### How to Generate One

1. Go to your Google Account
2. Click **Security**
3. Make sure **2-Step Verification is ON** (required — App Passwords only work with 2FA enabled)
4. Search for **"App passwords"**
5. Give it a name (e.g. "Email Agent") → Click **Create**
6. Google shows you the 16-character password — copy it immediately (you only see it once)

### Where It Lives in This Project

It is stored in `server/.env`:
```
GMAIL_USER=yourname@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
```

The server reads it via `process.env.GMAIL_APP_PASSWORD` — it is never hardcoded in the source code and never committed to git (`.gitignore` blocks the `.env` file).

---

## 5. The Full Request Flow

Here is every step that happens when the user clicks Send, in detail:

### Step 1 — Frontend sends the request
`client/src/services/api.js` makes a POST request:

```js
fetch('/api/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ to, subject, body })
})
```

The Vite dev server proxy forwards this to `http://localhost:5000/api/send`.

---

### Step 2 — Express route receives it
`server/routes/send.js` handles the incoming request.

**Validation check 1 — are all fields present?**
```js
if (!to || !subject || !body) {
  return res.status(400).json({ error: 'to, subject, and body are all required.' });
}
```
If any field is missing, the request is rejected immediately with a 400 error. The email service is never called.

**Validation check 2 — is the email address valid?**
```js
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(to)) {
  return res.status(400).json({ error: `"${to}" doesn't look like a valid email address.` });
}
```
This catches obvious malformed addresses like `pranav@` or `notanemail` before wasting a connection to Gmail's servers.

If both checks pass, it calls the email service.

---

### Step 3 — emailService creates a transporter
`server/services/emailService.js` creates a Nodemailer transporter:

```js
nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
})
```

`service: 'gmail'` is a shortcut — Nodemailer already knows Gmail's SMTP server address and port. You don't have to specify `smtp.gmail.com:587` manually.

---

### Step 4 — Mail options are defined

```js
const mailOptions = {
  from: `"Email Agent" <${process.env.GMAIL_USER}>`,
  to,
  subject,
  text: body,
  html: `<p>${body.replace(/\n/g, '<br>')}</p>`
}
```

**Breaking down each field:**

| Field | What it does | Example |
|---|---|---|
| `from` | What the recipient sees as the sender name and address | `"Email Agent" <pranav@gmail.com>` |
| `to` | Recipient's email address | `sarah@company.com` |
| `subject` | The subject line | `Project Update` |
| `text` | Plain text version of the body | `Hi Sarah, ...` |
| `html` | HTML version of the body | `<p>Hi Sarah, ...</p>` |

**Why both `text` and `html`?**
Email clients are inconsistent. Old clients (some corporate Outlook setups) only support plain text. Modern clients prefer HTML. By sending both, Nodemailer attaches them as a `multipart/alternative` MIME package and the email client automatically picks the version it supports. This is best practice.

The HTML conversion is simple: replace newline characters (`\n`) with `<br>` tags so line breaks are preserved when rendered in a browser.

---

### Step 5 — Nodemailer sends it

```js
const result = await transporter.sendMail(mailOptions);
```

Under the hood, Nodemailer:
1. Opens a TLS-encrypted TCP connection to `smtp.gmail.com:587`
2. Sends `EHLO` (greeting) to Gmail's server
3. Authenticates using your Gmail address and App Password
4. Transmits the email headers and body
5. Gmail acknowledges receipt
6. Connection closes

`result` contains a `messageId` — a unique ID Gmail assigns to every email it accepts. We return this to the frontend as confirmation.

---

### Step 6 — Response sent back to frontend

```js
res.json({ success: true, messageId: result.messageId });
```

The frontend receives this, the App component moves to the `'sent'` step, and the success screen is shown.

---

## 6. File-by-File Breakdown

### `server/services/emailService.js`
**Role:** Pure email-sending logic. Takes `{ to, subject, body }`, connects to Gmail, sends.

This file has one job and one job only — it knows nothing about HTTP requests or validation. It just sends emails. This separation makes it easy to test in isolation or swap Gmail for a different provider later.

```
createTransporter()    → sets up the Gmail SMTP connection
sendEmail({ to, subject, body }) → builds mail options and sends
```

### `server/routes/send.js`
**Role:** HTTP layer. Receives the request, validates inputs, calls the service, returns the response.

This file knows nothing about how email actually works — it delegates that to `emailService`. Its only job is to be the gatekeeper: check the data is valid before passing it on.

```
POST /api/send
  → validate (all fields present, email format valid)
  → call sendEmail()
  → return { success, messageId } or error
```

### `server/.env`
**Role:** Stores secrets. Never committed to git.

```
GMAIL_USER=yourname@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
```

### `client/src/services/api.js`
**Role:** Frontend's communication layer. The React components never use `fetch` directly — they call `sendEmail()` from this file.

```js
export async function sendEmail({ to, subject, body }) {
  const response = await fetch('/api/send', { ... });
  // throws a readable error if something goes wrong
}
```

---

## 7. What the Email Looks Like When It Arrives

When the recipient opens the email, they see:

```
From:    Email Agent <yourname@gmail.com>
To:      recipient@gmail.com
Subject: [whatever GPT generated]

[Body — written by GPT, formatted as a proper email]

Best regards,
```

The **From name** shows as "Email Agent" — that is the display name we set in the `from` field. The actual sending address is your Gmail account.

---

## 8. Why This Architecture

### Why Node.js + Express for the backend?
The email sending **must** happen on a backend server, not in the browser. Reasons:
- Browser code is public — anyone could open DevTools and steal your Gmail credentials
- Browsers don't support raw SMTP connections (they can only make HTTP requests)
- The server acts as a secure intermediary: frontend sends `{ to, subject, body }`, server handles everything else

### Why Nodemailer over SendGrid / Mailgun?
SendGrid and Mailgun are commercial email services. They offer higher deliverability, analytics, and no Gmail limits. But for this project:
- They require account sign-up and domain verification
- They charge money beyond free tiers
- Nodemailer + Gmail is free, instant to set up, and perfectly sufficient for a demo

### Why not use the Gmail API directly?
The Gmail API (Google's official REST API for Gmail) would give more control — access to drafts, threads, labels, etc. But it requires OAuth 2.0, which involves user login flows, access tokens, refresh tokens, and much more complexity. For simply sending an email, SMTP via Nodemailer is far simpler and achieves the same result.

---

## 9. Limitations & What You'd Change in Production

| Limitation | Why it exists | Production fix |
|---|---|---|
| Sending from your personal Gmail | App Passwords only work with regular Gmail | Use a dedicated sending account, or switch to SendGrid / AWS SES |
| Gmail sending limits | Free Gmail accounts can send ~500 emails/day | Switch to SendGrid (free tier: 100/day, paid for more) |
| No email delivery confirmation | We only know Gmail *accepted* the email, not that it was *delivered* | Use SendGrid webhooks for delivery/bounce/open events |
| Emails may land in spam | Gmail flags programmatically sent emails | Use a verified sending domain (SPF, DKIM, DMARC records) |
| No retry on failure | If Gmail's SMTP is temporarily down, the send just fails | Add retry logic with exponential backoff |
| Credentials in `.env` on one machine | Works locally, doesn't scale | Use a secrets manager (AWS Secrets Manager, Doppler) in production |

---

## Summary

| Component | Technology | Job |
|---|---|---|
| HTTP route | Express.js (`routes/send.js`) | Receive request, validate, delegate |
| Email logic | Nodemailer (`services/emailService.js`) | Connect to Gmail SMTP, send |
| Credentials | `.env` file | Store secrets securely off the codebase |
| Mail server | Gmail SMTP (`smtp.gmail.com:587`) | Actually deliver the email |
| Auth method | Gmail App Password | Authenticate without exposing main password |

The entire email service is **35 lines of code** across two files. Nodemailer handles all the complexity of SMTP — we just tell it what to send and where.

---

*Last updated: 2026-04-07*
