import { CustomError } from "../errors/customError.error";
import { DIRECTIONS, IResult, Result } from "../models/result.model";
import { assertId } from "../utils/objectId";

function clampLimit(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return Math.min(n, 100);
}

export async function listPublished(limit: unknown) {
  return Result.find({ isPublished: true })
    .sort({ tradedAt: -1, createdAt: -1 })
    .limit(clampLimit(limit, 12))
    .lean();
}

/** Estadísticas sobre lo publicado: lo que se ve en la web es lo que se suma. */
export async function stats() {
  const [row] = await Result.aggregate<{
    totalProfitCents: number;
    trades: number;
    winners: number;
    bestTradeCents: number;
    since: Date | null;
  }>([
    { $match: { isPublished: true } },
    {
      $group: {
        _id: null,
        totalProfitCents: { $sum: "$profitCents" },
        trades: { $sum: 1 },
        winners: { $sum: { $cond: [{ $gt: ["$profitCents", 0] }, 1, 0] } },
        bestTradeCents: { $max: "$profitCents" },
        since: { $min: "$tradedAt" },
      },
    },
  ]);

  if (!row) {
    return {
      totalProfitCents: 0,
      trades: 0,
      winners: 0,
      winRate: 0,
      bestTradeCents: 0,
      since: null,
    };
  }
  return {
    totalProfitCents: row.totalProfitCents,
    trades: row.trades,
    winners: row.winners,
    winRate: Math.round((row.winners / row.trades) * 1000) / 10,
    bestTradeCents: Math.max(0, row.bestTradeCents ?? 0),
    since: row.since ? new Date(row.since).toISOString() : null,
  };
}

// ─── Admin ───────────────────────────────────────────────────────────────────

function num(value: unknown, field: string): number {
  const n = Number(value);
  if (value === null || value === "" || !Number.isFinite(n)) {
    throw new CustomError(`${field} debe ser un número`, 400);
  }
  return n;
}

function pickInput(body: any, creating: boolean): Partial<IResult> {
  const data: Partial<IResult> = {};
  if (body.asset !== undefined) data.asset = String(body.asset).trim();
  if (body.direction !== undefined) {
    if (!DIRECTIONS.includes(body.direction))
      throw new CustomError("La dirección debe ser buy o sell", 400);
    data.direction = body.direction;
  }
  if (body.lots !== undefined) data.lots = num(body.lots, "El lotaje");
  if (body.entryPrice !== undefined) data.entryPrice = num(body.entryPrice, "El precio de entrada");
  if (body.exitPrice !== undefined) data.exitPrice = num(body.exitPrice, "El precio de salida");
  if (body.profitCents !== undefined)
    data.profitCents = Math.round(num(body.profitCents, "La ganancia"));
  if (body.image !== undefined) data.image = String(body.image ?? "");
  if (body.note !== undefined) data.note = String(body.note ?? "");
  if (body.isPublished !== undefined) data.isPublished = !!body.isPublished;
  if (body.tradedAt !== undefined) {
    const date = new Date(body.tradedAt);
    if (Number.isNaN(date.getTime()))
      throw new CustomError("La fecha de la operación no es válida", 400);
    data.tradedAt = date;
  }

  if (creating) {
    if (!data.asset) throw new CustomError("El activo es obligatorio", 400);
    if (!data.direction) throw new CustomError("La dirección es obligatoria", 400);
    for (const [key, label] of [
      ["lots", "El lotaje"],
      ["entryPrice", "El precio de entrada"],
      ["exitPrice", "El precio de salida"],
      ["profitCents", "La ganancia"],
    ] as const) {
      if (data[key] === undefined) throw new CustomError(`${label} es obligatorio`, 400);
    }
    if (!data.tradedAt) data.tradedAt = new Date();
  }
  return data;
}

export async function listAll() {
  return Result.find().sort({ tradedAt: -1, createdAt: -1 }).lean();
}

export async function create(body: any) {
  const result = await Result.create(pickInput(body ?? {}, true));
  return result.toObject();
}

export async function update(id: string, body: any) {
  assertId(id, "Resultado no encontrado");
  const result = await Result.findByIdAndUpdate(
    id,
    { $set: pickInput(body ?? {}, false) },
    {
      new: true,
      runValidators: true,
    },
  ).lean();
  if (!result) throw new CustomError("Resultado no encontrado", 404);
  return result;
}

export async function remove(id: string) {
  assertId(id, "Resultado no encontrado");
  const result = await Result.findByIdAndDelete(id);
  if (!result) throw new CustomError("Resultado no encontrado", 404);
  return { ok: true };
}
