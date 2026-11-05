import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import * as signalController from "../controllers/signal.controller";

const router = Router();

router.get("/public", signalController.listPublic);

// El acceso a las abiertas (membresía vigente o admin) lo decide el service.
router.get("/", authMiddleware, signalController.listForMember);

export default router;
