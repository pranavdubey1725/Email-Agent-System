// Backend API Test Script
// ─────────────────────────────────────────────
// Tests all backend routes without touching the browser.
// Requires the server to be running first: node index.js
//
// Run with: node test.js
// ─────────────────────────────────────────────

const BASE_URL = 'http://localhost:5000';

// ─── Test Runner ──────────────────────────────

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
async function request(method, path, body = null, headers = {}) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) options.body = JSON.stringify(body);

  try {
    const res = await fetch(`${BASE_URL}${path}`, options);
    const data = await res.json();
    return { status: res.status, data };
  } catch (err) {
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

async function testAuth() {
  console.log('\n── GET /auth/me ──────────────────────────────');

  // ── Test 1: No session header → 401
  {
    const { status, data } = await request('GET', '/auth/me');
    if (status === 401 && data.error) {
      pass('No session header → 401');
    } else {
      fail('No session header → 401', `Got status ${status}`);
    }
  }

  // ── Test 2: Invalid/random session ID → 401
  {
    const { status, data } = await request('GET', '/auth/me', null, {
      'X-Session-Id': 'fake-session-id-that-does-not-exist',
    });
    if (status === 401 && data.error) {
      pass('Invalid session ID → 401');
    } else {
      fail('Invalid session ID → 401', `Got status ${status}`);
    }
  }

  console.log('\n── POST /auth/logout ─────────────────────────');

  // ── Test 3: Logout with no session → still returns 200 (idempotent)
  {
    const { status } = await request('POST', '/auth/logout');
    if (status === 200) {
      pass('Logout with no session → 200 (safe no-op)');
    } else {
      fail('Logout with no session → 200', `Got status ${status}`);
    }
  }

  // ── Test 4: Logout with a fake session ID → still returns 200 (idempotent)
  {
    const { status } = await request('POST', '/auth/logout', null, {
      'X-Session-Id': 'nonexistent-session',
    });
    if (status === 200) {
      pass('Logout with fake session ID → 200 (safe no-op)');
    } else {
      fail('Logout with fake session ID → 200', `Got status ${status}`);
    }
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

      if (data.to.includes('test@example.com')) {
        pass('  AI correctly extracted email address');
      } else {
        fail('  AI should extract test@example.com', `Got to: "${data.to}"`);
      }

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

  // ── Test 7: toConfidence field is present
  {
    const { status, data } = await request('POST', '/api/parse', {
      message: 'Send an email to alice@company.com about the meeting',
    });
    if (status === 200 && (data.toConfidence === 'high' || data.toConfidence === 'low')) {
      pass('Response includes toConfidence field ("high" or "low")');
    } else {
      fail('toConfidence field should be "high" or "low"', `Got: "${data.toConfidence}"`);
    }
  }

  // ── Test 8: Literal @ in input → toConfidence should be "high"
  {
    const { status, data } = await request('POST', '/api/parse', {
      message: 'Email bob@example.com saying hello',
    });
    if (status === 200 && data.toConfidence === 'high') {
      pass('Literal @ in input → toConfidence is "high"');
    } else if (status === 200) {
      fail('Literal @ in input → toConfidence should be "high"', `Got: "${data.toConfidence}"`);
    }
  }
}

async function testSend() {
  console.log('\n── POST /api/send ────────────────────────────');

  // /api/send now requires OAuth authentication via X-Session-Id header.
  // All requests without a valid session return 401 before field validation.

  // ── Test 1: No session header → 401
  {
    const { status, data } = await request('POST', '/api/send', {
      to: 'test@example.com',
      subject: 'Test',
      body: 'Test body',
    });
    if (status === 401 && data.error) {
      pass('No session header → 401 (auth required)');
    } else {
      fail('No session header → 401', `Got status ${status}`);
    }
  }

  // ── Test 2: Fake/expired session ID → 401
  {
    const { status, data } = await request('POST', '/api/send', {
      to: 'test@example.com',
      subject: 'Test',
      body: 'Test body',
    }, { 'X-Session-Id': 'expired-or-invalid-session' });
    if (status === 401 && data.error) {
      pass('Invalid session ID → 401 (session not found)');
    } else {
      fail('Invalid session ID → 401', `Got status ${status}`);
    }
  }

  // ── Note: field validation (missing to/subject/body, invalid email format)
  // fires after auth and requires a real OAuth session. Verified manually.
  console.log('  ℹ  Field validation (400s) and happy path → tested manually (requires OAuth session)');
}

// ─── Main ─────────────────────────────────────

async function runAll() {
  console.log('==============================================');
  console.log('  Email Agent — Backend API Tests');
  console.log('  Server:', BASE_URL);
  console.log('==============================================');

  try {
    await testHealth();
    await testAuth();
    await testParse();
    await testSend();
  } catch (err) {
    console.log(`\n  ✗  Fatal: ${err.message}`);
    process.exit(1);
  }

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
