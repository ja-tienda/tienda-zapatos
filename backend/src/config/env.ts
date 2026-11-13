import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revisa backend/.env`);
  }
  return value;
}

const izipay = {
  // Credenciales del Back Office Vendedor de Izipay (Configuración > Tienda > Claves de API REST)
  username: process.env.IZIPAY_USERNAME ?? '',
  password: process.env.IZIPAY_PASSWORD ?? '',
  publicKey: process.env.IZIPAY_PUBLIC_KEY ?? '',
  hmacKey: process.env.IZIPAY_HMAC_KEY ?? '',
};

export const env = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  adminPin: required('ADMIN_PIN'),
  adminTokenSecret: required('ADMIN_TOKEN_SECRET'),
  databaseUrl: required('DATABASE_URL'),
  // Dirección pública del backend. Vacío = las imágenes subidas se guardan como /uploads/...
  // (lo correcto cuando tienda y API comparten dominio, como en desarrollo).
  publicUrl: (process.env.PUBLIC_URL ?? '').replace(/\/$/, ''),
  // Cuántos proxys hay delante del backend en producción (Nginx, Render, Railway… = 1).
  // Sin esto, el límite de intentos vería a todos los clientes como una sola IP.
  trustProxy: Number(process.env.TRUST_PROXY ?? 0) || 0,
  izipay: {
    ...izipay,
    // El pago con tarjeta solo se ofrece cuando están las cuatro claves
    enabled: Boolean(izipay.username && izipay.password && izipay.publicKey && izipay.hmacKey),
  },
};
