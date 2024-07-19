import AppDataSource from "../config/dataSource";
import { VendedorEntity } from "../entities/implements/VendedorEntity";
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

export const SellerRepository = {
    findAll,
    registerSeller
}