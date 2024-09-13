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

const router = Router();

router.use('/seller', sellerRouter)
router.use('/product', productRouter)
router.use('/feature', featureRouter)
router.use('/category', categoryRouter)
router.use('/sale', saleRouter)
router.use('/group', groupRouter)
router.use('/shipping', shippingRouter)
router.use('/sucursal', sucursalRouter)
router.use('/financeFlux', financeFluxRouter)
router.use('/worker', workerRouter)
router.use('/pdf', pdfRouter)
router.use('/paymentProof', paymentProofRouter)
router.use('/entry', entryRouter)

export default router;