import { Router } from 'express';
import * as account from '../controllers/account.controller';
import * as admin from '../controllers/admin.controller';
import * as auth from '../controllers/auth.controller';
import * as complaints from '../controllers/complaint.controller';
import * as orders from '../controllers/order.controller';
import * as payments from '../controllers/payment.controller';
import * as products from '../controllers/product.controller';
import * as sections from '../controllers/section.controller';
import * as seo from '../controllers/seo.controller';
import * as settings from '../controllers/settings.controller';
import * as users from '../controllers/users.controller';
import { requireAdmin, requireUser } from '../middleware/auth';
import { limits } from '../middleware/security';
import { uploadSingle } from '../utils/uploads';

/**
 * Rutas de la API. Tres niveles de acceso:
 *   público        -> catálogo, ajustes, registro/inicio de sesión, libro de reclamaciones
 *   requireUser    -> cliente con sesión: sus pedidos, su pago, sus favoritos
 *   requireAdmin   -> administradora: inventario, pedidos de todos, clientes, reclamos
 * (La notificación de Izipay se registra aparte en index.ts: no usa cookies ni JSON.)
 */
const router = Router();

router.get('/health', (_req, res) => res.json({ ok: true }));

// ── Contenido de la tienda (público) ──
router.get('/settings', settings.getSettings);
router.get('/sections', sections.listSections);
router.get('/products', products.listProducts);
router.get('/products/:idOrSlug', products.getProduct);
router.get('/seo', seo.pageMeta);
router.get('/seo/sitemap.xml', seo.sitemap);
router.get('/seo/robots.txt', seo.robots);

// ── Cuentas ──
router.get('/auth/me', auth.me);
router.post('/auth/register', limits.register, auth.register);
router.post('/auth/login', limits.login, auth.login);
router.post('/auth/logout', auth.logout);
router.post('/auth/forgot', limits.passwordReset, auth.forgotPassword);
router.post('/auth/reset', limits.passwordReset, auth.resetPassword);
router.post('/auth/password', requireUser, limits.login, auth.changePassword);
router.put('/auth/profile', requireUser, auth.updateProfile);
router.get('/auth/google', limits.register, auth.googleStart);
router.get('/auth/google/callback', auth.googleCallback);

// ── Mi cuenta (cliente con sesión) ──
router.get('/account/orders', requireUser, account.myOrders);
router.get('/account/favorites', requireUser, account.listFavorites);
router.post('/account/favorites/merge', requireUser, account.mergeFavorites);
router.put('/account/favorites/:productId', requireUser, account.addFavorite);
router.delete('/account/favorites/:productId', requireUser, account.removeFavorite);

// ── Pedidos del cliente ──
router.post('/orders', requireUser, limits.checkout, orders.createOrder);
router.get('/orders/:code', requireUser, orders.getOwnOrder);
router.post('/orders/:code/receipt', requireUser, limits.upload, uploadSingle, orders.uploadReceipt);
router.post('/orders/:code/method', requireUser, orders.setManualMethod);
router.post('/orders/:code/cancel', requireUser, orders.cancelOwnOrder);
router.post('/orders/:code/card', requireUser, limits.card, payments.createCardPayment);

// ── Libro de Reclamaciones ──
router.post('/complaints', limits.complaint, complaints.createComplaint);
router.get('/complaints', requireAdmin, complaints.listComplaints);
router.post('/complaints/:id/response', requireAdmin, complaints.respondComplaint);

// ── Administración: contenido ──
router.put('/settings', requireAdmin, settings.updateSettings);
router.post('/uploads', requireAdmin, uploadSingle, settings.uploadImage);
router.post('/sections', requireAdmin, sections.createSection);
router.put('/sections/:id', requireAdmin, sections.updateSection);
router.delete('/sections/:id', requireAdmin, sections.deleteSection);
router.post('/products', requireAdmin, products.createProduct);
router.put('/products/:id', requireAdmin, products.updateProduct);
router.patch('/products/:id', requireAdmin, products.updateProduct);
router.delete('/products/:id', requireAdmin, products.deleteProduct);
router.post('/products/:id/variants', requireAdmin, products.addVariant);
router.patch('/variants/:id', requireAdmin, products.updateVariant);
router.delete('/variants/:id', requireAdmin, products.deleteVariant);

// ── Administración: pedidos, comprobantes y clientes ──
router.get('/orders', requireAdmin, orders.listOrders);
router.patch('/orders/:id/status', requireAdmin, orders.updateOrderStatus);
router.get('/receipts/:file', requireAdmin, orders.getReceipt);
router.get('/admin/summary', requireAdmin, admin.summary);
router.get('/admin/diagnostics', requireAdmin, admin.diagnostics);
router.get('/admin/customers', requireAdmin, users.listCustomers);
router.get('/admin/customers/:id/orders', requireAdmin, users.customerOrders);
router.patch('/admin/customers/:id', requireAdmin, users.setCustomerActive);

export default router;
