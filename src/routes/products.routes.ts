import { Router } from "express";
import { ProductController } from "../controllers/product.controller";

const productRouter = Router();

// GET
productRouter.get("/", ProductController.getProduct);
productRouter.get("/features/:id", ProductController.getFeatures);
productRouter.get("/category/:id", ProductController.getProductCategory);
productRouter.get("/seller/:id", ProductController.getAllProductsEntryAmountBySellerId);
productRouter.get("/stock/:idProduct", ProductController.getAllStockByProductId);
productRouter.get("/:idProduct/sucursal/:idSucursal", ProductController.getProductStock);
productRouter.get("/:id", ProductController.getProductById);

// POST
productRouter.post("/register", ProductController.registerProductVariants);
productRouter.post("/registerVariant", ProductController.registerProduct);
productRouter.post("/addFeatures", ProductController.addFeatureToProduct);
productRouter.post("/add-variant", ProductController.addVariantToProduct);
productRouter.post("/generate-ingress-pdf", ProductController.generateIngressPDF);

// PUT
productRouter.put("/update-price", ProductController.updatePrice);
productRouter.put("/update-subvariant-stock", ProductController.updateSubvariantStock);

export default productRouter;
