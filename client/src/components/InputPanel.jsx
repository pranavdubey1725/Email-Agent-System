import { useState } from 'react';
import useWhisper from '../hooks/useWhisper';
import './InputPanel.css';

const EXAMPLES = [
  'Send an email to alex@company.com about the project update meeting on Friday',
  "Email sarah@gmail.com and tell her I'll be 10 minutes late to the call",
  'Write to boss@work.com asking for a day off next Monday',
];

const MAX_CHARS = 500;

// The four tone options.
// label    — shown on the button
// value    — sent to the backend
// hint     — shown below the selector to explain the choice
const TONES = [
  {
    value: 'raw',
    label: 'Raw',
    hint: 'Sends your exact words — GPT only extracts the recipient and subject.',
  },
  {
    value: 'formal',
    label: 'Formal',
    hint: 'Professional and polished language.',
  },
  {
    value: 'friendly',
    label: 'Friendly',
    hint: 'Warm and conversational, but grammatically clean.',
  },
  {
    value: 'concise',
    label: 'Concise',
    hint: 'No fluff — just the core message, as short as possible.',
  },
];

// InputPanel handles all user input — text and voice — plus tone selection.
// Props:
//   onSubmit(message, tone) — called when user submits
//   isLoading: bool         — disables the form while backend is processing
function InputPanel({ onSubmit, isLoading }) {
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('raw'); // default to Raw

  const { isRecording, isTranscribing, error: voiceError, startRecording, stopRecording } =
    useWhisper({
      onTranscriptChange: (transcript) => setMessage(transcript),
    });

  const isListening = isRecording || isTranscribing;

  const charCount = message.length;
  const isOverLimit = charCount > MAX_CHARS;
  const isEmpty = message.trim() === '';
  const activeTone = TONES.find(t => t.value === tone);

  function handleSubmit(e) {
    e.preventDefault();
    if (isEmpty || isOverLimit || isLoading) return;
    onSubmit(message.trim(), tone); // pass both message AND tone
  }

  function handleMicClick() {
    if (isRecording) {
      stopRecording();
    } else if (!isTranscribing) {
      setMessage('');
      startRecording();
    }
  }

  return (
    <div className="input-panel">
      <div className="input-panel__header">
        <h2 className="input-panel__title">What would you like to send?</h2>
        <p className="input-panel__subtitle">
          Describe your email in plain English — who to send it to, what it&apos;s about, and what you want to say.
        </p>
      </div>

      {/* ── Tone selector ───────────────────────────────────── */}
      <div className="tone-selector" role="group" aria-label="Email tone">
        <span className="tone-selector__label">Tone:</span>
        <div className="tone-selector__options">
          {TONES.map(t => (
            <button
              key={t.value}
              type="button"
              className={`tone-btn ${tone === t.value ? 'tone-btn--active' : ''}`}
              onClick={() => setTone(t.value)}
              disabled={isLoading || isListening}
              aria-pressed={tone === t.value}
            >
              {t.label}
            </button>
          ))}
        </div>
        {/* Hint line — updates as the user changes tone */}
        <p className="tone-selector__hint">{activeTone.hint}</p>
      </div>

      {/* ── Voice / input mode row ───────────────────────────── */}
      <div className="input-panel__modes" role="group" aria-label="Input mode">
        <span className="input-mode-label">Input via:</span>
        <button
          type="button"
          className={`mic-btn ${isRecording ? 'mic-btn--active' : ''}`}
          onClick={handleMicClick}
          disabled={isLoading || isTranscribing}
          aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          {isRecording ? 'Listening...' : isTranscribing ? 'Transcribing...' : 'Voice'}
        </button>
      </div>

      {isRecording && (
        <div className="recording-indicator" role="status" aria-live="polite">
          <span className="recording-indicator__dot" aria-hidden="true" />
          Listening — speak now. Click the mic again to stop.
        </div>
      )}
      {isTranscribing && (
        <div className="recording-indicator" role="status" aria-live="polite">
          <span className="recording-indicator__dot" aria-hidden="true" />
          Transcribing with Whisper...
        </div>
      )}

      {voiceError && (
        <p className="input-panel__error" role="alert">{voiceError}</p>
      )}

      <form onSubmit={handleSubmit} className="input-panel__form">
        <div className="input-panel__textarea-wrapper">
          <textarea
            className={`input-panel__textarea ${isOverLimit ? 'input-panel__textarea--error' : ''}`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              isRecording
                ? 'Listening — your speech will appear here...'
                : isTranscribing
                ? 'Transcribing with Whisper...'
                : "e.g. Send an email to john@example.com about the meeting tomorrow, tell him I'll be 10 minutes late"
            }
            rows={5}
            disabled={isLoading || isRecording || isTranscribing}
            aria-label="Email intent input"
            aria-describedby="char-count"
          />
          <span
            id="char-count"
            className={`input-panel__char-count ${isOverLimit ? 'input-panel__char-count--error' : ''}`}
          >
            {charCount} / {MAX_CHARS}
          </span>
        </div>

        {isOverLimit && (
          <p className="input-panel__error" role="alert">
            Message is too long. Please shorten it to under {MAX_CHARS} characters.
          </p>
        )}

        <div className="input-panel__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setMessage('')}
            disabled={isEmpty || isLoading || isListening}
          >
            Clear
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={isEmpty || isOverLimit || isLoading || isListening}
          >
            {isLoading ? (
              <>
                <span className="btn__spinner" aria-hidden="true" />
                Parsing...
              </>
            ) : (
              <>
                Continue
                <span className="btn__arrow" aria-hidden="true">→</span>
              </>
            )}
          </button>
        </div>
      </form>

      <div className="input-panel__examples">
        <p className="input-panel__examples-label">Try an example:</p>
        <ul className="input-panel__examples-list">
          {EXAMPLES.map((example) => (
            <li key={example}>
              <button
                type="button"
                className="example-chip"
                onClick={() => setMessage(example)}
                disabled={isLoading || isListening}
              >
                {example}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default InputPanel;
