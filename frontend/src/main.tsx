import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { client } from './client/client.gen';

// Configure Hey-API client SDK base URL and JWT auth resolution
client.setConfig({
  baseUrl: import.meta.env.VITE_API_URL || '',
  auth: () => localStorage.getItem('medikiosk_token') || 'dev-token',
});

// Register PWA Service Worker for offline capability and caching
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('MediKiosk ServiceWorker active, scope:', reg.scope);
      })
      .catch((err) => {
        console.error('MediKiosk ServiceWorker registration failed:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
