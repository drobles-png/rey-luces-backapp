import { Router } from "express";
import { adminMiddleware } from "../middlewares/admin.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";
import { uploadMiddleware } from "../middlewares/upload.middleware";
import * as adminController from "../controllers/admin.controller";

const router = Router();

router.use(authMiddleware, adminMiddleware);

router.get("/stats", adminController.stats);

router.get("/products", adminController.listProducts);
router.post("/products", adminController.createProduct);
router.get("/products/:id", adminController.getProduct);
router.put("/products/:id", adminController.updateProduct);
router.delete("/products/:id", adminController.deleteProduct);

router.post("/uploads/image", uploadMiddleware.single("file"), adminController.uploadImage);

router.post("/products/:id/modules", adminController.createModule);
router.put("/modules/:id", adminController.updateModule);
router.delete("/modules/:id", adminController.deleteModule);

router.post("/modules/:id/lessons", adminController.createLesson);
router.put("/lessons/:id", adminController.updateLesson);
router.delete("/lessons/:id", adminController.deleteLesson);
router.post("/lessons/:id/video", adminController.createLessonVideo);

router.get("/results", adminController.listResults);
router.post("/results", adminController.createResult);
router.put("/results/:id", adminController.updateResult);
router.delete("/results/:id", adminController.deleteResult);

router.get("/signals", adminController.listSignals);
router.post("/signals", adminController.createSignal);
router.put("/signals/:id", adminController.updateSignal);
router.delete("/signals/:id", adminController.deleteSignal);

router.get("/orders", adminController.listOrders);
router.get("/students", adminController.listStudents);

router.post("/access", adminController.grantAccess);
router.get("/access", adminController.listAccess);
router.patch("/access/:id", adminController.updateAccess);
router.post("/access/:id/revoke", adminController.revokeAccess);

export default router;
