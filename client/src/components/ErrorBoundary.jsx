import { Component } from 'react';

// ErrorBoundary is a React class component that catches any JavaScript error
// thrown by its child components during rendering.
//
// Without this, a crash in any component makes the entire page go blank
// with no message — the user sees nothing and doesn't know what happened.
//
// With this, they see a friendly error screen with a button to recover.

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  // Called when a child component throws — lets us update state to show the fallback UI
  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected error occurred.',
    };
  }

  // Called after the error is captured — good place to log it
  componentDidCatch(error, info) {
    console.error('Uncaught component error:', error, info);
  }

  handleReset() {
    // Clear the error state and let React try to render the children again
    this.setState({ hasError: false, errorMessage: '' });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary__icon" aria-hidden="true">⚠</div>
          <h2 className="error-boundary__title">Something went wrong</h2>
          <p className="error-boundary__detail">{this.state.errorMessage}</p>
          <button
            className="btn btn--primary"
            onClick={() => this.handleReset()}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
