import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerServiceWorker } from './lib/pwa'
import { initializeOfflineSync } from './lib/offlineSync'

createRoot(document.getElementById("root")!).render(<App />);

// Único ponto de registro do service worker (bloqueado em dev/preview/iframe)
registerServiceWorker();
initializeOfflineSync();
