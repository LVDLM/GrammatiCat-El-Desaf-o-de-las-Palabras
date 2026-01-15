
// Polyfill ultra-seguro: Solo inicializa si no existe nada para no borrar lo que inyecte el compilador
if (typeof window !== 'undefined') {
  const win = window as any;
  if (!win.process) win.process = {};
  if (!win.process.env) win.process.env = {};
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
