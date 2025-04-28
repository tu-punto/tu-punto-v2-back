import { ProductoSucursalModel } from "../entities/implements/ProductoSucursalSchema";
import { IProducto_Sucursal } from "../entities/IProducto_Sucursal";
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

const registerProductBranch = async (productBranch: IProducto_Sucursal): Promise<IProductoSucursalDocument> => {
    const newProductBranch = new ProductoSucursalModel(productBranch);
    console.log("Llegue aqui",newProductBranch);
    return await newProductBranch.save(); 
}

export const ProductBranchRepository = {
    findAll,
    findById,
    registerProductBranch
};


