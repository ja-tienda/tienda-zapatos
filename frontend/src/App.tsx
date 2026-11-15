import { Route, Routes } from 'react-router';
import StoreLayout from './components/layout/StoreLayout';
import AccountPage from './pages/AccountPage';
import CheckoutPage from './pages/CheckoutPage';
import ComplaintPage from './pages/ComplaintPage';
import HomePage from './pages/HomePage';
import LegalPage from './pages/LegalPage';
import NotFoundPage from './pages/NotFoundPage';
import OrderPage from './pages/OrderPage';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordPages';
import ProductPage from './pages/ProductPage';
import SectionPage from './pages/SectionPage';

/**
 * Páginas de la tienda. El panel de administración es otra página aparte (/admin/).
 *   /                        inicio: portada, categorías, carrusel y catálogo completo
 *   /seccion/:slug           una categoría o una colección/temporada
 *   /ofertas                 productos con precio rebajado
 *   /producto/:slug          un producto (el enlace que se comparte)
 *   /checkout                inicio de sesión + datos de entrega
 *   /pedido/:code            pago (Yape/Plin, tarjeta) y seguimiento del pedido
 *   /cuenta                  mis pedidos, favoritos y datos
 *   /recuperar, /restablecer recuperación de contraseña
 *   /terminos, /privacidad, /cambios-y-devoluciones, /libro-de-reclamaciones
 */
export default function App() {
  return (
    <Routes>
      <Route element={<StoreLayout />}>
        <Route index element={<HomePage />} />
        <Route path="seccion/:slug" element={<SectionPage />} />
        <Route path="ofertas" element={<SectionPage offers />} />
        <Route path="producto/:slug" element={<ProductPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="pedido/:code" element={<OrderPage />} />
        <Route path="cuenta" element={<AccountPage />} />
        <Route path="recuperar" element={<ForgotPasswordPage />} />
        <Route path="restablecer" element={<ResetPasswordPage />} />
        <Route path="terminos" element={<LegalPage kind="terms" />} />
        <Route path="privacidad" element={<LegalPage kind="privacy" />} />
        <Route path="cambios-y-devoluciones" element={<LegalPage kind="returns" />} />
        <Route path="libro-de-reclamaciones" element={<ComplaintPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
