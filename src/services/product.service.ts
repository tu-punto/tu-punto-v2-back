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


export const ProductService ={
    getAllProducts,
    registerProduct,
    getFeaturesById,
    addFeatureToProduct,
    getProductById
}