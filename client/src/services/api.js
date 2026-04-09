// All communication with the backend lives here.
// Components call these functions — they never touch fetch directly.

const BASE_URL = import.meta.env.VITE_API_URL || '';

// Returns the session ID stored in memory (set by App.jsx after OAuth redirect).
let _sessionId = null;
export function setSessionId(id) { _sessionId = id; }
export function getSessionId() { return _sessionId; }

// Wraps fetch with two extra protections:
//   1. Network error (server down) → friendly message instead of raw browser error
//   2. Non-JSON response (server crashed and returned an HTML page) → caught cleanly
async function safeFetch(url, options = {}) {
  // Attach session ID header to every request that has one
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (_sessionId) headers['X-Session-Id'] = _sessionId;

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch {
    throw new Error('Cannot reach the server. Please try again in a moment.');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      `Unexpected response from server (status ${response.status}). The server may have crashed.`
    );
  }

  return { response, data };
}

// Sends the raw user message to the backend for AI parsing.
// Returns: { to, subject, body, toConfidence }
export async function parseMessage(message, tone = 'raw') {
  const { response, data } = await safeFetch(`${BASE_URL}/api/parse`, {
    method: 'POST',
    body: JSON.stringify({ message, tone }),
  });

  if (!response.ok) {
    throw new Error(data.error || 'Failed to parse your message. Please try again.');
  }

  return data;
}

// Sends the final email details to the backend for delivery.
// Returns: { success: true, messageId }
export async function sendEmail({ to, subject, body }) {
  const { response, data } = await safeFetch(`${BASE_URL}/api/send`, {
    method: 'POST',
    body: JSON.stringify({ to, subject, body }),
  });

  if (!response.ok) {
    throw new Error(data.error || 'Failed to send the email. Please try again.');
  }

  return data;
}

// Returns the signed-in user's profile, or null if not authenticated.
export async function getMe() {
  if (!_sessionId) return null;
  const { response, data } = await safeFetch(`${BASE_URL}/auth/me`);
  if (!response.ok) return null;
  return data;
}

// Logs out the current session.
export async function logout() {
  await safeFetch(`${BASE_URL}/auth/logout`, { method: 'POST' });
  _sessionId = null;
}
