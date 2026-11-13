import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useCart } from '../../context/CartContext';
import { useStore } from '../../context/StoreContext';
import CartDrawer from '../cart/CartDrawer';
import ProductDetailModal from '../modals/ProductDetailModal';
import SizeGuideModal from '../modals/SizeGuideModal';
import FloatingWhatsApp from './FloatingWhatsApp';
import Footer from './Footer';
import Header from './Header';

/** Al cambiar de página se vuelve arriba; si el enlace trae #ancla, se baja hasta ella. */
function useScrollOnNavigate() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      // Espera un instante a que la página nueva esté pintada
      const timer = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 80);
      return () => clearTimeout(timer);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, hash]);
}

/** Marco común de todas las páginas de la tienda: cabecera, pie, carrito y modales. */
export default function StoreLayout() {
  const cart = useCart();
  const { products, detail, closeProduct, sizeGuideOpen, closeSizeGuide, openSizeGuide } = useStore();
  const { pathname } = useLocation();
  useScrollOnNavigate();

  // El modal siempre muestra la versión más reciente del producto (stock incluido).
  const detailProduct = detail ? (products.find((p) => p.id === detail.productId) ?? null) : null;
  // En el checkout y el pago no se distrae con el botón flotante
  const focusedFlow = pathname.startsWith('/checkout') || pathname.startsWith('/pedido');

  return (
    <>
      <Header />
      <main className="min-h-[60dvh]">
        <Outlet />
      </main>
      <Footer />
      {!cart.isOpen && !focusedFlow && <FloatingWhatsApp />}

      {cart.isOpen && <CartDrawer />}

      {detail && detailProduct && (
        <ProductDetailModal
          key={`${detail.productId}-${detail.variantId ?? ''}`}
          product={detailProduct}
          initialVariantId={detail.variantId}
          onClose={() => {
            // Con la guía de tallas encima, Escape solo cierra la guía.
            if (!sizeGuideOpen) closeProduct();
          }}
          onOpenSizeGuide={openSizeGuide}
        />
      )}

      {sizeGuideOpen && <SizeGuideModal onClose={closeSizeGuide} />}
    </>
  );
}
