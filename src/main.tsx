import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { ErrorBoundary } from './components/ErrorBoundary';

// Silence benign Vite HMR web-socket connection errors expected in sandboxed container environments
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const errorStr = String(event.reason?.message || event.reason || '');
    if (errorStr.includes('WebSocket') || errorStr.includes('websocket')) {
      event.preventDefault();
    }
  });

  window.addEventListener('error', (event) => {
    const errorStr = String(event.message || '');
    if (errorStr.includes('WebSocket') || errorStr.includes('websocket')) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
