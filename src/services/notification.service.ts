import { env } from "../config/env";
import { button, escapeHtml, layout, sendEmail } from "./email.service";

/**
 * Correos transaccionales. Ninguno lanza (sendEmail nunca lanza): un correo
 * que no sale no debe tumbar un registro, una compra ni un acceso.
 */

const fecha = new Intl.DateTimeFormat("es-EC", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Guayaquil",
});

/** "30 de noviembre de 2026" en hora de Ecuador. */
export function formatDate(date: Date): string {
  return fecha.format(date);
}

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** La frase del vencimiento que se repite en todos los correos de acceso. */
export function expiryPhrase(expiresAt: Date | null): string {
  return expiresAt
    ? `Tu acceso está activo hasta el <strong>${formatDate(expiresAt)}</strong>.`
    : "Tu acceso no tiene fecha de vencimiento.";
}

function saludo(name: string): string {
  const first = (name || "").trim().split(/\s+/)[0];
  return `<p>Hola${first ? ` ${escapeHtml(first)}` : ""},</p>`;
}

const areaUrl = () => `${env.FRONTEND_URL}/cuenta`;

export function sendWelcomeEmail(user: { email: string; name: string }) {
  const body = `
    ${saludo(user.name)}
    <p>Tu cuenta en Rey Luces está lista. Desde tu área vas a ver tus planes, el curso y, si eres miembro VIP,
    el acceso a la comunidad y el historial de señales.</p>
    ${button("Entrar a mi cuenta", areaUrl())}
    <p style="color:#a8a29e;font-size:13px">Si no creaste esta cuenta, ignora este correo.</p>`;
  return sendEmail(user.email, "Bienvenido a Rey Luces", layout("Bienvenido a Rey Luces", body));
}

export function sendPurchaseEmail(input: {
  user: { email: string; name: string };
  productTitle: string;
  productType: string;
  totalCents: number;
  expiresAt: Date | null;
}) {
  const extra =
    input.productType === "service"
      ? "<p>En las próximas horas te contactaremos por WhatsApp para agendar tu sesión.</p>"
      : `<p>${expiryPhrase(input.expiresAt)}</p>`;

  const body = `
    ${saludo(input.user.name)}
    <p>Recibimos tu pago de <strong>${formatMoney(input.totalCents)}</strong> por
    <strong>${escapeHtml(input.productTitle)}</strong>. ¡Gracias por confiar en nosotros!</p>
    ${extra}
    ${button("Ver mi compra", areaUrl())}`;
  return sendEmail(
    input.user.email,
    `Compra confirmada: ${input.productTitle}`,
    layout("Compra confirmada", body),
  );
}

export function sendAccessGrantedEmail(input: {
  user: { email: string; name: string };
  productTitles: string[];
  expiresAt: Date | null;
  temporaryPassword?: string;
}) {
  const lista = input.productTitles.map((t) => `<li>${escapeHtml(t)}</li>`).join("");
  const cuenta = input.temporaryPassword
    ? `<p>Creamos tu cuenta con este correo. Tu contraseña temporal es
       <strong style="color:#d4af37">${escapeHtml(input.temporaryPassword)}</strong>;
       cámbiala apenas entres, desde tu cuenta.</p>`
    : "";

  const body = `
    ${saludo(input.user.name)}
    <p>Te dimos acceso a:</p>
    <ul style="padding-left:20px">${lista}</ul>
    <p>${expiryPhrase(input.expiresAt)}</p>
    ${cuenta}
    ${button("Entrar a mi cuenta", areaUrl())}`;
  return sendEmail(
    input.user.email,
    "Tienes un nuevo acceso en Rey Luces",
    layout("Acceso otorgado", body),
  );
}

export function sendAccessExpiringEmail(input: {
  user: { email: string; name: string };
  productTitle: string;
  productSlug: string;
  expiresAt: Date;
  today: boolean;
}) {
  const cuando = input.today
    ? "vence <strong>hoy</strong>"
    : `vence el <strong>${formatDate(input.expiresAt)}</strong>`;
  const body = `
    ${saludo(input.user.name)}
    <p>Tu acceso a <strong>${escapeHtml(input.productTitle)}</strong> ${cuando}.</p>
    <p>Si quieres seguir dentro, renueva antes de esa fecha y no pierdes ni un día.</p>
    ${button("Renovar ahora", `${env.FRONTEND_URL}/planes/${encodeURIComponent(input.productSlug)}`)}`;
  return sendEmail(
    input.user.email,
    input.today
      ? `Tu acceso a ${input.productTitle} vence hoy`
      : `Tu acceso a ${input.productTitle} vence en 7 días`,
    layout("Tu acceso está por vencer", body),
  );
}
