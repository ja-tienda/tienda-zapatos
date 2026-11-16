import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router';
import ProductGrid from '../components/catalog/ProductGrid';
import { ProductDetailContent } from '../components/modals/ProductDetailModal';
import { ROUTES } from '../config/constants';
import { useStore } from '../context/StoreContext';
import { usePageMeta } from '../hooks/usePageMeta';
import NotFoundPage from './NotFoundPage';

/**
 * Página propia de un producto (/producto/slug): es el enlace que se comparte por WhatsApp
 * o Instagram y el que encuentran los buscadores. Muestra el mismo detalle que la ventana
 * emergente del catálogo, más otros modelos de su categoría.
 */
export default function ProductPage() {
  const { slug } = useParams();
  const { products, loading, openProduct, openSizeGuide } = useStore();
  const product = products.find((p) => p.slug === slug) ?? null;
  usePageMeta(product?.name, product?.description);

  if (!product) {
    return loading ? <div className="mx-auto my-10 h-[32rem] max-w-6xl animate-pulse rounded-3xl bg-stone-100" aria-busy="true" /> : <NotFoundPage />;
  }

  const related = products.filter((p) => p.category.id === product.category.id && p.id !== product.id).slice(0, 4);

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        to={ROUTES.section(product.category.slug)}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {product.category.name}
      </Link>

      <div className="mt-4">
        {/* key: al pasar a otro producto se reinician la foto y la talla elegidas */}
        <ProductDetailContent key={product.id} product={product} onClose={() => {}} onOpenSizeGuide={openSizeGuide} asPage />
      </div>

      {related.length > 0 && (
        <div className="mt-16">
          <h2 className="font-display text-3xl font-medium tracking-tight text-stone-900">También te puede gustar</h2>
          <div className="mt-6">
            <ProductGrid products={related} loading={false} onOpen={openProduct} onClearFilters={() => {}} />
          </div>
        </div>
      )}
    </section>
  );
}
