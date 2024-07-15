import { Vendedor } from "../models/Vendedor"
import { SellerRepository } from "../repository/seller.repository"


const getAllSellers = async () => {
    const sellers = await SellerRepository.findAll()
    return sellers
}

const registerSeller = async (seller: any) => {
    const newSeller = await SellerRepository.registerSeller(seller)
    return newSeller;
}

export const SellerService = {
    getAllSellers,
    registerSeller
}