import { ProductRepository } from "../repositories/product.repository";

const getAllProducts = async () => {
    return await ProductRepository.findAll();
};

const registerProduct = async (product: any) => {
    return await ProductRepository.registerProduct(product);
};
export const ProductService ={
    getAllProducts,
    registerProduct
}