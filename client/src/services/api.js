// All communication with the backend lives here.
// Components call these functions — they never touch fetch directly.

const BASE_URL = import.meta.env.VITE_API_URL || '';

// Wraps fetch with two extra protections:
//   1. Network error (server down) → friendly message instead of raw browser error
//   2. Non-JSON response (server crashed and returned an HTML page) → caught cleanly
async function safeFetch(url, options) {
  let response;

  try {
    response = await fetch(url, options);
  } catch {
    // fetch itself threw — this means the server is completely unreachable
    throw new Error(
      'Cannot reach the server. Make sure it is running (node index.js) and try again.'
    );
  }

  // Try to parse the response as JSON.
  // If the server crashed hard it may return an HTML error page — handle that.
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
// Returns: { to, subject, body }
export async function parseMessage(message, tone = 'raw') {
  const { response, data } = await safeFetch(`${BASE_URL}/api/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, body }),
  });

  if (!response.ok) {
    throw new Error(data.error || 'Failed to send the email. Please try again.');
  }

  return data;
}
