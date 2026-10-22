import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { MarketplaceProvider } from './store/marketplaceStore';

createRoot(document.getElementById('root')!).render(
  <MarketplaceProvider>
    <App />
  </MarketplaceProvider>
);
