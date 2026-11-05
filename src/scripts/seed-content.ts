/**
 * Seed script — catálogo, curso, resultados y señales para ver la web con datos.
 * Idempotente: productos por slug, resultados y señales por activo + fecha. Solo
 * inserta lo que falta; lo que ya existe (y pudo editarse en el panel) no se pisa.
 * Los módulos del curso solo se crean si el producto no tiene ninguno, para no
 * pisar lo que se haya editado desde el panel.
 * Uso: pnpm seed:content
 *
 * PRECIOS PROVISIONALES: confirmar con Enrique antes de abrir ventas.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";
import { Lesson } from "../models/lesson.model";
import { CourseModule } from "../models/module.model";
import { IProduct, Product } from "../models/product.model";
import { IResult, Result } from "../models/result.model";
import { ISignal, Signal } from "../models/signal.model";

type ProductSeed = Omit<IProduct, "_id" | "createdAt" | "updatedAt">;

const PRODUCTS: ProductSeed[] = [
  {
    slug: "senales-vip-mensual",
    title: "Señales VIP · Mensual",
    type: "membership",
    shortDescription:
      "Entra a la comunidad VIP y opera Boom & Crash con las señales de Enrique en vivo.",
    description:
      "Acceso por 30 días a la comunidad privada de WhatsApp. Cada señal llega con el activo, la dirección, " +
      "cuánto arriesgar, el objetivo y cómo gestionar la entrada. También avisamos cuándo cerrar, para que no " +
      "te quedes adivinando.",
    priceCents: 4900,
    comparePriceCents: null,
    cover: "",
    features: [
      "Señales en vivo en WhatsApp",
      "Riesgo y objetivo en cada entrada",
      "Aviso de cierre",
      "Soporte en la comunidad",
    ],
    accessDurationDays: 30,
    badge: "",
    isFeatured: false,
    isPublished: true,
    sortOrder: 0,
  },
  {
    slug: "senales-vip-trimestral",
    title: "Señales VIP · Trimestral",
    type: "membership",
    shortDescription:
      "Tres meses en la comunidad VIP al mejor precio. Constancia es lo que da resultados.",
    description:
      "Acceso por 90 días a la comunidad privada de WhatsApp con todas las señales de Boom & Crash, " +
      "riesgo y objetivo en cada entrada, avisos de cierre y soporte directo en la comunidad.",
    priceCents: 11900,
    comparePriceCents: 14700,
    cover: "",
    features: [
      "Señales en vivo en WhatsApp",
      "Riesgo y objetivo en cada entrada",
      "Aviso de cierre",
      "Soporte en la comunidad",
      "Ahorras frente al plan mensual",
    ],
    accessDurationDays: 90,
    badge: "Más elegido",
    isFeatured: true,
    isPublished: true,
    sortOrder: 1,
  },
  {
    slug: "curso-boom-crash",
    title: "Curso Boom & Crash desde cero",
    type: "course",
    shortDescription:
      "Aprende a leer Boom y Crash, gestionar el riesgo y operar con un plan propio.",
    description:
      "Un curso grabado, paso a paso: desde abrir tu cuenta en Deriv y MT5 hasta leer los spikes, " +
      "gestionar el lotaje y construir tu plan de trading. Acceso de por vida y a tu ritmo.",
    priceCents: 9700,
    comparePriceCents: null,
    cover: "",
    features: [
      "Lecciones en video a tu ritmo",
      "Gestión de riesgo con lotaje 0.25",
      "Lectura de spikes y tendencia",
      "Acceso de por vida",
    ],
    accessDurationDays: null,
    badge: "",
    isFeatured: false,
    isPublished: true,
    sortOrder: 2,
  },
  {
    slug: "mentoria-1-1",
    title: "Mentoría 1:1 con Enrique",
    type: "service",
    shortDescription: "Una sesión privada para revisar tu operativa y armar tu plan con Enrique.",
    description:
      "Sesión individual por videollamada. Revisamos tus operaciones, tu gestión de riesgo y tu psicología, " +
      "y sales con un plan concreto. Después del pago te contactamos por WhatsApp para agendar.",
    priceCents: 19900,
    comparePriceCents: null,
    cover: "",
    features: [
      "Sesión privada por videollamada",
      "Revisión de tus operaciones",
      "Plan de trading personalizado",
      "Agenda por WhatsApp",
    ],
    accessDurationDays: null,
    badge: "",
    isFeatured: false,
    isPublished: true,
    sortOrder: 3,
  },
];

const COURSE: { title: string; lessons: string[] }[] = [
  {
    title: "Fundamentos de índices sintéticos",
    lessons: [
      "Qué son los índices sintéticos y por qué Boom & Crash",
      "Abrir tu cuenta en Deriv paso a paso",
      "Instalar y configurar MT5",
      "Tu primera operación en cuenta demo",
    ],
  },
  {
    title: "Lectura de Boom y Crash",
    lessons: [
      "Cómo se forman los spikes",
      "Identificar la tendencia antes de entrar",
      "Zonas de entrada y de salida",
      "Errores comunes al perseguir el spike",
    ],
  },
  {
    title: "Gestión de riesgo y psicología",
    lessons: [
      "Lotaje 0.25: cuánto arriesgar por entrada",
      "Ratio 1:5 y por qué cambia todo",
      "Psicología: disciplina después de una pérdida",
      "Tu plan de trading por escrito",
    ],
  },
];

const TRADED_AT = new Date("2026-10-13T23:25:31Z"); // hora del servidor MT5 de Deriv (UTC)

const RESULTS: Omit<IResult, "_id" | "createdAt" | "updatedAt">[] = [
  [2, 6203.4339, 6171.3996, 6406, "/img/resultado-crash1000.png"],
  [5, 6207.8089, 6189.4483, 9181, ""],
  [10, 6207.2189, 6191.654625, 15565, ""],
  [25, 6204.0799, 6192.91887, 27903, ""],
  [25, 6206.5409, 6192.87636, 34161, ""],
].map(([lots, entryPrice, exitPrice, profitCents, image]) => ({
  asset: "Crash 1000 Index",
  direction: "sell" as const,
  lots: lots as number,
  entryPrice: entryPrice as number,
  exitPrice: exitPrice as number,
  profitCents: profitCents as number,
  image: image as string,
  note: "",
  tradedAt: TRADED_AT,
  isPublished: true,
}));

const SIGNALS: Omit<ISignal, "_id" | "createdAt" | "updatedAt">[] = [
  {
    asset: "Crash 1000",
    direction: "sell",
    riskCents: 2500,
    targetCents: 12500,
    management: "Máximo 5-8 operaciones de 0.25",
    window: "2 horas de caída",
    note: "Felicidades a los que escucharon",
    status: "won",
    resultCents: 95090,
    sentAt: new Date("2026-10-13T15:16:00-05:00"),
    closedAt: new Date("2026-10-13T17:50:00-05:00"),
  },
  {
    // Ejemplo para que los miembros vean cómo llega una señal abierta.
    asset: "Boom 1000",
    direction: "buy",
    riskCents: 2500,
    targetCents: 12500,
    management: "Máximo 5 operaciones de 0.25",
    window: "1 hora de subida",
    note: "Señal de ejemplo: esperar el spike y entrar a favor de la tendencia",
    status: "open",
    resultCents: null,
    sentAt: new Date("2026-10-13T18:40:00-05:00"),
    closedAt: null,
  },
];

async function seedProducts() {
  for (const data of PRODUCTS) {
    await Product.findOneAndUpdate(
      { slug: data.slug },
      { $setOnInsert: data },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }
  console.log(`✔ ${PRODUCTS.length} productos`);
}

async function seedCourse() {
  const course = await Product.findOne({ slug: "curso-boom-crash" }).lean();
  if (!course) return;
  if (await CourseModule.exists({ product: course._id })) {
    console.log("· El curso ya tiene módulos; no se tocan");
    return;
  }

  let lessons = 0;
  for (const [m, mod] of COURSE.entries()) {
    const created = await CourseModule.create({
      product: course._id,
      title: mod.title,
      sortOrder: m,
    });
    for (const [l, title] of mod.lessons.entries()) {
      await Lesson.create({
        product: course._id,
        module: created._id,
        title,
        description: "",
        sortOrder: l,
        bunnyVideoId: "",
        isFreePreview: m === 0 && l === 0,
      });
      lessons++;
    }
  }
  console.log(`✔ Curso: ${COURSE.length} módulos, ${lessons} lecciones`);
}

async function seedResults() {
  for (const data of RESULTS) {
    await Result.findOneAndUpdate(
      { asset: data.asset, tradedAt: data.tradedAt, lots: data.lots, entryPrice: data.entryPrice },
      { $setOnInsert: data },
      { upsert: true },
    );
  }
  console.log(`✔ ${RESULTS.length} resultados`);
}

async function seedSignals() {
  for (const data of SIGNALS) {
    await Signal.findOneAndUpdate(
      { asset: data.asset, sentAt: data.sentAt },
      { $setOnInsert: data },
      { upsert: true },
    );
  }
  console.log(`✔ ${SIGNALS.length} señales`);
}

async function main() {
  console.log("Conectando a MongoDB...");
  await mongoose.connect(env.DB_URI);

  await seedProducts();
  await seedCourse();
  await seedResults();
  await seedSignals();

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("✖ Falló el seed:", error);
  process.exit(1);
});
