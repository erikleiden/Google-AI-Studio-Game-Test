import React, { Component, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Error Boundary to catch crashes and show a readable error message
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("CRITICAL GAME ERROR:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', backgroundColor: '#050505', color: '#ef4444', height: '100vh', fontFamily: 'monospace' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem', fontFamily: 'Orbitron, sans-serif' }}>CRITICAL SYSTEM FAILURE</h1>
          <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>The game engine encountered an unrecoverable error.</p>
          <div style={{ backgroundColor: '#1e1e1e', padding: '1rem', border: '1px solid #ef4444', borderRadius: '0.5rem', overflow: 'auto' }}>
            <p style={{ fontWeight: 'bold' }}>{this.state.error?.name}: {this.state.error?.message}</p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            style={{ marginTop: '2rem', padding: '0.5rem 1rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontFamily: 'Orbitron, sans-serif' }}
          >
            REBOOT SYSTEM
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);