import { Vendedor } from "../models/Vendedor"
import { SellerRepository } from "../repositories/seller.repository"


const getAllSellers = async () => {
    const sellers = await SellerRepository.findAll()
    return sellers
}

const registerSeller = async (seller: any) => {
    const newSeller = await SellerRepository.registerSeller(seller)
    return newSeller;
}

const updateSeller = async (sellerId: number, newData: any) => {
    const seller = await SellerRepository.findById(sellerId)
    if (!seller) throw new Error(`Seller with id ${sellerId} doesn't exist`)
    return await SellerRepository.updateSeller(seller, newData)
}

export const SellerService = {
    getAllSellers,
    registerSeller,
    updateSeller
}