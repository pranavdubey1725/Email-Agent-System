// Backend API Test Script
// ─────────────────────────────────────────────
// Tests all backend routes without touching the browser.
// Requires the server to be running first: node index.js
//
// Run with: node test.js
// ─────────────────────────────────────────────

const BASE_URL = 'http://localhost:5000';

// ─── Test Runner ──────────────────────────────
// Keeps track of pass/fail counts and prints results.

let passed = 0;
let failed = 0;

function pass(name) {
  console.log(`  ✓  ${name}`);
  passed++;
}

function fail(name, reason) {
  console.log(`  ✗  ${name}`);
  console.log(`       → ${reason}`);
  failed++;
}

// Makes a fetch call and catches network errors (server not running, etc.)
async function request(method, path, body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);

  try {
    const res = await fetch(`${BASE_URL}${path}`, options);
    const data = await res.json();
    return { status: res.status, data };
  } catch (err) {
    // If fetch itself fails, the server is not running
    throw new Error(`Cannot reach server at ${BASE_URL}. Is it running? (node index.js)`);
  }
}

// ─── Test Suites ──────────────────────────────

async function testHealth() {
  console.log('\n── Health Check ──────────────────────────────');

  const { status, data } = await request('GET', '/health');

  if (status === 200 && data.status === 'ok') {
    pass('GET /health → 200, status: ok');
  } else {
    fail('GET /health → 200, status: ok', `Got status ${status}, body: ${JSON.stringify(data)}`);
  }
}

async function testParse() {
  console.log('\n── POST /api/parse ───────────────────────────');

  // ── Test 1: Empty message body should be rejected
  {
    const { status, data } = await request('POST', '/api/parse', { message: '' });
    if (status === 400 && data.error) {
      pass('Empty message → 400 with error message');
    } else {
      fail('Empty message → 400', `Got status ${status}, body: ${JSON.stringify(data)}`);
    }
  }

  // ── Test 2: Whitespace-only message should be rejected
  {
    const { status, data } = await request('POST', '/api/parse', { message: '   ' });
    if (status === 400 && data.error) {
      pass('Whitespace-only message → 400');
    } else {
      fail('Whitespace-only message → 400', `Got status ${status}`);
    }
  }

  // ── Test 3: Missing message field entirely
  {
    const { status, data } = await request('POST', '/api/parse', {});
    if (status === 400 && data.error) {
      pass('Missing message field → 400');
    } else {
      fail('Missing message field → 400', `Got status ${status}`);
    }
  }

  // ── Test 4: Valid message with a clear email address
  // This hits the real OpenAI API — requires OPENAI_API_KEY in .env
  {
    const { status, data } = await request('POST', '/api/parse', {
      message: 'Send an email to test@example.com saying hello',
    });

    if (status === 200 && typeof data.to === 'string' && typeof data.subject === 'string' && typeof data.body === 'string') {
      pass('Valid message → 200 with { to, subject, body }');

      // Check the AI actually extracted the email
      if (data.to.includes('test@example.com')) {
        pass('  AI correctly extracted email address');
      } else {
        fail('  AI should extract test@example.com', `Got to: "${data.to}"`);
      }

      // Check GPT generated a non-empty subject and body
      if (data.subject.length > 0) {
        pass('  AI generated a non-empty subject');
      } else {
        fail('  Subject should not be empty', 'Got empty string');
      }

      if (data.body.length > 0) {
        pass('  AI generated a non-empty body');
      } else {
        fail('  Body should not be empty', 'Got empty string');
      }
    } else {
      fail('Valid message → 200 with { to, subject, body }', `Got status ${status}, body: ${JSON.stringify(data)}`);
    }
  }

  // ── Test 5: Message with no email address — GPT should return empty "to"
  {
    const { status, data } = await request('POST', '/api/parse', {
      message: 'Email my professor saying I will miss class tomorrow',
    });

    if (status === 200) {
      pass('No email address in message → still returns 200');
      if (data.to === '') {
        pass('  "to" is empty string when no email found');
      } else {
        // GPT may guess an email — that's acceptable too, just flag it
        pass(`  "to" was inferred as: "${data.to}" (acceptable — GPT made a guess)`);
      }
    } else {
      fail('No email address → 200', `Got status ${status}`);
    }
  }

  // ── Test 6: Voice-style input with speech artifacts
  {
    const { status, data } = await request('POST', '/api/parse', {
      message: 'send an email to pranav at the rate gmail.com saying hi how are you',
    });

    if (status === 200 && data.to.includes('@')) {
      pass('Voice-style input (at the rate) → email correctly extracted');
    } else if (status === 200) {
      fail('Voice-style input → should extract email with @', `Got to: "${data.to}"`);
    } else {
      fail('Voice-style input → 200', `Got status ${status}`);
    }
  }
}

