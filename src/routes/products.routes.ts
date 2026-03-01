import { Router } from "express";
import { ProductController } from "../controllers/product.controller";

const productRouter = Router();

// GET
productRouter.get("/", ProductController.getProduct);
productRouter.get("/flat", ProductController.getFlatProductList);
productRouter.get("/features/:id", ProductController.getFeatures);
productRouter.get("/category/:id", ProductController.getProductCategory);
productRouter.get("/seller/:id", ProductController.getAllProductsEntryAmountBySellerId);
productRouter.get("/stock/:idProduct", ProductController.getAllStockByProductId);
productRouter.get("/:idProduct/sucursal/:idSucursal", ProductController.getProductStock);
productRouter.get("/temporales", ProductController.getTemporaryProducts);

productRouter.get("/:id/qr", ProductController.getProductQR); 
productRouter.get("/qr/:qrCode", ProductController.findProductByQR);
productRouter.get("/variant-qr/code/:qrCode", ProductController.findVariantByQRCode);
productRouter.get("/variant-qr/resolve", ProductController.resolveVariantQRPayload);
productRouter.get("/variant-qr/list", ProductController.listVariantQR);

productRouter.get("/:id", ProductController.getProductById);

// POST
productRouter.post("/register", ProductController.registerProductVariants);
productRouter.post("/registerVariant", ProductController.registerProduct);
productRouter.post("/addFeatures", ProductController.addFeatureToProduct);
productRouter.post("/add-variant", ProductController.addVariantToProduct);
productRouter.post("/generate-ingress-pdf", ProductController.generateIngressPDF);

productRouter.post("/:id/regenerate-qr", ProductController.regenerateProductQR); // Regenerar QR
productRouter.post("/variant-qr/generate", ProductController.generateVariantQR);
productRouter.post("/variant-qr/batch-generate", ProductController.batchGenerateVariantQR);
productRouter.post("/variant-qr/migrate-variant-keys", ProductController.migrateVariantKeys);

// PUT
productRouter.put("/update-price", ProductController.updatePrice);
productRouter.put("/update-subvariant-stock", ProductController.updateSubvariantStock);

export default productRouter;
