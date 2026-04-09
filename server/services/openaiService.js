import OpenAI from 'openai';

function getClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 20000,
    maxRetries: 1,
  });
}

const TONE_INSTRUCTIONS = {
  formal:
    'Rewrite the email body in formal, professional language. Use complete sentences, proper salutations if appropriate, and polished phrasing. Avoid contractions and casual words. Example: "Can we meet?" becomes "I would like to request a meeting at your earliest convenience."',
  friendly:
    'Rewrite the email body in a warm, friendly tone. Use natural conversational language, contractions are fine, keep it personal and approachable. Example: "Can we meet?" becomes "Hey! Would love to find a time to catch up — let me know when works for you!"',
  concise:
    'Rewrite the email body as briefly as possible — one or two sentences maximum. Strip everything except the core ask or statement. No greetings, no sign-off, no filler. Example: "Can we meet?" stays as "Can we meet?"',
};

// The confidence instruction is the same for all tones —
// appended to every prompt so GPT always rates its certainty on the "to" field.
const CONFIDENCE_INSTRUCTION = `
- "to_confidence": rate your confidence in the "to" field as either "high" or "low".
  Use "high" only when a complete, clearly stated email address was present in the input.
  Use "low" when: no email was found, the address was partially spoken or guessed, the input was ambiguous, or you inferred it from a name rather than reading it directly.`;

// Shared helper — parses and validates the JSON GPT returns.
function parseGPTResponse(raw) {
  if (!raw) throw new Error('OpenAI returned an empty response. Please try again.');
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('OpenAI returned a response that could not be read. Please try again.');
  }
}

// Shared helper — normalises the four fields we care about.
// message: the original user input — used to cross-check GPT's confidence claim.
function normalise(parsed, message = '', bodyOverride = null) {
  const to = typeof parsed.to === 'string' ? parsed.to.trim() : '';

  // GPT sometimes rates its own confidence as "high" even when it reconstructed
  // an address from spoken input (e.g. "at the rate", "dot com").
  // Rule: if the extracted address contains @ but the original message does not,
  // GPT must have inferred/reconstructed it — override to "low" regardless.
  const gptSaysHigh = parsed.to_confidence === 'high';
  const addressWasInInput = message.includes('@');
  const toConfidence = (gptSaysHigh && (to === '' || addressWasInInput)) ? 'high' : 'low';

  return {
    to,
    subject:      typeof parsed.subject === 'string' ? parsed.subject.trim() : '',
    body:         bodyOverride !== null ? bodyOverride
                  : (typeof parsed.body === 'string' ? parsed.body.trim() : ''),
    toConfidence,
  };
}

// Parses a natural language message into structured email fields.
// tone: 'raw' | 'formal' | 'friendly' | 'concise'
// Returns: { to, subject, body, toConfidence: 'high' | 'low' }
export async function parseEmailIntent(message, tone = 'raw') {
  const client = getClient();

  // ── Raw tone ─────────────────────────────────────────────────────────────
  if (tone === 'raw') {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an email parsing assistant. Extract email details from the user's message.
The input may come from voice dictation and may contain speech-to-text errors — correct obvious errors only in the "to" field.

Return valid JSON with exactly these four fields:
- "to": the recipient's email address (empty string "" if not found)
- "subject": a concise subject line (infer from context if not explicit)
- "body": ONLY the message the user wants to send — copy their exact words verbatim. Strip the command wrapper (e.g. "send an email to X saying") and return just the content. Do NOT rephrase, clean up, expand, or modify in any way.
${CONFIDENCE_INSTRUCTION}

Never include explanations — only return the JSON object.`,
        },
        { role: 'user', content: message },
      ],
    });

    const parsed = parseGPTResponse(response.choices[0]?.message?.content);
    return normalise(parsed, message);
  }

  // ── Formal / Friendly / Concise ───────────────────────────────────────────
  const toneInstruction = TONE_INSTRUCTIONS[tone];

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are an email parsing assistant. Extract email details from the user's message.
The input may come from voice dictation and may contain speech-to-text errors — correct them when obvious.

Tone instruction: ${toneInstruction}

Return valid JSON with exactly these four fields:
- "to": the recipient's email address (empty string "" if not found)
- "subject": a concise subject line (infer from context if not explicit)
- "body": the email body following the tone instruction above. Write ONLY what the user said — do not add filler phrases, greetings the user didn't ask for, or [Your Name] placeholders.
${CONFIDENCE_INSTRUCTION}

Never include explanations — only return the JSON object.`,
      },
      { role: 'user', content: message },
    ],
  });

  const parsed = parseGPTResponse(response.choices[0]?.message?.content);
  return normalise(parsed, message);
}