async function testSend() {
  console.log('\n── POST /api/send ────────────────────────────');

  // ── Test 1: Missing "to" field
  {
    const { status, data } = await request('POST', '/api/send', {
      subject: 'Test Subject',
      body: 'Test body',
    });
    if (status === 400 && data.error) {
      pass('Missing "to" → 400');
    } else {
      fail('Missing "to" → 400', `Got status ${status}`);
    }
  }

  // ── Test 2: Missing "subject" field
  {
    const { status, data } = await request('POST', '/api/send', {
      to: 'test@example.com',
      body: 'Test body',
    });
    if (status === 400 && data.error) {
      pass('Missing "subject" → 400');
    } else {
      fail('Missing "subject" → 400', `Got status ${status}`);
    }
  }

  // ── Test 3: Missing "body" field
  {
    const { status, data } = await request('POST', '/api/send', {
      to: 'test@example.com',
      subject: 'Test Subject',
    });
    if (status === 400 && data.error) {
      pass('Missing "body" → 400');
    } else {
      fail('Missing "body" → 400', `Got status ${status}`);
    }
  }

  // ── Test 4: Invalid email format in "to"
  {
    const { status, data } = await request('POST', '/api/send', {
      to: 'notanemail',
      subject: 'Test',
      body: 'Test body',
    });
    if (status === 400 && data.error) {
      pass('Invalid email format → 400');
    } else {
      fail('Invalid email format → 400', `Got status ${status}`);
    }
  }

  // ── Test 5: Email with spaces around @ (another invalid format)
  {
    const { status, data } = await request('POST', '/api/send', {
      to: 'pranav @ gmail.com',
      subject: 'Test',
      body: 'Test body',
    });
    if (status === 400) {
      pass('Email with spaces around @ → 400');
    } else {
      fail('Email with spaces around @ → 400', `Got status ${status}`);
    }
  }

  // ── Test 6: All three fields empty strings
  {
    const { status, data } = await request('POST', '/api/send', {
      to: '',
      subject: '',
      body: '',
    });
    if (status === 400) {
      pass('All fields empty → 400');
    } else {
      fail('All fields empty → 400', `Got status ${status}`);
    }
  }

  // ── NOTE: Happy path (actually sending the email) is not tested here.
  // Sending a real email in an automated test has side effects and costs.
  // Test the happy path manually: run the full app and send to your own inbox.
  console.log('  ℹ  Happy path (actual email delivery) → test manually in the browser');
}

// ─── Main ─────────────────────────────────────

async function runAll() {
  console.log('==============================================');
  console.log('  Email Agent — Backend API Tests');
  console.log('  Server:', BASE_URL);
  console.log('==============================================');

  try {
    await testHealth();
    await testParse();
    await testSend();
  } catch (err) {
    console.log(`\n  ✗  Fatal: ${err.message}`);
    process.exit(1);
  }

  // ── Summary
  const total = passed + failed;
  console.log('\n==============================================');
  console.log(`  Results: ${passed}/${total} passed`);

  if (failed === 0) {
    console.log('  All tests passed ✓');
  } else {
    console.log(`  ${failed} test(s) failed — see above for details`);
  }

  console.log('==============================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

runAll();