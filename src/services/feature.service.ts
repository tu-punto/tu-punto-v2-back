import { FeatureRepository } from "../repositories/feature.repository";
import { IFinanceFluxDocument } from "../entities/documents/IFinanceFluxDocument";

const getAllFeaturesDashboard = async (): Promise<IFinanceFluxDocument[]> => {
    return await FeatureRepository.findAllDashboard();
};
const getAllFeatures = async () => {
    return await FeatureRepository.findAll();
};
const registerFeature = async (feature: any) => {
    return await FeatureRepository.registerFeature(feature);
};
export const FeatureService = {
    getAllFeatures,
    registerFeature,
    getAllFeaturesDashboard
}