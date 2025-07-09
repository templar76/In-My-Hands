import React from 'react';
import  ClientLogger  from '../utils/ClientLogger';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Puoi loggare l'errore a un servizio esterno
    ClientLogger.error('ErrorBoundary caught an error', {
      error: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
      component: 'ErrorBoundary',
      action: 'componentDidCatch'
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" style={{ padding: 20, textAlign: 'center' }}>
          <h2>Qualcosa è andato storto.</h2>
          <button onClick={() => this.setState({ hasError: false })}>
            Riprova
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
