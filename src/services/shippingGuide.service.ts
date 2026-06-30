import { ShippingGuideRepository } from "../repositories/shippingGuide.repository";
import { SellerRepository } from "../repositories/seller.repository";
import moment from 'moment-timezone';

const getAllShippings = async () => {
    return ShippingGuideRepository.getAllShippings();
}

const getSellerShippings = async (sellerID: string) => {
    return await ShippingGuideRepository.getSellerShippings(sellerID);
}

const getBranchShippings = async (branchID: string) => {
    return await ShippingGuideRepository.getBranchShippings(branchID);
}

const uploadShipping = async (shippingGuide: any) => {
    const seller = await SellerRepository.findById(shippingGuide.vendedor);
    if (!seller) {
        throw new Error("Vendedor no encontrado");
    }
    const branchId = String(shippingGuide.sucursal || "");
    const sellerEndDate = seller.fecha_vigencia ? new Date(seller.fecha_vigencia as any) : null;
    const now = new Date();
    const hasActiveBranch = Array.isArray((seller as any).pago_sucursales)
        ? (seller as any).pago_sucursales.some((branch: any) => {
            const currentBranchId = String(branch?.id_sucursal?._id || branch?.id_sucursal || "");
            const branchEndDate = branch?.fecha_salida ? new Date(branch.fecha_salida) : sellerEndDate;
            return currentBranchId === branchId && branch?.activo !== false && (!branchEndDate || branchEndDate > now);
        })
        : false;
    if (!hasActiveBranch) {
        throw new Error("El vendedor no tiene activa esa sucursal");
    }

    if (shippingGuide.fecha_subida) {
        shippingGuide.fecha_subida = moment.tz(shippingGuide.fecha_subida, "America/La_Paz").format("YYYY-MM-DD HH:mm:ss"); 
    }
    if (!shippingGuide.fecha_subida) {
        shippingGuide.fecha_subida = moment().tz("America/La_Paz").format("YYYY-MM-DD HH:mm:ss");
    }

    return await ShippingGuideRepository.uploadShipping(shippingGuide);
}

const markAsDelivered = async (shippingGuideID: string) => {
    return await ShippingGuideRepository.markAsDelivered(shippingGuideID);
}

export const ShippingGuideService = {
    getAllShippings,
    getSellerShippings,
    getBranchShippings,
    uploadShipping,
    markAsDelivered,
}
