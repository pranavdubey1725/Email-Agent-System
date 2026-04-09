# Email Service — In-Depth Technical Report

> **Purpose:** A complete explanation of how the email sending feature works in this project — from the user signing in with Google, to the email landing in the recipient's inbox. Written to be understood without prior backend experience.

---

## Table of Contents

1. [The Big Picture](#1-the-big-picture)
2. [Why Google OAuth 2.0?](#2-why-google-oauth-20)
3. [What is OAuth 2.0?](#3-what-is-oauth-20)
4. [What is the Gmail API?](#4-what-is-the-gmail-api)
5. [The OAuth Flow — Step by Step](#5-the-oauth-flow--step-by-step)
6. [Session Management](#6-session-management)
7. [The Full Send Flow](#7-the-full-send-flow)
8. [File-by-File Breakdown](#8-file-by-file-breakdown)
9. [What the Email Looks Like When It Arrives](#9-what-the-email-looks-like-when-it-arrives)
10. [Why This Architecture](#10-why-this-architecture)
11. [Previous Approach — Nodemailer + SMTP](#11-previous-approach--nodemailer--smtp)
12. [Limitations & What You'd Change in Production](#12-limitations--what-youd-change-in-production)

---

## 1. The Big Picture

When the user clicks **Send Email** in the confirmation form, here is what happens at a high level:

```
Browser (React)
    │
    │  POST /api/send  { to, subject, body }
    │  Header: X-Session-Id: <session id>
    ▼
Express Server (Node.js)
    │
    │  Looks up the session → gets the user's OAuth access token
    │  Validates the email fields
    │  Calls gmailService.sendEmailViaGmail()
    ▼
Gmail API (googleapis)
    │
    │  Authenticates using the user's access token
    │  Builds an RFC 2822 encoded email message
    │  Calls gmail.users.messages.send()
    ▼
Gmail
    │
    │  Delivers the email from the user's own Gmail account
    ▼
Recipient's Inbox
```

Three things are involved:
- **Your Express server** — receives the request, verifies the session, passes it to the Gmail API
- **googleapis** — Google's official Node.js SDK that handles the Gmail API communication
- **Gmail API** — Google's REST API for Gmail, which delivers the email from the user's own account

---

## 2. Why Google OAuth 2.0?

The previous approach (Nodemailer + Gmail SMTP + App Password) had a fundamental limitation: **all emails were sent from one fixed Gmail account** — whoever owned the App Password in `.env`. This means:

- Every user's email appeared to come from the same address
- The App Password had to be rotated manually if it expired or was revoked
- The owner's personal Gmail account bore all the sending load
- It couldn't scale to multiple users

With Google OAuth 2.0:
- **Each user signs in with their own Google account**
- Emails are sent from their own Gmail address
- No passwords are stored — Google handles authentication
- If the user revokes access, the app immediately loses the ability to send on their behalf
- The app only gets the `gmail.send` permission — it cannot read, delete, or modify any emails

---

## 3. What is OAuth 2.0?

**OAuth 2.0** is an open standard for delegated authorisation. It allows users to grant an application limited access to their account on another service, without giving the application their password.

Think of it like a hotel key card:
- The hotel (Google) issues a key card (access token) that only opens specific doors
- The guest (user) decides which doors to grant access to
- The app uses the key card — it never sees the master key (password)
- The hotel can deactivate the key card at any time

The flow:
1. The app redirects the user to Google's sign-in page
2. The user logs in to Google and sees what permissions the app is requesting
3. The user approves (or denies)
4. Google issues an **access token** (short-lived, ~1 hour) and a **refresh token** (long-lived)
5. The app uses the access token to make API calls on behalf of the user

The user's password is never sent to our server — only to Google. Our server only ever sees the tokens.

---

## 4. What is the Gmail API?

The **Gmail API** is Google's official REST API for programmatic access to Gmail. Unlike SMTP (which is a raw protocol for delivering emails), the Gmail API:

- Uses OAuth 2.0 for authentication — no passwords
- Sends from the authenticated user's own account
- Works with Google's modern security infrastructure
- Respects the specific permissions the user granted (we only request `gmail.send`)

The `googleapis` npm package is Google's official Node.js client for all Google APIs, including Gmail.

```js
import { google } from 'googleapis';

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedMessage } });
```

`userId: 'me'` means "the currently authenticated user" — Gmail knows who that is from the access token.

---

## 5. The OAuth Flow — Step by Step

### Step 1 — User clicks "Sign in with Google"

`Login.jsx` does a full-page redirect to the backend:

```js
window.location.href = `${BASE_URL}/auth/google`;
```

This is a browser redirect, not a `fetch` call. The user's browser navigates away from the app entirely.

---

### Step 2 — Backend generates the consent URL

`server/routes/auth.js` builds a Google OAuth URL:

```js
const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
const url = auth.generateAuthUrl({
  access_type: 'offline',
  scope: [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.send',
  ],
  prompt: 'consent',
});
res.redirect(url);
```

`access_type: 'offline'` requests a refresh token (so the app can re-authenticate after the access token expires without asking the user to sign in again).

`prompt: 'consent'` forces Google to always show the consent screen and always return a fresh refresh token.

---

### Step 3 — Google shows the consent screen

The user sees a Google-branded page listing exactly what the app is requesting:
- "Send email on your behalf"

The user can approve or deny.

---

### Step 4 — Google redirects to the callback

After approval, Google redirects the browser to the `GOOGLE_REDIRECT_URI`:

```
https://email-agent-system-8kix.onrender.com/auth/google/callback?code=4/0AbcDef...
```

The `code` is a one-time authorisation code.

---

### Step 5 — Backend exchanges the code for tokens

```js
const { tokens } = await auth.getToken(code);
// tokens = { access_token, refresh_token, expiry_date, ... }
```

This is a server-to-server call — the code is exchanged for real tokens. The tokens never touch the user's browser.

---

### Step 6 — Backend creates a session

A session is created with the tokens and the user's profile:

```js
const sessionId = createSession({
  accessToken: tokens.access_token,
  refreshToken: tokens.refresh_token,
  email: userInfo.email,
  name: userInfo.name,
});
```

The session lives in an in-memory `Map` on the server. The `sessionId` is a UUID.

---

### Step 7 — Backend redirects to the frontend with the session ID

```js
res.redirect(`${process.env.FRONTEND_URL}?session=${sessionId}`);
```

The browser lands back on the frontend with the session ID in the URL query string.

---

### Step 8 — Frontend picks up the session

`App.jsx` reads the `?session=` param on mount:

```js
const params = new URLSearchParams(window.location.search);
const sessionId = params.get('session');
localStorage.setItem('sessionId', sessionId);
setSessionId(sessionId); // stores in api.js module variable
```

The URL is cleaned up (`window.history.replaceState`), and the session ID is stored in `localStorage` for persistence across page refreshes.

---

## 6. Session Management

### How sessions are stored

`server/services/sessionStore.js` maintains a `Map` in memory:

```js
const sessions = new Map();

export function createSession(data) {
  const id = crypto.randomUUID();
  sessions.set(id, { ...data, createdAt: Date.now() });
  return id;
}
```

Each entry holds `{ accessToken, refreshToken, email, name, createdAt }`.

### How the frontend uses the session

`client/src/services/api.js` stores the session ID in a module-level variable and attaches it to every request as a header:

```js
let _sessionId = null;

async function safeFetch(url, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (_sessionId) headers['X-Session-Id'] = _sessionId;
  // ...
}
```

Using a custom `X-Session-Id` header (rather than cookies) avoids CORS credential complexity and works cleanly across different origins (Vercel frontend ↔ Render backend).

### Session persistence across page refreshes

On mount, `App.jsx` reads from `localStorage`:

```js
const sessionId = sessionFromUrl || localStorage.getItem('sessionId');
setSessionId(sessionId);
const me = await getMe(); // hits /auth/me to verify the session is still valid
if (!me) localStorage.removeItem('sessionId'); // session expired — clean up
```

If the server has restarted (in-memory sessions are lost), `/auth/me` returns `401` and the user is taken back to the sign-in screen.

### Sign-out

`POST /auth/logout` deletes the session from the `Map`. The frontend then clears `localStorage` and resets to the sign-in screen.

---

## 7. The Full Send Flow

Here is every step that happens when the user clicks Send Email, after authentication is established:

### Step 1 — Frontend sends the request

`client/src/services/api.js`:

```js
fetch('/api/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Session-Id': sessionId,
  },
  body: JSON.stringify({ to, subject, body })
})
```

---

### Step 2 — Backend verifies the session

`server/routes/send.js`:

```js
const session = getSession(req.headers['x-session-id']);
if (!session) return res.status(401).json({ error: 'Not signed in. Please sign in with Google first.' });
```

If the session is missing or expired: `401` immediately. The Gmail API is never called.

---

### Step 3 — Field validation

```js
if (!to || !subject || !body) return res.status(400).json({ error: '...' });
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(to)) return res.status(400).json({ error: '...' });
```

Same validation as before — catches missing fields and malformed addresses before making any external API call.

---

### Step 4 — gmailService builds and sends the email

`server/services/gmailService.js`:

```js
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oauth2Client.setCredentials({ access_token, refresh_token });

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

// Build RFC 2822 message
const lines = [
  `From: ${senderName} <${senderEmail}>`,
  `To: ${to}`,
  `Subject: ${subject}`,
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=UTF-8',
  '',
  body,
];
const raw = Buffer.from(lines.join('\r\n')).toString('base64url');

await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
```

**RFC 2822** is the standard email message format. The message must be base64url-encoded before being sent to the Gmail API.

`userId: 'me'` tells the Gmail API to send as the authenticated user — whose identity comes from the access token.

---

### Step 5 — Response sent back to frontend

```js
res.json({ success: true, messageId: result.data.id });
```

The frontend moves to the `'sent'` step and shows the success screen.

---

## 8. File-by-File Breakdown

### `server/routes/auth.js`
**Role:** Owns the entire OAuth flow — four endpoints.

```
GET  /auth/google           → redirect to Google consent screen
GET  /auth/google/callback  → exchange code, create session, redirect to frontend
GET  /auth/me               → return { email, name } for current session
POST /auth/logout            → delete session
```

### `server/services/sessionStore.js`
**Role:** In-memory session store. A `Map` from session ID (UUID) to `{ accessToken, refreshToken, email, name, createdAt }`.

No database required. Sessions survive until the server restarts. On restart, users must sign in again — this is acceptable for a demo. In production you'd persist sessions to Redis or a database.

### `server/services/gmailService.js`
**Role:** Pure email-sending logic using the Gmail API.

```
buildAuth(accessToken, refreshToken)  → creates an authenticated OAuth2 client
buildRawMessage({ senderName, senderEmail, to, subject, body })  → RFC 2822 base64url
sendEmailViaGmail({ ...tokens, senderName, senderEmail, to, subject, body })  → sends
```

Error classification:
| Error | User-facing message |
|---|---|
| `401`, `invalid_grant`, `Token has been expired` | "Your Google session has expired. Please sign in again." |
| `403`, `insufficientPermissions` | "Gmail permission denied. Please sign in again." |
| Invalid `To` address | "The recipient address was rejected by Gmail." |
| Anything else | "Email could not be sent: [original error]" |

### `server/routes/send.js`
**Role:** HTTP layer for email sending. Verifies session, validates fields, delegates to `gmailService`.

### `client/src/components/Login.jsx`
**Role:** The sign-in screen shown to unauthenticated users. One Google-styled button that redirects to `/auth/google`.

### `client/src/App.jsx`
**Role:** Manages auth state. On mount, reads `?session=` from URL or `localStorage`, verifies with `/auth/me`, shows `<Login>` if not authenticated, shows the full app if authenticated.

### `client/src/services/api.js`
**Role:** All backend communication. Attaches `X-Session-Id` header to every request. Exports `getMe()` and `logout()` in addition to `parseMessage()` and `sendEmail()`.

---

## 9. What the Email Looks Like When It Arrives

When the recipient opens the email, they see:

```
From:    Pranav Dubey <pranavdubey1725@gmail.com>
To:      recipient@example.com
Subject: [whatever GPT generated]

[Body — written by GPT or the user's own words, depending on tone]
```

The **From** name and address are the signed-in user's actual Gmail identity — not a generic "Email Agent" display name. The email looks like it came directly from the user, because it did.

---

## 10. Why This Architecture

### Why OAuth over SMTP + App Password?

| | SMTP + App Password | OAuth 2.0 + Gmail API |
|---|---|---|
| Sends from | One fixed account | The signed-in user's own account |
| Credentials stored | App Password in `.env` | Only tokens, not passwords |
| Multi-user support | No | Yes |
| Revocable | Only by deleting the App Password | User can revoke from Google Account at any time |
| Security scope | SMTP access to one account | `gmail.send` only — can't read, delete, or modify |
| Google's direction | Deprecated for apps | The recommended modern approach |

### Why in-memory sessions over cookies?

Cookies require `SameSite` and `Secure` settings to work cross-origin, plus `withCredentials: true` on every fetch. Custom headers (`X-Session-Id`) work cleanly without any of that complexity. For a project with a split Vercel/Render deployment, headers are simpler.

### Why `googleapis` over raw HTTP calls?

`googleapis` handles OAuth token refresh automatically. If an access token expires during a session, the library uses the refresh token to get a new one transparently. With raw HTTP calls, you'd have to implement this yourself.

---

## 11. Previous Approach — Nodemailer + SMTP

The original implementation used:
- **Nodemailer** — a Node.js library for SMTP communication
- **Gmail SMTP** (`smtp.gmail.com:465`) — Gmail's mail delivery server
- **Gmail App Password** — a 16-character credential for programmatic SMTP access

It worked, but had three problems in production:
1. **IPv6 on Render**: Gmail's SMTP server resolved to an IPv6 address (`2607:f8b0:...`), but Render's free tier doesn't support IPv6. Fixed temporarily with `dns.setDefaultResultOrder('ipv4first')` and `family: 4` on the transporter.
2. **Fixed sender**: All emails came from the same Gmail account, not from the user.
3. **App Password management**: The 16-character password needed to be rotated manually and shared between deployments.

The switch to OAuth 2.0 resolved all three of these permanently.

---

## 12. Limitations & What You'd Change in Production

| Limitation | Why it exists | Production fix |
|---|---|---|
| In-memory sessions | Simple to implement, no database needed | Use Redis or a database-backed session store |
| Sessions lost on server restart | In-memory only | Persist sessions to Redis with expiry |
| No token refresh handling in UI | If access token expires mid-session, send fails | Catch `401` from Gmail API, redirect to re-auth |
| No email delivery confirmation | Gmail API confirms acceptance, not delivery | Use Gmail's `users.messages.get` to check sent status |
| Single scope | Only `gmail.send` — can't check if email was received | Add read scopes if building a full email client |
| Testing mode in Google Cloud | Only approved test users can sign in | Go through Google's OAuth verification process |

---

## Summary

| Component | Technology | Job |
|---|---|---|
| Auth flow | Google OAuth 2.0 (`/auth/google`, `/auth/google/callback`) | Get user consent, exchange code for tokens |
| Session store | In-memory `Map` (`sessionStore.js`) | Hold tokens between requests |
| Send route | Express (`routes/send.js`) | Auth check, field validation, delegate |
| Gmail API client | `googleapis` (`gmailService.js`) | Build RFC 2822 message, send via Gmail API |
| Frontend auth | `Login.jsx`, `App.jsx`, `api.js` | Show sign-in screen, store session ID, attach header |

---

*Last updated: 2026-04-10*
