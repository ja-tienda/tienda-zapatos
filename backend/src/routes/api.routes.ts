import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as admin from '../controllers/admin.controller';
import * as orders from '../controllers/order.controller';
import * as payments from '../controllers/payment.controller';
import * as products from '../controllers/product.controller';
import * as sections from '../controllers/section.controller';
import * as settings from '../controllers/settings.controller';
import { requireAdmin } from '../middleware/auth';
import { uploadSingle } from '../utils/uploads';

const router = Router();

const limiter = (windowMinutes: number, limit: number, message: string, skipSuccessfulRequests = false) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    skipSuccessfulRequests,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: message },
  });

// Frena intentos de adivinar el PIN: 10 intentos fallidos cada 15 minutos por IP.
const loginLimiter = limiter(15, 10, 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.', true);
// Evita que alguien llene la BD de pedidos o el disco de capturas falsas.
const orderLimiter = limiter(10, 20, 'Demasiados pedidos seguidos. Inténtalo en unos minutos.');
const receiptLimiter = limiter(10, 12, 'Demasiados envíos seguidos. Inténtalo en unos minutos.');
const cardLimiter = limiter(10, 20, 'Demasiados intentos de pago. Inténtalo en unos minutos.');

router.get('/health', (_req, res) => res.json({ ok: true }));

// --- Contenido de la tienda (público) ---
router.get('/settings', settings.getSettings);
router.get('/sections', sections.listSections);
router.get('/products', products.listProducts);
router.get('/products/:idOrSlug', products.getProduct);

// --- Contenido de la tienda (administradora) ---
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

// --- Pedidos (cliente: identificado por el código + su clave X-Order-Token) ---
router.post('/orders', orderLimiter, orders.createOrder);
router.get('/orders/:code', orders.getCustomerOrder);
router.post('/orders/:code/receipt', receiptLimiter, uploadSingle, orders.uploadReceipt);
router.post('/orders/:code/method', orders.setManualMethod);
router.post('/orders/:code/cancel', orders.cancelCustomerOrder);
router.post('/orders/:code/card', cardLimiter, payments.createCardPayment);
router.post('/orders/:code/card/confirm', cardLimiter, payments.confirmCardPayment);
// Izipay envía su notificación como formulario (application/x-www-form-urlencoded)
router.post('/payments/izipay/ipn', express.urlencoded({ extended: false, limit: '200kb' }), payments.izipayNotification);

// --- Pedidos (administradora) ---
router.get('/orders', requireAdmin, orders.listOrders);
router.patch('/orders/:id/status', requireAdmin, orders.updateOrderStatus);

// --- Admin ---
router.post('/admin/login', loginLimiter, admin.login);
router.get('/admin/session', requireAdmin, admin.session);
router.get('/admin/summary', requireAdmin, admin.summary);

export default router;
