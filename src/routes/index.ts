import express, { Application } from "express";
import authRoutes from "./auth.routes";
import healthRoutes from "./health.routes";
import cronRoutes from "./cron.routes";
import productRoutes from "./product.routes";
import resultRoutes from "./result.routes";
import signalRoutes from "./signal.routes";
import meRoutes from "./me.routes";
import orderRoutes from "./order.routes";
import adminRoutes from "./admin.routes";

function routerApi(app: Application) {
  const router = express.Router();
  app.use("/api", router);

  router.use("/health", healthRoutes);
  router.use("/auth", authRoutes);
  router.use("/cron", cronRoutes);
  router.use("/products", productRoutes);
  router.use("/results", resultRoutes);
  router.use("/signals", signalRoutes);
  router.use("/me", meRoutes);
  router.use("/orders", orderRoutes);
  router.use("/admin", adminRoutes);
}

export default routerApi;
