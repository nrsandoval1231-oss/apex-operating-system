import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import './index.css';

/**
 * The app runs at `/` under the Vite dev server and at `/app` when the Gate API
 * serves the built bundle from its own origin. Vite substitutes the base at
 * build time, so the router follows wherever the bundle is mounted rather than
 * hard-coding either one.
 */
const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
