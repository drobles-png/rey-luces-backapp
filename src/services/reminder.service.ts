import { Access } from "../models/access.model";
import { sendAccessExpiringEmail } from "./notification.service";

const DAY_MS = 24 * 60 * 60 * 1000;
// Ecuador no tiene horario de verano: UTC-5 fijo todo el año.
const ECUADOR_OFFSET_MS = 5 * 60 * 60 * 1000;

/** [inicio, fin) del día calendario de Ecuador que cae `daysAhead` días después de hoy. */
function ecuadorDay(daysAhead: number, now: Date) {
  const local = new Date(now.getTime() - ECUADOR_OFFSET_MS);
  const start =
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + daysAhead) +
    ECUADOR_OFFSET_MS;
  return { start: new Date(start), end: new Date(start + DAY_MS) };
}

async function remind(daysAhead: 7 | 0, now: Date): Promise<number> {
  const flag = daysAhead === 7 ? "reminder7SentAt" : "reminder0SentAt";
  const { start, end } = ecuadorDay(daysAhead, now);

  const accesses = await Access.find({
    revokedAt: null,
    expiresAt: { $gte: start, $lt: end },
    [flag]: null,
  })
    .populate("user", "email name isActive")
    .populate("product", "title slug")
    .lean<any[]>();

  let sent = 0;
  for (const access of accesses) {
    if (!access.user?.email || access.user.isActive === false || !access.product) continue;

    const ok = await sendAccessExpiringEmail({
      user: { email: access.user.email, name: access.user.name ?? "" },
      productTitle: access.product.title,
      productSlug: access.product.slug,
      expiresAt: access.expiresAt,
      today: daysAhead === 0,
    });
    // Solo se marca lo que salió: no se da por avisado a quien no recibió nada.
    if (ok) {
      await Access.updateOne({ _id: access._id }, { $set: { [flag]: new Date() } });
      sent++;
    }
  }
  return sent;
}

/** Correo 7 días antes y el día del vencimiento. Cortar el acceso no hace falta: "vigente" se evalúa en cada petición. */
export async function sendAccessReminders(now: Date = new Date()) {
  const sevenDays = await remind(7, now);
  const today = await remind(0, now);
  return { sevenDays, today };
}
