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
    const listFeatures = await ProductRepository.getFeatures(product)

    console.log(listFeatures)
    const features = new Map<string, string[]>()
    for(let feature of listFeatures){
        if(feature.producto.id_producto === productId){
            const featureName: string = feature.caracteristica.nombre
            const newFeatures = features.get(featureName) || []
            newFeatures.push(feature.value)
            features.set(featureName, newFeatures)
        }
    }

    const fixFeatures:Feature[] = []
    features.forEach( (value, key) => {
        value = [... new Set(value)]
        fixFeatures.push({
            feature: key,
            value
        })
    })

    return fixFeatures
}

const addFeatureToProduct = async (productId: number, featureId: number, value: string) => {
    const product = await ProductRepository.findById(productId)
    if(!product)
        throw new Error("Doesn't exist such product with that id")
    const feature = await FeatureRepository.findById(featureId)
    if(!feature)
        throw new Error("Doesn't exist such feature with that id")
    return await ProductRepository.addFeatureToProduct(product, feature, value)

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