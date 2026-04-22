import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerServiceWorker } from './utils/pushNotifications'

// Polyfill for Buffer in browser environment
import { Buffer } from 'buffer'
window.Buffer = Buffer

// Register service worker on app load
if ('serviceWorker' in navigator) {
  registerServiceWorker().catch((err) => {
    console.error('[Main] Service worker registration failed:', err);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

