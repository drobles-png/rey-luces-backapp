import { Router } from "express";
import * as resultController from "../controllers/result.controller";

const router = Router();

// /stats antes que cualquier ruta con parámetro.
router.get("/stats", resultController.stats);
router.get("/", resultController.list);

export default router;
