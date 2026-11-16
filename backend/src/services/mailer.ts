import { env } from '../config/env';
import { escapeHtml } from '../utils/crypto';

interface Mail {
  to: string;
  subject: string;
  /** Párrafos de texto plano; se escapan antes de ir al HTML. */
  paragraphs: string[];
  /** Botón principal opcional */
  action?: { label: string; url: string };
  replyTo?: string;
}

const STORE_NAME = 'J & A — Calzados, ropa y accesorios';

function render(mail: Mail): { html: string; text: string } {
  const body = mail.paragraphs
    .map((p) => `<p style="margin:0 0 14px;line-height:1.55">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const button = mail.action
    ? `<p style="margin:22px 0"><a href="${escapeHtml(mail.action.url)}" style="background:#2a211c;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">${escapeHtml(mail.action.label)}</a></p>
       <p style="margin:0 0 14px;font-size:12px;color:#776759">Si el botón no funciona, copia este enlace en tu navegador:<br>${escapeHtml(mail.action.url)}</p>`
    : '';
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#2a211c;max-width:520px;margin:0 auto;padding:24px">
    <p style="font-family:Georgia,serif;font-size:24px;margin:0 0 20px">J <span style="color:#c2456a">&amp;</span> A</p>
    ${body}${button}
    <p style="margin:24px 0 0;font-size:12px;color:#776759;border-top:1px solid #e4d9cb;padding-top:14px">${escapeHtml(STORE_NAME)}</p>
  </div>`;
  const text = [...mail.paragraphs, ...(mail.action ? [`${mail.action.label}: ${mail.action.url}`] : [])].join('\n\n');
  return { html, text };
}

/**
 * Envía un correo con Resend (https://resend.com). Devuelve false si no se pudo: quien
 * llama decide si eso es grave. Nunca lanza un error, para no tumbar la operación principal.
 * Sin claves (desarrollo) el correo se imprime en la consola del servidor.
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  const { html, text } = render(mail);

  if (!env.mail.enabled) {
    if (env.isProduction) {
      console.error(`No se envió el correo "${mail.subject}": falta configurar RESEND_API_KEY y MAIL_FROM`);
      return false;
    }
    console.log(`\n📧 [correo de desarrollo] Para: ${mail.to}\n   Asunto: ${mail.subject}\n${text}\n`);
    return true;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.mail.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.mail.from,
        to: [mail.to],
        subject: mail.subject,
        html,
        text,
        ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      // Solo el código y el motivo: nunca se registra el contenido del correo
      console.error(`Resend rechazó el correo "${mail.subject}": ${response.status} ${(await response.text()).slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`No se pudo enviar el correo "${mail.subject}":`, err instanceof Error ? err.message : err);
    return false;
  }
}
