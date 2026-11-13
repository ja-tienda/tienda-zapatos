import { Route, Routes } from 'react-router';
import StoreLayout from './components/layout/StoreLayout';
import CheckoutPage from './pages/CheckoutPage';
import HomePage from './pages/HomePage';
import LegalPage from './pages/LegalPage';
import NotFoundPage from './pages/NotFoundPage';
import OrderPage from './pages/OrderPage';
import SectionPage from './pages/SectionPage';

/**
 * Páginas de la tienda. El panel de administración es otra página aparte (/admin/).
 *   /                  inicio: portada, categorías, carrusel y catálogo completo
 *   /seccion/:slug     una categoría o una colección/temporada
 *   /ofertas           productos con precio rebajado
 *   /checkout          datos del cliente y de entrega
 *   /pedido/:code      pago (Yape/Plin, tarjeta) y seguimiento del pedido
 *   /terminos, /privacidad
 */
export default function App() {
  return (
    <Routes>
      <Route element={<StoreLayout />}>
        <Route index element={<HomePage />} />
        <Route path="seccion/:slug" element={<SectionPage />} />
        <Route path="ofertas" element={<SectionPage offers />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="pedido/:code" element={<OrderPage />} />
        <Route path="terminos" element={<LegalPage kind="terms" />} />
        <Route path="privacidad" element={<LegalPage kind="privacy" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
