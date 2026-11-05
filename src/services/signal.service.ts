import { CustomError } from "../errors/customError.error";
import { DIRECTIONS } from "../models/result.model";
import { ISignal, Signal, SIGNAL_STATUSES } from "../models/signal.model";
import { JwtPayload } from "../types/AuthRequest";
import { assertId } from "../utils/objectId";
import { hasActiveMembership } from "./access.service";

const SORT = { sentAt: -1, createdAt: -1 } as const;

/** Señales cerradas: son la prueba pública. Las abiertas solo las ven los miembros. */
export async function listPublic(limit: unknown) {
  const n = Number(limit);
  const max = Number.isInteger(n) && n > 0 ? Math.min(n, 50) : 8;
  return Signal.find({ status: { $ne: "open" } })
    .sort(SORT)
    .limit(max)
    .lean();
}

export async function listForMember(user: JwtPayload) {
  if (user.accountType !== "admin" && !(await hasActiveMembership(user.userId))) {
    throw new CustomError("Las señales en vivo son para miembros VIP con acceso vigente", 403);
  }
  return Signal.find().sort(SORT).limit(100).lean();
}

// ─── Admin ───────────────────────────────────────────────────────────────────

function cents(value: unknown, field: string): number {
  const n = Number(value);
  if (value === "" || !Number.isFinite(n))
    throw new CustomError(`${field} debe ser un número`, 400);
  return Math.round(n);
}

function date(value: unknown, field: string): Date {
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new CustomError(`${field} no es una fecha válida`, 400);
  return d;
}

function pickInput(body: any): Partial<ISignal> {
  const data: Partial<ISignal> = {};
  if (body.asset !== undefined) data.asset = String(body.asset).trim();
  if (body.direction !== undefined) {
    if (!DIRECTIONS.includes(body.direction))
      throw new CustomError("La dirección debe ser buy o sell", 400);
    data.direction = body.direction;
  }
  if (body.riskCents !== undefined) data.riskCents = cents(body.riskCents, "El riesgo");
  if (body.targetCents !== undefined) data.targetCents = cents(body.targetCents, "El objetivo");
  for (const key of ["management", "window", "note"] as const) {
    if (body[key] !== undefined) data[key] = String(body[key] ?? "");
  }
  if (body.status !== undefined) {
    if (!SIGNAL_STATUSES.includes(body.status))
      throw new CustomError("Estado de señal inválido", 400);
    data.status = body.status;
  }
  if (body.resultCents !== undefined) {
    data.resultCents = body.resultCents === null ? null : cents(body.resultCents, "El resultado");
  }
  if (body.sentAt !== undefined) data.sentAt = date(body.sentAt, "La hora de envío");
  if (body.closedAt !== undefined) {
    data.closedAt = body.closedAt === null ? null : date(body.closedAt, "La hora de cierre");
  }
  return data;
}

/** Cerrar sin hora de cierre la pone ahora; reabrir limpia el cierre. */
function normalizeClose(data: Partial<ISignal>, current?: ISignal | null) {
  const status = data.status ?? current?.status;
  if (status === "open") {
    if (data.status === "open") {
      data.closedAt = null;
      data.resultCents = null;
    }
  } else if (status && data.closedAt === undefined && !current?.closedAt) {
    data.closedAt = new Date();
  }
}

export async function listAll() {
  return Signal.find().sort(SORT).lean();
}

export async function create(body: any) {
  const data = pickInput(body ?? {});
  if (!data.asset) throw new CustomError("El activo es obligatorio", 400);
  if (!data.direction) throw new CustomError("La dirección es obligatoria", 400);
  normalizeClose(data);
  const signal = await Signal.create(data);
  return signal.toObject();
}

export async function update(id: string, body: any) {
  assertId(id, "Señal no encontrada");
  const current = await Signal.findById(id).lean();
  if (!current) throw new CustomError("Señal no encontrada", 404);

  const data = pickInput(body ?? {});
  normalizeClose(data, current);
  const signal = await Signal.findByIdAndUpdate(
    id,
    { $set: data },
    { new: true, runValidators: true },
  ).lean();
  return signal;
}

export async function remove(id: string) {
  assertId(id, "Señal no encontrada");
  const signal = await Signal.findByIdAndDelete(id);
  if (!signal) throw new CustomError("Señal no encontrada", 404);
  return { ok: true };
}
