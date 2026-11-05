import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import * as meController from "../controllers/me.controller";

const router = Router();

router.use(authMiddleware);

router.get("/products", meController.products);
router.get("/products/:slug", meController.productDetail);
router.get("/lessons/:id/play", meController.playLesson);
router.get("/orders", meController.orders);

export default router;
