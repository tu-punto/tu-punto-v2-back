import { Router } from "express";
import sellerRouter from "./routes/seller.routes";
import productRouter from "./routes/products.routes";
import featureRouter from "./routes/feature.routes";
import categoryRouter from "./routes/category,routes";
import saleRouter from "./routes/sale.routes";

const router = Router();

router.use('/seller',sellerRouter)
router.use('/product',productRouter)
router.use('/feature',featureRouter)
router.use('/category',categoryRouter)
router.use('/sale',saleRouter)

export default router;