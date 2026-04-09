import { useState, useEffect } from 'react';
import InputPanel from './components/InputPanel';
import ConfirmationForm from './components/ConfirmationForm';
import StatusMessage from './components/StatusMessage';
import { parseMessage, sendEmail } from './services/api';
import './App.css';

function App() {
  const [step, setStep] = useState('input');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [parsedEmail, setParsedEmail] = useState({ to: '', subject: '', body: '', toConfidence: 'high' });
  const [sentTo, setSentTo] = useState('');

  // ── Dark mode ──────────────────────────────────────────────────────────────
  // Read saved preference from localStorage — default to light
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  // Apply data-theme to <html> whenever isDark changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleInputSubmit(message, tone) {
    setIsLoading(true);
    setError(null);
    try {
      const result = await parseMessage(message, tone);
      setParsedEmail(result);
      setStep('confirmation');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSend(emailData) {
    setIsSending(true);
    setError(null);
    try {
      await sendEmail(emailData);
      setSentTo(emailData.to);
      setStep('sent');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  }

  function handleStartOver() {
    setParsedEmail({ to: '', subject: '', body: '' });
    setSentTo('');
    setError(null);
    setStep('input');
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const STEPS = ['input', 'confirmation', 'sent'];
  const currentIndex = STEPS.indexOf(step);

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__header-left">
          <div className="app__logo" aria-hidden="true">✉</div>
          <div>
            <h1 className="app__title">Email Agent</h1>
            <p className="app__tagline">Compose emails with voice or text</p>
          </div>
        </div>

        {/* Dark mode toggle */}
        <button
          className="theme-toggle"
          onClick={() => setIsDark(prev => !prev)}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Light mode' : 'Dark mode'}
        >
          {isDark ? (
            /* Sun icon — outline style */
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            /* Moon icon — outline style */
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
          {isDark ? 'Light' : 'Dark'}
        </button>
      </header>

      {/* Step indicator */}
      <nav className="app__steps" aria-label="Progress">
        {['Input', 'Review', 'Sent'].map((label, i) => {
          const isActive = currentIndex === i;
          const isComplete = currentIndex > i;
          return (
            <div
              key={label}
              className={`step-dot ${isActive ? 'step-dot--active' : ''} ${isComplete ? 'step-dot--complete' : ''}`}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className="step-dot__number">{isComplete ? '✓' : i + 1}</span>
              <span className="step-dot__label">{label}</span>
            </div>
          );
        })}
      </nav>

      <main className="app__card">
        {error && (
          <StatusMessage
            type="error"
            message={error}
            onDismiss={() => setError(null)}
          />
        )}

        {/* step-content class triggers the fade-in animation on every step change */}
        <div className="step-content" key={step}>
          {step === 'input' && (
            <InputPanel onSubmit={handleInputSubmit} isLoading={isLoading} />
          )}

          {step === 'confirmation' && (
            <ConfirmationForm
              initialData={parsedEmail}
              toConfidence={parsedEmail.toConfidence}
              onSend={handleSend}
              onBack={() => setStep('input')}
              isSending={isSending}
            />
          )}

          {step === 'sent' && (
            <div className="success-screen">
              <div className="success-screen__icon" aria-hidden="true">✓</div>
              <h2 className="success-screen__title">Email sent!</h2>
              <p className="success-screen__detail">
                Your email was delivered to <strong>{sentTo}</strong>.
              </p>
              <button className="btn btn--primary" onClick={handleStartOver}>
                Send another email
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
