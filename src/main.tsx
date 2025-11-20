import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import PublicApp from './PublicApp.tsx';
import './index.css';

const isPublicBooking = window.location.pathname.startsWith('/book/');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPublicBooking ? <PublicApp /> : <App />}
  </StrictMode>
);
