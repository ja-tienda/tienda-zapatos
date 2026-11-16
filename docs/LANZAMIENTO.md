# Guía de lanzamiento — J & A

Pasos para dejar la tienda lista en Railway con la rama `feature/cuentas-seguridad-lanzamiento`. Sigue el orden: cada sección supone hecha la anterior.

> Los nombres de menús de Railway, Google e Izipay cambian con el tiempo. Si una opción no está exactamente donde dice aquí, busca el mismo nombre en una pantalla vecina.

## Índice

1. [Cómo quedan conectados los servicios](#1-cómo-quedan-conectados-los-servicios)
2. [Variables de entorno en Railway](#2-variables-de-entorno-en-railway)
3. [Desplegar esta rama](#3-desplegar-esta-rama)
4. [Correos con Resend](#4-correos-con-resend)
5. [Iniciar sesión con Google](#5-iniciar-sesión-con-google)
6. [Pago con tarjeta: Izipay](#6-pago-con-tarjeta-izipay)
7. [Tu dominio propio](#7-tu-dominio-propio)
8. [Google Search Console](#8-google-search-console)
9. [Base de datos: acceso y permisos](#9-base-de-datos-acceso-y-permisos)
10. [Copias de seguridad](#10-copias-de-seguridad)
11. [Pruebas antes de lanzar](#11-pruebas-antes-de-lanzar)

---

## 1. Cómo quedan conectados los servicios

### El problema de las cookies

Hoy el frontend y el backend están en dos dominios distintos de Railway (`algo.up.railway.app` y `otro.up.railway.app`). Para un navegador esos son **dos sitios diferentes**, y una cookie de sesión del backend sería una "cookie de terceros" cuando el cliente está en la tienda. Safari las bloquea y Chrome las restringe cada vez más: el cliente iniciaría sesión y al siguiente clic aparecería desconectado.

### La solución: un solo dominio para el navegador

El servidor del frontend reenvía `/api` y `/uploads` al backend por la red interna de Railway:

```
Navegador ──https──► tienda (frontend)  ── /api, /uploads ──► backend ──► Postgres
                     https://tu-tienda…     red privada de Railway
```

El navegador solo conoce el dominio de la tienda, así que:

- la cookie de sesión es propia del sitio (`SameSite=Lax`, `httpOnly`, `secure`) y funciona en todos los navegadores;
- no hace falta CORS para el uso normal;
- Google OAuth y la notificación de Izipay usan también el dominio de la tienda;
- el backend y la base pueden quedar sin dominio público.

Se activa con **una variable en el servicio frontend: `BACKEND_URL`**. Sin ella todo sigue funcionando como antes (el navegador llama al backend en `VITE_API_URL`), pero con las cookies de terceros y sus problemas.

Cuando conectes tu dominio no cambia nada de esto: solo cambia `APP_URL` (sección 7).

---

## 2. Variables de entorno en Railway

En cada servicio: **Variables → New Variable**. Las que empiezan con `${{` son referencias: Railway las completa sola.

### Servicio `backend`

| Variable | Valor | Notas |
| --- | --- | --- |
| `NODE_ENV` | `production` | Obligatoria. Activa https, cookies seguras y oculta errores técnicos |
| `PORT` | `4000` | Fíjala para poder referenciarla desde el frontend |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Ya debería existir. Usa la privada, no `DATABASE_PUBLIC_URL` |
| `APP_URL` | `https://TU-FRONTEND.up.railway.app` | Obligatoria, con `https` y sin barra final. Es la dirección de la **tienda** |
| `TRUST_PROXY` | `1` | Para que los límites de intentos vean la IP real de cada cliente |
| `UPLOADS_DIR` | ruta del Volume, p. ej. `/app/uploads` | Debe coincidir con el "Mount path" del Volume |
| `ADMIN_USERNAME` | el usuario que quieras, p. ej. `jessica` | Solo se usa la primera vez |
| `ADMIN_EMAIL` | correo real de la dueña | Ahí llega el enlace para recuperar la contraseña |
| `ADMIN_INITIAL_PASSWORD` | una contraseña de 10+ caracteres | **Bórrala** después de cambiar la contraseña en el panel |
| `RESEND_API_KEY` | (sección 4) | Recomendada |
| `MAIL_FROM` | `J & A <pedidos@tudominio.com>` | Va junto con la anterior |
| `GOOGLE_CLIENT_ID` | (sección 5) | Opcional |
| `GOOGLE_CLIENT_SECRET` | (sección 5) | Opcional |
| `IZIPAY_USERNAME`, `IZIPAY_PASSWORD`, `IZIPAY_PUBLIC_KEY`, `IZIPAY_HMAC_KEY` | (sección 6) | Opcionales; las cuatro o ninguna |

**Borra** de este servicio: `ADMIN_PIN`, `ADMIN_TOKEN_SECRET` y `PUBLIC_URL` (ya no se usan con el reenvío). `CORS_ORIGIN` puede quedar vacía.

### Servicio `frontend`

| Variable | Valor | Notas |
| --- | --- | --- |
| `BACKEND_URL` | `http://${{backend.RAILWAY_PRIVATE_DOMAIN}}:${{backend.PORT}}` | Cambia `backend` por el nombre exacto de tu servicio. Es `http` porque va por la red privada |
| `VITE_API_URL` | **bórrala** | Si queda definida, el navegador seguiría llamando al backend directo |

### Si prefieres no cambiar la arquitectura todavía

Puedes mantener los dos dominios, con estas diferencias (no recomendado para producción):

- backend: `PUBLIC_URL=https://TU-BACKEND.up.railway.app` y `COOKIE_SAMESITE=none`;
- frontend: `VITE_API_URL=https://TU-BACKEND.up.railway.app`, sin `BACKEND_URL`.

En ese modo no hay cabeceras de seguridad en las páginas, ni etiquetas para compartir por página, ni sitemap, y el inicio de sesión puede fallar en Safari.

---

## 3. Desplegar esta rama

1. **Copia de seguridad** de la base antes de nada (sección 10): la migración cambia tablas.
2. Comprueba el **Volume** del backend: servicio backend → *Volumes*. Su "Mount path" debe ser el valor de `UPLOADS_DIR`.
3. Pon todas las variables de la sección 2 **antes** de fusionar. Sin `NODE_ENV`, `APP_URL` o los `ADMIN_*`, el backend se niega a arrancar y lo dice en el log.
4. Revisa los comandos del servicio backend (*Settings → Build / Deploy*):
   - Build: `npm run build` (ahora ejecuta `prisma generate && tsc`).
   - Start: `npm start`. Aplica solo las migraciones (`prisma migrate deploy`) y luego arranca. Si tenías un comando propio que ya migraba, puedes dejar `npm run start:only`.
5. Fusiona la rama en `main` (o apunta el servicio a la rama para probar primero).
6. Mira el log del backend. Debe decir:
   ```
   ✔ Cuenta de administración creada (usuario: …)
   API J & A lista en el puerto 4000 (producción)
   ```
7. Entra a `https://TU-TIENDA/admin/` con `ADMIN_USERNAME` y `ADMIN_INITIAL_PASSWORD`.
8. Ve a **Mi acceso**: cambia la contraseña y revisa "Estado del servidor". Debe decir *Modo producción*, *Conexión segura* y mostrar **tu IP pública** (compárala con la que ves en cualquier web de "cuál es mi IP"). Si muestra una IP interna (`10.x`, `100.x`, `172.x`), sube `TRUST_PROXY` a `2`.
9. Borra `ADMIN_INITIAL_PASSWORD` de las variables.

### Qué hace la migración con los datos actuales

- Los pedidos `CONFIRMADO` pasan a `PAGADO`.
- Las capturas de pago existentes siguen en su carpeta, pero dejan de ser públicas.
- Los géneros y categorías no cambian. Los productos y ajustes se conservan.
- **No ejecutes `npm run db:seed` en producción:** borra todos los productos.

### Sobre el bug de las temporadas

No era un error de la consulta: cada temporada solo mostraba los productos que tenía asignados, y los filtros de público solo ofrecían los que existían en ella. Ahora los cinco públicos se ofrecen siempre y lo unisex aparece también en Dama y Caballero. En producción, asigna los productos a cada temporada desde **Secciones → Editar portada y textos → Productos de esta temporada**.

---

## 4. Correos con Resend

Se usan para recuperar la contraseña y para la constancia del Libro de Reclamaciones. Recomiendo [Resend](https://resend.com): es simple y su plan gratuito alcanza para empezar (revisa los límites vigentes en su web). Necesita un dominio propio para enviar a tus clientes, así que haz antes la sección 7 o ten el dominio a la mano.

1. Crea una cuenta en https://resend.com.
2. **Domains → Add Domain** y escribe tu dominio. Sugerencia: usa un subdominio como `correo.tudominio.com` para no mezclarlo con tu correo normal.
3. Resend te muestra varios registros DNS (uno o dos `TXT`, un `MX` y los `DKIM`). Créalos tal cual en el panel donde compraste el dominio.
4. Pulsa **Verify**. Puede tardar desde unos minutos hasta unas horas.
5. **API Keys → Create API Key**, permiso *Sending access*. Cópiala: solo se muestra una vez.
6. En Railway (backend):
   - `RESEND_API_KEY` = la clave
   - `MAIL_FROM` = `J & A <pedidos@correo.tudominio.com>` (el dominio debe ser el verificado)
7. Prueba: en la tienda, *Mi cuenta → ¿La olvidaste?* con un correo registrado. En el panel, *Mi acceso* debe mostrar "Envío de correos activo".

Sin dominio todavía: Resend solo deja enviar a tu propio correo desde `onboarding@resend.dev`. Sirve para probar el flujo, no para clientes.

---

## 5. Iniciar sesión con Google

El botón aparece solo cuando están las dos claves. La URI de redirección exacta se muestra en el panel: **Mi acceso → Estado del servidor**.

### Crear el proyecto y la pantalla de consentimiento

1. Entra a https://console.cloud.google.com con la cuenta de Google del negocio.
2. Arriba, selector de proyectos → **Proyecto nuevo** → nombre `J&A Tienda` → Crear.
3. Menú → **APIs y servicios → Pantalla de consentimiento de OAuth** (en la interfaz nueva: *Google Auth Platform → Branding / Público*).
4. Tipo de usuario: **Externo**.
5. Completa:
   - Nombre de la aplicación: `J & A`
   - Correo de asistencia: el del negocio
   - Logotipo: opcional (si lo subes, Google puede pedir verificación)
   - Dominios autorizados: el de la tienda (ahora `TU-FRONTEND.up.railway.app`; luego tu dominio)
   - Enlaces: página principal `https://TU-TIENDA`, privacidad `https://TU-TIENDA/privacidad`, condiciones `https://TU-TIENDA/terminos`
   - Datos de contacto del desarrollador: tu correo
6. Permisos (scopes): agrega solo `openid`, `.../auth/userinfo.email` y `.../auth/userinfo.profile`. Son básicos y no requieren revisión de Google.
7. **Publica la aplicación** (estado "En producción"). En modo "Prueba" solo pueden entrar los correos que agregues a mano.

### Crear las credenciales

1. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**.
2. Tipo: **Aplicación web**. Nombre: `Tienda J&A`.
3. **Orígenes de JavaScript autorizados**:
   - `https://TU-FRONTEND.up.railway.app`
   - `http://localhost:5173` (para probar en tu PC)
4. **URIs de redireccionamiento autorizados** (deben coincidir carácter por carácter):
   - `https://TU-FRONTEND.up.railway.app/api/auth/google/callback`
   - `http://localhost:5173/api/auth/google/callback`
5. Crear. Copia el **ID de cliente** y el **secreto**.
6. En Railway (backend): `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. El secreto va solo en el backend, nunca en el frontend.

### Cuando tengas tu dominio

Vuelve a la misma credencial y **agrega** (sin borrar las de Railway hasta terminar el cambio):

- Origen: `https://tudominio.com`
- Redirección: `https://tudominio.com/api/auth/google/callback`

Y añade `tudominio.com` a los dominios autorizados de la pantalla de consentimiento.

Si Google responde `redirect_uri_mismatch`, la URI registrada no coincide con la de *Mi acceso*: copia y pega esa.

---

## 6. Pago con tarjeta: Izipay

### Cómo funciona aquí

1. El backend pide a Izipay un "formToken" por el total del pedido (calculado en el servidor).
2. El cliente escribe su tarjeta en el formulario de Izipay incrustado en la página. Esos datos van directo a Izipay.
3. Izipay avisa al backend con una **notificación (IPN)** firmada. El backend verifica la firma y el monto, y solo entonces marca el pedido como `PAGADO`.
4. La página del cliente consulta el estado hasta ver el cambio.

Un pago rechazado o cancelado deja el pedido `PENDIENTE`: el cliente puede reintentar o pagar con Yape. Si no paga, la reserva de stock vence sola.

### Claves de prueba

1. Afíliate a Izipay y entra al **Back Office Vendedor** (te envían el acceso al aprobar la afiliación).
2. **Configuración → Tienda → Claves de API REST**. Verás:
   - *Usuario* (identificador de la tienda) → `IZIPAY_USERNAME`
   - *Contraseña de test* (`testpassword_…`) → `IZIPAY_PASSWORD`
   - *Clave pública de test* (`…:testpublickey_…`) → `IZIPAY_PUBLIC_KEY`
   - *Clave HMAC-SHA-256 de test* → `IZIPAY_HMAC_KEY`
3. Ponlas en Railway (backend). Las cuatro juntas; si falta una, el backend no arranca y lo indica.

### URL de notificación

La dirección exacta está en el panel: **Mi acceso → Estado del servidor** (`https://TU-TIENDA/api/payments/izipay/ipn`).

1. Back Office → **Configuración → Reglas de notificación**.
2. Abre la regla **URL de notificación al final del pago**.
3. Pega la URL en el campo de **modo TEST** (y después en el de **modo PRODUCTION**).
4. Guarda. El Back Office tiene un botón para probar la URL: debe responder sin error de conexión.

El backend también envía esta URL en cada pago, pero dejarla fija en el Back Office es la red de seguridad.

### Probar

1. En el panel, *Mi acceso* debe decir "Pago con tarjeta activo (claves de prueba)".
2. Haz un pedido y elige **Tarjeta de crédito o débito**.
3. Usa las tarjetas de prueba de Izipay: https://secure.micuentaweb.pe/doc/es-PE/rest/V4.0/api/kb/test_cards.html
4. Prueba al menos:
   - una tarjeta **aceptada** → el pedido debe pasar a *Pagado* en la página y en el panel;
   - una **rechazada** → debe mostrar el error y dejar reintentar;
   - cerrar la página a mitad del pago → el pedido queda *Pendiente* y a los 30 minutos se cancela solo.
5. En el Back Office puedes ver cada transacción y el resultado de su notificación (si la IPN falló, ahí aparece el motivo).

Esta integración se probó en local con notificaciones simuladas (firma válida, firma falsa, pago rechazado, monto alterado), **no contra Izipay real**: hacen falta tus claves. Si el formulario no aparece, abre la consola del navegador (F12): un mensaje de *Content Security Policy* indica qué dominio falta autorizar en `frontend/server/production.ts`.

### Pasar a producción

1. Izipay debe habilitar tu tienda en modo producción (suelen pedir que hayas hecho pruebas correctas).
2. Cambia en Railway **tres** claves por las de producción: `IZIPAY_PASSWORD`, `IZIPAY_PUBLIC_KEY` e `IZIPAY_HMAC_KEY` (`IZIPAY_USERNAME` no cambia).
3. Confirma que la URL de notificación está también en el campo de modo PRODUCTION.
4. Haz una compra real de monto bajo con tu propia tarjeta y luego anúlala desde el Back Office.

Mientras uses claves de prueba, el log del backend avisa al arrancar que los pagos no cobran dinero real.

---

## 7. Tu dominio propio

### Conectarlo a Railway

1. Servicio **frontend** → *Settings → Networking → Custom Domain* → escribe `tudominio.com` (y repite con `www.tudominio.com`).
2. Railway muestra un registro `CNAME` por cada uno. Créalos en el panel donde compraste el dominio.
   - Para el dominio raíz (`tudominio.com`) algunos proveedores no aceptan `CNAME`: usa el tipo `ALIAS`/`ANAME` o "CNAME flattening" si lo ofrecen (Cloudflare lo hace solo).
3. Espera a que Railway marque el dominio como activo y emita el certificado https.

El backend no necesita dominio propio: se llega a él a través de la tienda.

### Qué actualizar, en este orden

| Dónde | Cambio |
| --- | --- |
| Railway, backend | `APP_URL=https://tudominio.com`. Mientras conviven los dos dominios: `CORS_ORIGIN=https://TU-FRONTEND.up.railway.app` |
| Google Cloud | Agregar origen y URI de redirección del dominio (sección 5) |
| Izipay | Cambiar la URL de notificación a `https://tudominio.com/api/payments/izipay/ipn` (TEST y PRODUCTION) |
| Resend | El dominio ya verificado; revisar `MAIL_FROM` |
| Panel de la tienda | *Mi acceso*: comprobar que las URL mostradas ya usan el dominio |

Después de cambiar `APP_URL`, los enlaces de los correos, el sitemap y las etiquetas para compartir usan el dominio nuevo. Las sesiones abiertas en el dominio de Railway no se trasladan: cada quien vuelve a entrar.

Elige una sola versión como principal (`tudominio.com` o `www`) y úsala en `APP_URL`. Si quieres que la otra redirija, configúralo en tu proveedor de DNS.

---

## 8. Google Search Console

1. Entra a https://search.google.com/search-console con la cuenta del negocio.
2. **Agregar propiedad → Dominio** → `tudominio.com`.
3. Google te da un registro `TXT`. Créalo en tu DNS y pulsa **Verificar**.
4. **Sitemaps** → escribe `sitemap.xml` → Enviar. La tienda lo genera sola en `https://tudominio.com/sitemap.xml` con el inicio, las secciones y todos los productos visibles.
5. **Inspección de URLs** → pega la portada y un par de productos → *Solicitar indexación*.

La tienda ya entrega `robots.txt` (bloquea el panel, el checkout y las páginas de cuenta), título y descripción propios por página, y devuelve código 404 real en direcciones que no existen.

Para ver cómo se comparte un enlace en WhatsApp o Facebook: https://developers.facebook.com/tools/debug/ (pega la dirección de un producto). La imagen sale de la primera foto del producto; para la portada, sube una imagen en *Apariencia → Imagen de la portada*.

La descripción general de la tienda se edita en el panel: *Contacto y pagos → Datos del negocio*.

---

## 9. Base de datos: acceso y permisos

### No exponerla a internet

- El backend debe usar la dirección **privada** (`${{Postgres.DATABASE_URL}}`, que apunta a `…railway.internal`).
- En el servicio Postgres → *Settings → Networking*: si no necesitas conectarte desde tu PC, elimina el **TCP Proxy / Public Networking**. Puedes volver a activarlo un momento cuando haga falta.

### Usuario de permisos mínimos (opcional, recomendado)

Railway entrega un usuario administrador (`postgres`). Lo ideal es que el servidor trabaje con uno que solo pueda leer y escribir filas, y que el administrador se use únicamente para las migraciones.

1. Conéctate a la base como `postgres` (pestaña *Data* del servicio, o `psql` con la URL pública) y ejecuta, cambiando la contraseña:

   ```sql
   CREATE ROLE ja_app LOGIN PASSWORD 'UNA-CONTRASEÑA-LARGA-Y-ALEATORIA';
   GRANT CONNECT ON DATABASE railway TO ja_app;
   GRANT USAGE ON SCHEMA public TO ja_app;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ja_app;
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ja_app;
   -- Para que las tablas que creen las próximas migraciones también queden accesibles:
   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ja_app;
   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
     GRANT USAGE, SELECT ON SEQUENCES TO ja_app;
   ```

   (`railway` es el nombre de base por defecto en Railway; cámbialo si la tuya se llama distinto.)

2. En Railway (backend):
   - `MIGRATE_DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (administrador, solo para migrar al arrancar)
   - `DATABASE_URL` = la misma URL cambiando usuario y contraseña por `ja_app` y la suya:
     `postgresql://ja_app:CONTRASEÑA@${{Postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/railway`

3. Despliega y revisa el log: las migraciones deben aplicarse y el servidor arrancar. Prueba crear un pedido.

Todo el acceso a datos del código pasa por Prisma (consultas parametrizadas); no hay SQL armado con texto del usuario.

---

## 10. Copias de seguridad

Hay dos cosas que respaldar: la **base de datos** y la carpeta de **imágenes** (el Volume del backend).

### Opción A: copias de Railway

En el servicio Postgres y en el Volume del backend busca la pestaña **Backups**. Si tu plan la incluye, activa una copia diaria y otra semanal. Es lo más simple; comprueba que puedes restaurar una.

### Opción B: copia manual a tu PC (hazla siempre antes de un despliegue con migraciones)

Con la URL pública de Postgres (*Variables → DATABASE_PUBLIC_URL*) y las herramientas de PostgreSQL instaladas:

```bash
pg_dump "PEGA-AQUÍ-LA-URL-PÚBLICA" --format=custom --no-owner --file=ja-tienda-2026-11-16.dump
```

Para restaurar en una base vacía:

```bash
pg_restore --no-owner --dbname="URL-DE-LA-BASE-DESTINO" ja-tienda-2026-11-16.dump
```

Guarda el archivo fuera de tu PC también (Drive, por ejemplo). Contiene datos personales de tus clientes: no lo compartas ni lo subas a GitHub.

### Opción C: copia automática semanal

Un trabajo programado (por ejemplo, un *Cron* de Railway o una GitHub Action) que ejecute el `pg_dump` y suba el archivo a un almacenamiento externo. Dímelo cuando quieras montarlo y lo preparo.

### Recomendación

Activa la opción A si tu plan la tiene y, además, haz una copia manual (B) antes de cada despliegue con migraciones y una vez por semana mientras no haya copia automática externa. Una copia que nunca se probó restaurar no cuenta: restaura una en una base de prueba al menos una vez.

---

## 11. Pruebas antes de lanzar

Hazlas en producción, desde un celular y una computadora.

### Cuentas

- [ ] Navegar, llenar el carrito y marcar favoritos **sin** cuenta.
- [ ] "Continuar con la compra" pide iniciar sesión; al registrarte el carrito sigue igual.
- [ ] Los favoritos marcados sin cuenta aparecen en *Mi cuenta → Favoritos*.
- [ ] Cerrar sesión y volver a entrar. Probar en Safari (iPhone) y Chrome.
- [ ] "Continuar con Google" vuelve al checkout con la sesión iniciada.
- [ ] Recuperar contraseña: llega el correo, el enlace funciona **una sola vez** y caduca.
- [ ] Cinco contraseñas incorrectas bloquean la cuenta 15 minutos.

### Compra

- [ ] Pedido con **Yape**: subir captura → en el panel aparece la captura → *Confirmar pago* → el cliente ve "Pagado".
- [ ] Marcar *Enviado* y *Entregado*: el cliente lo ve en *Mi cuenta*.
- [ ] Pedido con **tarjeta de prueba** aceptada y otro con rechazada (sección 6).
- [ ] **Última unidad:** con dos cuentas en dos dispositivos, intentar comprar a la vez el mismo producto con stock 1. Solo una debe lograrlo.
- [ ] Crear un pedido y no pagarlo: a los 30 minutos pasa a *Cancelado* y el stock vuelve.
- [ ] Abrir la dirección de una captura de pago sin sesión de administración: debe dar error.

### Panel

- [ ] Entrar con usuario y contraseña; cambiar la contraseña en *Mi acceso*.
- [ ] *Estado del servidor*: producción, https, tu IP pública, correos, Google y tarjeta.
- [ ] Crear un producto con fotos desde el celular y asignarlo a una temporada.
- [ ] Desactivar una cuenta de cliente y comprobar que ya no puede entrar.
- [ ] Enviar un reclamo de prueba: llega la constancia, aparece en *Reclamos* y la respuesta llega por correo.

### Contenido y legal

- [ ] Completar razón social, RUC y dirección en *Contacto y pagos*.
- [ ] Revisar los textos de Términos, Privacidad y Cambios y devoluciones (son plantillas).
- [ ] Subir el QR de Yape, el logo y las fotos reales; quitar los productos de muestra.

### Buscadores y compartir

- [ ] Compartir por WhatsApp el enlace de un producto: debe salir su foto, nombre y precio.
- [ ] `https://tudominio.com/sitemap.xml` y `/robots.txt` cargan.
- [ ] Una dirección inventada muestra la página "no encontrada".
