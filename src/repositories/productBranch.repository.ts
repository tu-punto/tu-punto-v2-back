/*
import { ProductoSucursalModel } from "../entities/implements/ProductoSucursalSchema";
import { IProductoSucursalDocument } from "../entities/documents/IProductoSucursal";

const findAll = async (): Promise<IProductoSucursalDocument[]> => {
    return await ProductoSucursalModel.find()
        .populate('producto')
        .populate('sucursal');
}

const findById = async (branchId: any, productId: any): Promise<IProductoSucursalDocument | null> => {
    return await ProductoSucursalModel.findOne({
        id_sucursal: branchId,
        id_producto: productId
    })
    .populate('producto')
    .populate('sucursal');
}

    
const updateCantidadById = async (id: string, nuevaCantidad: number): Promise<IProductoSucursalDocument | null> => {
    return await ProductoSucursalModel.findByIdAndUpdate(
        id,
        { cantidad_por_sucursal: nuevaCantidad },
        { new: true } 
    );
};


export const ProductBranchRepository = {
    findAll,
    findById,
    registerProductBranch,
    updateCantidadById
};
*/

