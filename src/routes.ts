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
import shippingGuideRouter from "./routes/shippingGuide.routes";
import reportsRouter from "./routes/reports.routes";

const router = Router();

router.use("/seller", sellerRouter);
router.use("/product", productRouter);
router.use("/feature", featureRouter);
router.use("/category", categoryRouter);
router.use("/sale", saleRouter);
router.use("/group", groupRouter);
router.use("/shipping", shippingRouter);
router.use("/sucursal", sucursalRouter);
router.use("/financeFlux", financeFluxRouter);
router.use("/financeFlux/category", financeFluxCategoryRouter);
router.use("/worker", workerRouter);
router.use("/pdf", pdfRouter);
router.use("/paymentProof", paymentProofRouter);
router.use("/entry", entryRouter);
router.use("/user", userRouter);
router.use("/whats", whatsRouter);
router.use("/boxClose", boxCloseRouter);
router.use("/dailyEffective", dailyEffectiveRouter);
router.use("/external", externalSaleRouter)
router.use("/shippingGuide", shippingGuideRouter);
router.use("/reports", reportsRouter);

export default router;
