import { CaracteristicasEntity } from "../entities/implements/CaracteristicasEntity";
import { Caracteristicas } from "../models/Caracteristicas";
import { FeatureRepository } from "../repositories/feature.repository";
import { ProductRepository } from "../repositories/product.repository";

interface Feature{
    feature: string,
    value: string[]
}

const getAllProducts = async () => {
    return await ProductRepository.findAll();
};

const registerProduct = async (product: any) => {
    return await ProductRepository.registerProduct(product);
};

const getFeaturesById = async (productId: number) => {
    const product = await ProductRepository.findById(productId)
    if(!product)
        throw new Error("Doesn't exist such product with that id")
    const features = await FeatureRepository.getFeaturesByProductId(product)

    return features.reduce((acc, cur) => {
        
        const feature = acc.find( feat => feat.feature === cur.feature)
        if(feature){
            feature.values.push(cur.value)
        }
        else{
            acc.push({feature: cur.feature, values: [cur.value]})
        }
        
        return acc;
    }, [] as any[])

}

const addFeatureToProduct = async (productId: number, featureWithOutProductId: any) => {
    const product = await ProductRepository.findById(productId)
    if(!product)
        throw new Error("Doesn't exist such product with that id")
    const feature = new Caracteristicas({...featureWithOutProductId})
    feature.product = product
    return await FeatureRepository.registerFeature(feature)

}

const getProductById = async (productId: number) => {
    const product = await ProductRepository.findById(productId)
    if(!product)
        throw new Error("Doesn't exist such product with that id")
    return product
}

const getProductStock = async (productId: number, sucursalId: number) => {
    return await ProductRepository.getStockProduct(productId, sucursalId)
}

const updateStock = async (newStock: any[]) => {
    const updatedStock = []
    for( let {productId, sucursalId, stock, precio} of newStock){
        const oldStock = await ProductRepository.getStockProduct(productId, sucursalId)
        const cantidad_por_sucursal = oldStock?.cantidad_por_sucursal + stock
        const newStock = await ProductRepository.updateStock(oldStock!, {cantidad_por_sucursal})
        
        if(precio){
            const product = await ProductRepository.findById(productId)
            const newProduct = ProductRepository.updateProduct(product!, {precio})
        }
        updatedStock.push(newStock)
    }
    return updatedStock
}

export const ProductService ={
    getAllProducts,
    registerProduct,
    getFeaturesById,
    addFeatureToProduct,
    getProductById,
    getProductStock,
    updateStock
}