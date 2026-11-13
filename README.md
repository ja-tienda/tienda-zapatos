# J & A — Calzados, ropa y accesorios

Tienda virtual full-stack: catálogo con stock real por talla, páginas por categoría y temporada, carrito, checkout con Yape/Plin (QR + captura del pago), pago con tarjeta por Izipay y panel de administración.

| Parte | Tecnología | Puerto |
| --- | --- | --- |
| Base de datos | PostgreSQL 17 en Docker (`ja-tienda-db`) | 5433 |
| Backend | Node + Express 5 + TypeScript + Prisma 6 | 4000 |
| Frontend (tienda + panel) | React 19 + Vite + TypeScript + Tailwind 4 | 5173 |

> La base usa el puerto **5433** porque el 5432 ya lo ocupa el contenedor `inventario-db` de otro proyecto.

## Primera vez

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

`backend/.env` ya existe para desarrollo local. En otra PC, créalo a partir de `.env.example`.

## Día a día

Con Docker Desktop abierto, en tres terminales de VS Code:

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

## Páginas

| Página | URL |
| --- | --- |
| Inicio: portada, categorías, carrusel de temporadas y catálogo | http://localhost:5173/ |
| Una categoría o temporada (portada propia + sus productos) | `/seccion/calzados`, `/seccion/temporada-verano`… |
| Ofertas (se arma sola con lo que tiene precio rebajado) | `/ofertas` |
| Checkout: datos del cliente y entrega | `/checkout` |
| Pago y seguimiento del pedido | `/pedido/JA-XXXXX` |
| Términos y privacidad | `/terminos`, `/privacidad` |
| **Panel de administración** (PIN `1234`, se cambia en `backend/.env`) | http://localhost:5173/admin/ |

Los filtros viajan en la dirección (`?genero=DAMA&talla=38`), así un enlace compartido abre la misma vista.

## Qué se edita desde el panel

| Pestaña | Qué controla |
| --- | --- |
| Productos y stock | Productos, fotos (subidas desde el dispositivo o por URL), categoría, género (Dama, Caballero, Niña, Niño, Unisex), temporadas, precios y stock por talla |
| Pedidos | Ver la captura del pago, confirmar (descuenta stock) o cancelar |
| Secciones | Categorías y temporadas/colecciones: nombre, portada, título, texto, botón, si sale en el carrusel |
| Apariencia | Logo, franja superior y portada de inicio (textos e imagen) |
| Contacto y pagos | WhatsApp, correo, horario, número/titular/QR de Yape-Plin, términos y privacidad |
| Vista previa | La tienda real en tamaño celular, tablet o computadora |

En los títulos, lo escrito entre `*asteriscos*` sale resaltado en cursiva.

## Cómo funciona un pedido

1. El cliente llena sus datos en `/checkout`. El servidor valida el stock, calcula precios y total, y crea el pedido `PENDIENTE` con un código (`JA-XXXXX`). El navegador recibe una clave secreta: solo ese dispositivo puede ver y pagar ese pedido.
2. En `/pedido/…` elige cómo pagar:
   - **Yape o Plin**: ve el QR, el número y el monto, paga en su app y sube la captura con “Ya pagué · Enviar comprobante”. La captura queda en el pedido y se le ofrece avisar por WhatsApp (el mensaje incluye el enlace a la captura).
   - **Tarjeta (Izipay)**: paga en el formulario incrustado; el pedido se confirma solo.
   - **Coordinar por WhatsApp**: transferencia o contra entrega.
3. En el panel, **Confirmar pago** descuenta el stock. Cancelar un pedido ya confirmado lo devuelve.

## Activar el pago con tarjeta (Izipay)

Mientras falten las claves, la opción aparece como “Próximamente”.

1. Afíliate a Izipay y entra al **Back Office Vendedor** → Configuración → Tienda → *Claves de API REST*.
2. Copia las cuatro claves **de prueba** a `backend/.env` y reinicia el backend:

   ```
   IZIPAY_USERNAME=      # identificador de la tienda
   IZIPAY_PASSWORD=      # contraseña de test (testpassword_…)
   IZIPAY_PUBLIC_KEY=    # clave pública de test
   IZIPAY_HMAC_KEY=      # clave HMAC-SHA-256 de test
   ```
3. Prueba un pago con las [tarjetas de prueba de Izipay](https://secure.micuentaweb.pe/doc/es-PE/rest/V4.0/api/kb/test_cards.html).
4. Para producción: cambia las cuatro claves por las de producción y registra la URL de notificación en el Back Office (Configuración → Reglas de notificación → *URL de notificación al final del pago*): `https://TU-DOMINIO/api/payments/izipay/ipn`.

El código está en `backend/src/controllers/payment.controller.ts` y `frontend/src/components/checkout/CardPayment.tsx`.

## Comandos útiles (dentro de `backend/`)

| Comando | Para qué |
| --- | --- |
| `npm run db:seed` | Recarga los 12 productos de prueba (borra los productos actuales; conserva pedidos, secciones y ajustes) |
| `npm run db:studio` | Abre Prisma Studio para ver las tablas |
| `npx prisma migrate deploy` | Aplica las migraciones pendientes |
| `npm run db:reset` | Borra **toda** la base y la recrea con el seed |
| `npm run typecheck` | Revisa errores de TypeScript (también existe en `frontend/`) |

Para cambiar el modelo de datos: edita `prisma/schema.prisma` y ejecuta `npm run db:migrate` en una terminal normal (pide confirmación).

## Imágenes subidas

Las fotos subidas desde el panel y las capturas de pago se guardan optimizadas (WebP) en `backend/uploads/`. Esa carpeta **no** está en git: hay que respaldarla junto con la base de datos, y el hosting debe tener disco persistente. Cuando se quita una foto, se borra un producto o se reemplaza una portada, el archivo que ya nadie usa se elimina solo.

## Antes de publicar

- Cambiar `ADMIN_PIN`, `ADMIN_TOKEN_SECRET` y la contraseña de PostgreSQL.
- Poner `TRUST_PROXY=1` en `backend/.env` si el backend queda detrás de un proxy (Nginx, Render, Railway…), para que el límite de intentos distinga a cada visitante.
- Servir tienda y API bajo el mismo dominio (lo más simple: un proxy que envíe `/api` y `/uploads` al backend). Si van en dominios distintos, definir `VITE_API_URL`, `CORS_ORIGIN` y `PUBLIC_URL`.
- Configurar el servidor web para que cualquier ruta de la tienda (`/seccion/...`, `/checkout`…) entregue `index.html`, y `/admin/` entregue `admin/index.html`.
- Subir el QR de Yape, el logo y las fotos reales; revisar los textos de términos y privacidad (son una plantilla base).
- Reemplazar las fotos de Unsplash del seed por fotos propias.
