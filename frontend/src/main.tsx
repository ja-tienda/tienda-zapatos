import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import { CartProvider } from './context/CartContext';
import { StoreProvider } from './context/StoreContext';
import './fonts';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CartProvider>
        <StoreProvider>
          <App />
        </StoreProvider>
      </CartProvider>
    </BrowserRouter>
  </StrictMode>,
);
