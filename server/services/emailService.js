import nodemailer from 'nodemailer';

// Checks that the required Gmail credentials are present in .env before
// attempting any connection. Fails early with a clear message if they're missing.
function checkCredentials() {
  if (!process.env.GMAIL_USER) {
    throw new Error('GMAIL_USER is not set in your .env file.');
  }
  if (!process.env.GMAIL_APP_PASSWORD) {
    throw new Error('GMAIL_APP_PASSWORD is not set in your .env file.');
  }
}

function createTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    family: 4,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

// Sends an email and returns the nodemailer result (includes messageId).
// Params: { to: string, subject: string, body: string }
export async function sendEmail({ to, subject, body }) {
  checkCredentials();

  const transporter = createTransporter();

  const mailOptions = {
    from: `"Email Agent" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text: body,
    html: `<p>${body.replace(/\n/g, '<br>')}</p>`,
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    return result;
  } catch (err) {
    // Classify SMTP errors into user-friendly messages
    const msg = err.message || '';

    if (msg.includes('Invalid login') || msg.includes('Username and Password not accepted') || msg.includes('535')) {
      throw new Error(
        'Gmail login failed. Your App Password may be wrong or expired. ' +
        'Go to your Google Account → Security → App Passwords and generate a new one.'
      );
    }

    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('ETIMEDOUT')) {
      throw new Error(
        'Could not connect to Gmail. Check your internet connection and try again.'
      );
    }

    if (msg.includes('550') || msg.includes('5.1.1') || msg.includes('invalid address')) {
      throw new Error(
        `The recipient address "${to}" was rejected by Gmail. Please double-check it.`
      );
    }

    // Unknown SMTP error — include the original message for debugging
    throw new Error(`Email could not be sent: ${msg}`);
  }
}
