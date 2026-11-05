import axios from "axios";
import { env } from "../config/env";
import { CustomError } from "../errors/customError.error";

const CONFIRM_URL = "https://paymentbox.payphonetodoesposible.com/api/confirm";

export function isPayphoneConfigured(): boolean {
  return !!(env.PAYPHONE_TOKEN && env.PAYPHONE_STORE_ID);
}

export interface PayphoneConfirmation {
  /** 3 = aprobada, 2 = cancelada. */
  statusCode: number;
  transactionStatus?: string;
  amount: number;
  clientTransactionId?: string;
  [key: string]: unknown;
}

/**
 * Confirma la transacción contra Payphone. Si no se confirma en 5 minutos,
 * Payphone reversa el cobro: por eso el frontend la dispara apenas vuelve.
 */
export async function confirm(
  id: number,
  clientTransactionId: string,
): Promise<PayphoneConfirmation> {
  if (!isPayphoneConfigured()) {
    throw new CustomError("Los pagos en línea aún no están configurados", 503);
  }
  try {
    const { data } = await axios.post(
      CONFIRM_URL,
      { id, clientTxId: clientTransactionId },
      { headers: { Authorization: `Bearer ${env.PAYPHONE_TOKEN}` }, timeout: 20000 },
    );
    return data as PayphoneConfirmation;
  } catch (error: any) {
    const detail = error?.response?.data;
    console.error("[payphone] confirm falló:", detail || error?.message);
    throw new CustomError(
      detail?.message ? `Payphone: ${detail.message}` : "No pudimos confirmar el pago con Payphone",
      502,
      detail,
    );
  }
}
