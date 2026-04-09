import { google } from 'googleapis';

// Builds an OAuth2 client pre-loaded with the user's stored tokens.
function buildAuth(accessToken, refreshToken) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return oauth2Client;
}

// Encodes a plain-text email as base64url RFC 2822.
function buildRawMessage({ senderName, senderEmail, to, subject, body }) {
  const lines = [
    `From: ${senderName} <${senderEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
  ];
  return Buffer.from(lines.join('\r\n')).toString('base64url');
}

// Sends an email on behalf of the authenticated user via Gmail API.
// Returns the Gmail message ID.
export async function sendEmailViaGmail({ accessToken, refreshToken, senderName, senderEmail, to, subject, body }) {
  const auth = buildAuth(accessToken, refreshToken);
  const gmail = google.gmail({ version: 'v1', auth });

  const raw = buildRawMessage({ senderName, senderEmail, to, subject, body });

  try {
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });
    return result.data.id;
  } catch (err) {
    const msg = err.message || '';

    if (err.status === 401 || msg.includes('invalid_grant') || msg.includes('Token has been expired')) {
      throw new Error('Your Google session has expired. Please sign in again.');
    }

    if (err.status === 403 || msg.includes('insufficientPermissions')) {
      throw new Error('Gmail permission denied. Please sign in again and allow sending permission.');
    }

    if (msg.includes('invalid') && msg.includes('To')) {
      throw new Error(`The recipient address "${to}" was rejected by Gmail. Please double-check it.`);
    }

    throw new Error(`Email could not be sent: ${msg}`);
  }
}
