
// El polyfill DEBE ir antes de cualquier otra importación
const globalWin = window as any;
if (typeof globalWin.process === 'undefined') {
  globalWin.process = { env: {} };
} else if (!globalWin.process.env) {
  globalWin.process.env = {};
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
