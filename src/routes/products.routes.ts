import { Router } from "express";
import { ProductController } from "../controllers/product.controller";
import { requireAuth, requireRole, requireSellerOwnership } from "../middlewares/auth.middleware";
import { uploadVariantImages } from "../middlewares/upload.middleware";

const productRouter = Router();

// GET
productRouter.get("/", ProductController.getProduct);
productRouter.get("/flat", ProductController.getFlatProductList);
productRouter.get("/flat/list", ProductController.getFlatProductListPage);
productRouter.get("/seller/inventory/all", ProductController.getSellerInventoryAll);
productRouter.get("/seller/inventory", ProductController.getSellerInventoryList);
productRouter.get(
  "/seller/product-info",
  requireAuth,
  requireRole("seller"),
  ProductController.getSellerProductInfoList
);
productRouter.get("/features/:id", ProductController.getFeatures);
productRouter.get("/category/:id", ProductController.getProductCategory);
productRouter.get("/seller/:id", requireSellerOwnership("id"), ProductController.getAllProductsEntryAmountBySellerId);
productRouter.get("/stock/:idProduct", ProductController.getAllStockByProductId);
productRouter.get("/:idProduct/sucursal/:idSucursal", ProductController.getProductStock);
productRouter.get("/temporales", ProductController.getTemporaryProducts);

  productRouter.get("/:id/qr", ProductController.getProductQR); 
  productRouter.get("/qr/:qrCode", ProductController.findProductByQR);
  productRouter.get("/variant-qr/code/:qrCode", ProductController.findVariantByQRCode);
  productRouter.get("/variant-qr/resolve", ProductController.resolveVariantQRPayload);
  productRouter.get("/variant-qr/list", ProductController.listVariantQR);
  productRouter.get("/variant-qr-group/resolve", ProductController.resolveVariantQRGroupPayload);
  productRouter.get("/variant-qr-group/list", ProductController.listVariantQRGroup);
  productRouter.get("/variant-qr-group/:id", ProductController.getVariantQRGroup);

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
  productRouter.post("/variant-qr-group/create", ProductController.createVariantQRGroup);
  productRouter.post("/variant-qr-group/:id/generate-qr", ProductController.generateVariantQRGroup);

  // PUT
  productRouter.put("/update-price", ProductController.updatePrice);
  productRouter.put("/update-subvariant-stock", ProductController.updateSubvariantStock);
  productRouter.put("/variant-qr-group/:id", ProductController.updateVariantQRGroup);

  //PATCH
productRouter.patch(
  "/:productId/sucursal/:sucursalId/variant/:variantKey/extras",
  requireAuth,
  requireRole("seller"),
  uploadVariantImages.array("imagenes", 4),
  ProductController.updateVariantExtrasBySeller
);

productRouter.patch(
  "/seller/product-info/:productId/variant/:variantKey",
  requireAuth,
  requireRole("seller"),
  uploadVariantImages.array("imagenes", 4),
  ProductController.updateSellerProductInfoByVariant
);

export default productRouter;
