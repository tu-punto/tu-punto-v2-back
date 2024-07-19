import { FeatureRepository } from "../repositories/feature.repository";

const getAllFeatures = async () => {
    return await FeatureRepository.findAll();
};
const registerFeature = async (feature: any) => {
    return await FeatureRepository.registerFeature(feature);
};
export const FeatureService = {
    getAllFeatures,
    registerFeature
}