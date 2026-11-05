import { Resend } from "resend";
import { env } from "../config/env";

let resend: Resend | null = null;

function getClient(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(env.RESEND_API_KEY);
  return resend;
}

/**
 * Envía un correo. Nunca lanza: el fallo de un correo no debe romper el
 * flujo que lo disparó (una compra, un registro). Devuelve si Resend lo aceptó.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const client = getClient();
  if (!client) {
    console.warn(`[email] RESEND_API_KEY no definida — no se envió "${subject}" a ${to}`);
    return false;
  }

  try {
    const { error } = await client.emails.send({ from: env.RESEND_FROM_EMAIL, to, subject, html });
    if (error) {
      console.error("[email] Resend rechazó el envío:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] send failed:", error);
    return false;
  }
}

/** Escapa texto que viene del usuario antes de meterlo en un correo HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Botón dorado para enlaces de acción dentro del cuerpo. */
export function button(label: string, href: string): string {
  return `<p style="margin:28px 0 8px"><a href="${href}" style="display:inline-block;background:#d4af37;color:#0b0b0d;text-decoration:none;font-weight:bold;padding:14px 26px;border-radius:10px">${label}</a></p>`;
}

/** Plantilla base: tarjeta oscura centrada con acento dorado, la estética de la marca. */
export function layout(title: string, body: string): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050506;padding:32px 0;font-family:Arial,Helvetica,sans-serif">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111114;border:1px solid #2a2418;border-radius:16px;overflow:hidden">
        <tr><td style="padding:22px 32px;border-bottom:1px solid #2a2418;color:#d4af37;font-size:18px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">Rey Luces</td></tr>
        <tr><td style="padding:32px;color:#e7e5e4;font-size:15px;line-height:1.6">
          <h1 style="margin:0 0 16px;font-size:22px;color:#f5f5f4">${title}</h1>
          ${body}
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #2a2418;color:#78716c;font-size:12px">© ${new Date().getFullYear()} Rey Luces · Operar índices sintéticos implica riesgo de pérdida.</td></tr>
      </table>
    </td></tr>
  </table>`;
}
