import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerSW } from 'virtual:pwa-register';
import { iniciarCapturaInstalar } from './pwa/instalar';
import './index.css';

// Registra el service worker; con autoUpdate la página se recarga sola al entrar un despliegue nuevo
registerSW({ immediate: true });

// El evento de instalar llega al cargar; hay que escucharlo antes de que cualquier pantalla lo necesite
iniciarCapturaInstalar();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
