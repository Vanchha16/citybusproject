import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// /operator: the operator's view of passenger reports (loaded only there).
const OperatorView = lazy(() => import('./components/OperatorView.jsx'));
const isOperator = window.location.pathname.replace(/\/+$/, '') === '/operator';

// Installable app + alert notifications (production only: in development it would cache old code).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isOperator ? <Suspense fallback={null}><OperatorView /></Suspense> : <App />}
  </StrictMode>,
);
