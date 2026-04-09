import './StatusMessage.css';

// Displays success, error, or info messages to the user.
// Props:
//   type: 'success' | 'error' | 'info'
//   message: string
//   onDismiss: () => void (optional — shows a dismiss button if provided)
function StatusMessage({ type, message, onDismiss }) {
  if (!message) return null;

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
  };

  return (
    <div className={`status-message status-message--${type}`} role="alert">
      <span className="status-message__icon" aria-hidden="true">
        {icons[type]}
      </span>
      <p className="status-message__text">{message}</p>
      {onDismiss && (
        <button
          type="button"
          className="status-message__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss message"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default StatusMessage;
