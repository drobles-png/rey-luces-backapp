import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import * as orderController from "../controllers/order.controller";

const router = Router();

router.use(authMiddleware);

router.post("/", orderController.create);
router.post("/confirm", orderController.confirm);

export default router;
