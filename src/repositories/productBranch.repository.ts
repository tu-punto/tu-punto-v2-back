import AppDataSource from "../config/dataSource";
import { IProducto_Sucursal } from "../entities/IProducto_Sucursal";
import { Producto_SucursalEntity } from "../entities/implements/ProductoSucursalSchema";
import { Producto_Sucursal } from "../models/Producto_Sucursal";

const productBranchRepository = AppDataSource.getRepository(Producto_SucursalEntity)

const findAll = async (): Promise<Producto_SucursalEntity[]> => {
    return await productBranchRepository.find({
        relations: {
            producto: true,
            sucursal: true
        }
    })
}

const findById = async (branchId: number, productId: number): Promise<Producto_SucursalEntity | null> => {
    return await productBranchRepository.findOne({
        where: {
            id_sucursal: branchId,
            id_producto: productId
        }
    })
}

const registerProductBranch = async (productBranch: IProducto_Sucursal) => {
    const newProductBranch = productBranchRepository.create(productBranch)
    const savedProductBranch = await productBranchRepository.save(newProductBranch)
    return new Producto_Sucursal(savedProductBranch)
}

export const ProductBranchRepository = {
    findAll, findById, registerProductBranch
}