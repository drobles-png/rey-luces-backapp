import axios from "axios";
import crypto from "crypto";
import { env } from "../config/env";
import { CustomError } from "../errors/customError.error";

const API = "https://video.bunnycdn.com";
const TUS_ENDPOINT = "https://video.bunnycdn.com/tusupload";

export function isBunnyConfigured(): boolean {
  return !!(env.BUNNY_LIBRARY_ID && env.BUNNY_STREAM_API_KEY);
}

function ensureConfig() {
  if (!isBunnyConfigured()) {
    throw new CustomError("Bunny Stream no está configurado en el servidor", 503);
  }
}

/** Crea el objeto de video vacío; el binario lo sube el navegador por TUS. */
export async function createVideo(title: string): Promise<string> {
  ensureConfig();
  try {
    const { data } = await axios.post(
      `${API}/library/${env.BUNNY_LIBRARY_ID}/videos`,
      { title: title.slice(0, 200) },
      { headers: { AccessKey: env.BUNNY_STREAM_API_KEY }, timeout: 15000 },
    );
    if (!data?.guid) throw new Error("Bunny no devolvió guid");
    return data.guid as string;
  } catch (error: any) {
    console.error("[bunny] no se pudo crear el video:", error?.response?.data || error?.message);
    throw new CustomError("No se pudo crear el video en Bunny Stream", 502);
  }
}

/**
 * Firma de subida directa por TUS. Vercel corta los cuerpos grandes, así que
 * el video nunca pasa por este servidor y la API key no sale de acá.
 */
export function uploadTicket(videoId: string) {
  ensureConfig();
  const expire = Math.floor(Date.now() / 1000) + 60 * 60 * 6;
  const signature = crypto
    .createHash("sha256")
    .update(env.BUNNY_LIBRARY_ID + env.BUNNY_STREAM_API_KEY + expire + videoId)
    .digest("hex");
  return { videoId, libraryId: env.BUNNY_LIBRARY_ID, expire, signature, endpoint: TUS_ENDPOINT };
}

/**
 * URL del reproductor. Con BUNNY_TOKEN_AUTH_KEY la URL va firmada y vence en
 * 4 horas; sin ella el embed funciona pero cualquiera con el enlace lo ve.
 */
export function embedUrl(videoId: string): string | null {
  if (!env.BUNNY_LIBRARY_ID || !videoId) return null;
  const base = `https://iframe.mediadelivery.net/embed/${env.BUNNY_LIBRARY_ID}/${videoId}`;
  if (!env.BUNNY_TOKEN_AUTH_KEY) return base;

  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 4;
  const token = crypto
    .createHash("sha256")
    .update(env.BUNNY_TOKEN_AUTH_KEY + videoId + expires)
    .digest("hex");
  return `${base}?token=${token}&expires=${expires}`;
}
