import AppDataSource from "../config/dataSource";
import { VendedorEntity } from "../entities/implements/VendedorSchema";
import { IVendedor } from "../entities/IVendedor";
import { Vendedor } from "../models/Vendedor";

const sellersRepository = AppDataSource.getRepository(VendedorEntity);

const findAll = async (): Promise<Vendedor[]> => {
    return await sellersRepository.find();
}

const registerSeller = async (seller: IVendedor): Promise<Vendedor> => {
    const newSeller = sellersRepository.create(seller);
    const saveSeller = await sellersRepository.save(newSeller);
    return new Vendedor(saveSeller);
}

const updateSeller = async (seller: IVendedor, updateData: any) => {
    seller = { ...seller, ...updateData }
    const updatedSeller = await sellersRepository.save(seller)
    return updatedSeller
}

const findById = async (sellerId: number): Promise<VendedorEntity | null> => {
    const seller = await sellersRepository.findOne({
        where: { id_vendedor: sellerId }
    });
    return seller;
};

export const SellerRepository = {
    findAll,
    registerSeller,
    findById,
    updateSeller
}