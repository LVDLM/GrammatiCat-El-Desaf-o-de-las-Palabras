
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Polyfill seguro: Solo inicializa si no existe nada, preservando lo que el bundler inyecte
const globalWin = window as any;
if (typeof globalWin.process === 'undefined') {
  globalWin.process = { env: {} };
} else if (!globalWin.process.env) {
  globalWin.process.env = {};
}

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
