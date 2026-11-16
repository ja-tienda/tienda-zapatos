# J & A — Calzados, ropa y accesorios

Tienda virtual full-stack: catálogo con stock real por talla, páginas por categoría y temporada, cuentas de clientes, favoritos, checkout con Yape/Plin (QR + captura), pago con tarjeta por Izipay, Libro de Reclamaciones y panel de administración.

| Parte | Tecnología | Puerto local |
| --- | --- | --- |
| Base de datos | PostgreSQL 17 en Docker (`ja-tienda-db`) | 5433 |
| Backend (`/backend`) | Node + Express 5 + TypeScript + Prisma 6 | 4000 |
| Frontend (`/frontend`): tienda en `/` y panel en `/admin/` | React 19 + Vite + TypeScript + Tailwind 4 | 5173 |

**Para publicar o configurar Railway, Google, Resend, Izipay y el dominio: [docs/LANZAMIENTO.md](docs/LANZAMIENTO.md).**

## Primera vez en tu PC

```bash
docker compose up -d
```

```bash
cd backend
npm install
npx prisma migrate deploy
npm run db:seed
```

```bash
cd frontend
npm install
```

Crea `backend/.env` a partir de `.env.example`. Para desarrollo basta con `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_EMAIL` y `ADMIN_INITIAL_PASSWORD` (mínimo 10 caracteres): al arrancar por primera vez se crea la cuenta de administración con esos datos.

## Día a día

Con Docker Desktop abierto, en tres terminales:

```bash
docker compose up -d
```

```bash
cd backend
npm run dev
```

```bash
cd frontend
npm run dev
```

Tienda: http://localhost:5173 · Panel: http://localhost:5173/admin/

En desarrollo los correos (recuperar contraseña, constancia de reclamos) no se envían: se imprimen en la terminal del backend.

## Páginas

| Página | URL |
| --- | --- |
| Inicio, catálogo y carrusel | `/` |
| Categoría o temporada | `/seccion/calzados`, `/seccion/temporada-verano`… |
| Ofertas | `/ofertas` |
| Producto (el enlace que se comparte) | `/producto/urban-flow-coral-edition` |
| Checkout: inicio de sesión + datos de entrega | `/checkout` |
| Pago y seguimiento del pedido | `/pedido/JA-XXXXX` |
| Mi cuenta: pedidos, favoritos y datos | `/cuenta` |
| Recuperar contraseña | `/recuperar`, `/restablecer?token=…` |
| Legales | `/terminos`, `/privacidad`, `/cambios-y-devoluciones`, `/libro-de-reclamaciones` |
| Panel de administración | `/admin/` |

## Cómo funciona

**Cuentas.** Se puede navegar, llenar el carrito y marcar favoritos sin cuenta. El inicio de sesión o registro (correo y contraseña, o Google) aparece al pulsar "Continuar con la compra". El carrito vive en el navegador, así que no se pierde al entrar; los favoritos marcados sin cuenta pasan a la cuenta.

**Sesiones.** Una cookie `httpOnly`, `secure` y `SameSite` guarda un valor aleatorio; en la base solo está su huella. Las contraseñas se guardan con bcrypt. Tras 5 intentos fallidos la cuenta se bloquea 15 minutos.

**Pedidos y stock.** Al crear el pedido, el servidor recalcula precios y total con los datos de la base y **reserva el stock** en una transacción con descuento condicional: dos personas no pueden llevarse la última unidad. Si el pedido no se paga en 30 minutos, se cancela solo y el stock vuelve.

| Estado | Cuándo |
| --- | --- |
| `PENDIENTE` | Pedido creado, stock reservado |
| `PAGADO` | La administradora confirma el Yape/Plin, o llega la notificación firmada de Izipay |
| `ENVIADO` / `ENTREGADO` | Los marca la administradora |
| `CANCELADO` | Venció la reserva o se canceló; el stock vuelve al inventario |

**Pagos.** Yape/Plin: el cliente sube la captura, que se guarda en una carpeta privada (solo la ve la administradora). Tarjeta: el pedido pasa a `PAGADO` únicamente cuando el backend recibe la notificación de Izipay (IPN) y verifica su firma; lo que diga el navegador no cuenta.

## Panel

| Pestaña | Qué controla |
| --- | --- |
| Productos y stock | Productos, fotos, categoría, público, temporadas, precios y stock por talla |
| Pedidos | Captura del pago, confirmar, marcar enviado/entregado, cancelar |
| Clientes | Cuentas registradas, sus pedidos y desactivar/reactivar |
| Reclamos | Hojas del Libro de Reclamaciones y su respuesta (se envía por correo) |
| Secciones | Categorías y temporadas: portada, textos, carrusel y qué productos incluye cada temporada |
| Apariencia | Logo, franja superior y portada de inicio |
| Contacto y pagos | WhatsApp, correo, horario, datos del negocio, Yape/Plin (QR) y textos legales |
| Mi acceso | Cambiar la contraseña y ver el estado del servidor (https, IP, integraciones) |
| Vista previa | La tienda real en tamaño celular, tablet o computadora |

## Comandos útiles (dentro de `backend/`)

| Comando | Para qué |
| --- | --- |
| `npm run db:seed` | Recarga los productos de prueba. **Borra los productos actuales**; no lo ejecutes en producción |
| `npm run db:deploy` | Aplica las migraciones pendientes |
| `npm run db:studio` | Abre Prisma Studio para ver las tablas |
| `npm run typecheck` | Revisa errores de TypeScript (también existe en `frontend/`) |
| `npm run build` y `npm start` | Compila y arranca como en producción (aplica migraciones al arrancar) |

Para cambiar el modelo de datos: edita `prisma/schema.prisma` y ejecuta `npm run db:migrate` en una terminal normal.

## Estructura

```
backend/
  prisma/            esquema, migraciones y datos de prueba
  src/config/        variables de entorno (validadas), ajustes editables, tallas
  src/middleware/    sesiones (auth.ts) y seguridad (security.ts: CSRF, https, límites)
  src/controllers/   auth, account, order, payment (Izipay), complaint, seo, product…
  src/services/      mailer.ts (Resend)
frontend/
  src/               tienda (pages/, components/, context/)
  src/admin/         panel de administración
  server/            servidor de producción: cabeceras, SEO y sitemap
docs/LANZAMIENTO.md  guía de despliegue y configuración
```

## Imágenes subidas

Se guardan optimizadas (WebP) en `backend/uploads/` (o en `UPLOADS_DIR`). `productos/` y `sitio/` son públicas; `comprobantes/` es privada. La carpeta no está en git: en Railway debe ser un Volume y hay que respaldarla junto con la base.
