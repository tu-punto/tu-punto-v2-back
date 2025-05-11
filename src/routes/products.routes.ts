import { Router } from "express";
import { ProductController } from "../controllers/product.controller";

const productRouter = Router();

productRouter.get('/', ProductController.getProduct);

productRouter.post('/register', ProductController.registerProductVariants);

productRouter.post('/registerVariant', ProductController.registerProduct);

productRouter.post('/addFeatures', ProductController.addFeatureToProduct);

productRouter.post('/addStock', ProductController.addStockToBranch);

productRouter.get('/features/:id', ProductController.getFeatures);

productRouter.get('/category/:id', ProductController.getProductCategory);

productRouter.get('/seller/:id', ProductController.getAllProductsEntryAmountBySellerId);

productRouter.get('/:idProduct/sucursal/:idSucursal', ProductController.getProductStock);

//productRouter.put('/updateStock', ProductController.updateStock);

productRouter.get('/stock/:idProduct', ProductController.getAllStockByProductId);

productRouter.put('/producto-sucursal/:id', ProductController.updateProductBranchStock);

productRouter.get('/:id', ProductController.getProductById);

productRouter.post('/add-variant', ProductController.addVariantToSucursal);

export default productRouter;
