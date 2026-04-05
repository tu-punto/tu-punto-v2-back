import { Router } from "express";
import sellerRouter from "./routes/seller.routes";
import productRouter from "./routes/products.routes";
import featureRouter from "./routes/feature.routes";
import categoryRouter from "./routes/category.routes";
import saleRouter from "./routes/sale.routes";
import groupRouter from "./routes/group.routes";
import shippingRouter from "./routes/shipping.routes";
import sucursalRouter from "./routes/sucursal.routes";
import financeFluxRouter from "./routes/financeFlux.routes";
import workerRouter from "./routes/worker.routes";
import pdfRouter from "./routes/pdf.routes";
import paymentProofRouter from "./routes/paymentProof.routes";
import entryRouter from "./routes/entry.routes";
import userRouter from "./routes/user.routes";
import whatsRouter from "./routes/whatsapp.route";
import boxCloseRouter from "./routes/boxClose.routes";
import dailyEffectiveRouter from "./routes/dailyEffective.routes";
import externalSaleRouter from "./routes/external.routes";
import financeFluxCategoryRouter from "./routes/financeFluxCategory.routes";
import recurringExpenseRouter from "./routes/recurringExpense.routes";
import qr from "./routes/qr.routes";

import shippingGuideRouter from "./routes/shippingGuide.routes";
import reportsRouter from "./routes/reports.routes";
import { requireAuth, requireRole } from "./middlewares/auth.middleware";

const router = Router();

router.use("/seller", requireAuth, sellerRouter);
// router.use("/product", requireAuth, requireRole("admin", "operator", "seller"), productRouter);
router.use("/product", productRouter);
router.use("/feature", requireAuth, requireRole("admin", "operator", "seller"), featureRouter);
router.use("/category", requireAuth, requireRole("admin", "operator", "seller"), categoryRouter);
router.use("/sale", requireAuth, requireRole("admin", "operator", "seller"), saleRouter);
router.use("/group", requireAuth, requireRole("admin", "operator", "seller"), groupRouter);
router.use("/shipping", requireAuth, requireRole("admin", "operator", "seller"), shippingRouter);
router.use("/sucursal", sucursalRouter);
router.use("/financeFlux", requireAuth, requireRole("admin"), financeFluxRouter);
router.use("/financeFlux/category", requireAuth, requireRole("admin"), financeFluxCategoryRouter);
router.use("/recurringExpense", requireAuth, requireRole("admin"), recurringExpenseRouter);
router.use("/worker", requireAuth, requireRole("admin"), workerRouter);
router.use("/pdf", requireAuth, requireRole("admin"), pdfRouter);
router.use("/paymentProof", requireAuth, requireRole("admin", "seller"), paymentProofRouter);
router.use("/entry", requireAuth, requireRole("admin", "operator", "seller"), entryRouter);
router.use("/user", userRouter);
router.use("/whats", requireAuth, requireRole("admin"), whatsRouter);
router.use("/boxClose", requireAuth, requireRole("admin", "operator"), boxCloseRouter);
router.use("/dailyEffective", requireAuth, requireRole("admin", "operator"), dailyEffectiveRouter);
router.use("/external", requireAuth, requireRole("admin", "operator"), externalSaleRouter)

router.use("/qr", qr);

router.use("/shippingGuide", requireAuth, requireRole("admin", "operator", "seller"), shippingGuideRouter);
router.use("/reports", requireAuth, requireRole("admin"), reportsRouter);


export default router;
