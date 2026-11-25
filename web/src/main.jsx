import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// /operator: the operator's view of passenger reports (loaded only there).
const OperatorView = lazy(() => import('./components/OperatorView.jsx'));
const isOperator = window.location.pathname.replace(/\/+$/, '') === '/operator';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isOperator ? <Suspense fallback={null}><OperatorView /></Suspense> : <App />}
  </StrictMode>,
);
