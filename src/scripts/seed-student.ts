/**
 * Seed script — crea (o actualiza) el alumno demo desde .env y le da acceso
 * demo sin vencimiento a cada producto. Idempotente: se vuelve a correr después
 * de cargar contenido para cubrir los productos nuevos.
 * Uso: pnpm seed:student
 */
import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";
import { Access } from "../models/access.model";
import { Product } from "../models/product.model";
import { User } from "../models/user.model";

async function main() {
  if (!env.DEMO_STUDENT_EMAIL || !env.DEMO_STUDENT_PASSWORD) {
    console.error("✖ DEMO_STUDENT_EMAIL y DEMO_STUDENT_PASSWORD deben estar en .env");
    process.exit(1);
  }

  console.log("Conectando a MongoDB...");
  await mongoose.connect(env.DB_URI);

  let user = await User.findOne({ email: env.DEMO_STUDENT_EMAIL }).select("+password");
  if (user) {
    user.password = env.DEMO_STUDENT_PASSWORD;
    user.accountType = "customer";
    user.isActive = true;
    if (!user.name) user.name = "Alumno Demo";
    await user.save();
    console.log(`✔ Alumno demo actualizado: ${env.DEMO_STUDENT_EMAIL}`);
  } else {
    user = await User.create({
      email: env.DEMO_STUDENT_EMAIL,
      password: env.DEMO_STUDENT_PASSWORD,
      name: "Alumno Demo",
      phone: "+593990000000",
      accountType: "customer",
    });
    console.log(`✔ Alumno demo creado: ${env.DEMO_STUDENT_EMAIL}`);
  }

  const products = await Product.find().select("_id title").lean();
  for (const product of products) {
    await Access.findOneAndUpdate(
      { user: user._id, product: product._id },
      {
        $set: {
          source: "demo",
          expiresAt: null,
          revokedAt: null,
          note: "Cuenta demo",
          order: null,
          grantedBy: null,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }
  console.log(`✔ Acceso demo a ${products.length} producto(s)`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("✖ Falló el seed:", error);
  process.exit(1);
});
